"""
BLE GATT peripheral server for OpenFlight.

Characteristics
---------------
Shot     (notify + read)  – new shots pushed to connected phones
Command  (write)          – phones send {"cmd": "get_session" | "clear_session" | "set_club", "club": "..."}
Status   (notify + read)  – Pi pushes events like {"event": "session_cleared"}

UUIDs
-----
Service:  4fafc201-1fb5-459e-8fcc-c5c9c331914b
Shot:     beb5483e-36e1-4688-b7f5-ea07361b26a8
Command:  beb5483e-36e1-4688-b7f5-ea07361b26a9
Status:   beb5483e-36e1-4688-b7f5-ea07361b26aa
"""

import asyncio
import json
import logging
import threading
import time
from typing import Callable, Optional, Protocol, runtime_checkable

logger = logging.getLogger(__name__)

OPENFLIGHT_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
SHOT_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
COMMAND_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9"
STATUS_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26aa"

# Truncate at 512 bytes; fall back to slim encoding before truncating
_MAX_PAYLOAD_BYTES = 512
# Slim encoding: short key → full Shot field name (8 most-displayed fields)
_SLIM_FIELDS = {
    "b": "ball_speed_mph",
    "c": "estimated_carry_yards",
    "l": "launch_angle_vertical",
    "s": "spin_rpm",
    "q": "club",
    "t": "timestamp",
    "sp": "club_speed_mph",
    "sm": "smash_factor",
    "cs": "carry_spin_adjusted",
}
# Minimum seconds between accepted write commands (per-server rate limit)
_COMMAND_RATE_LIMIT_S = 1.0


@runtime_checkable
class BLEBackend(Protocol):
    """
    Minimal interface that the real bless BlessServer satisfies.
    Inject a mock in tests to avoid needing real Bluetooth hardware.

    Usage::

        class MockBLEBackend:
            notifications: list[tuple[str, bytearray]] = []

            async def start(self) -> None: ...
            async def stop(self) -> None: ...
            async def update_value(self, service_uuid: str, char_uuid: str) -> None:
                self.notifications.append((char_uuid, self.get_characteristic(char_uuid).value))
            def get_characteristic(self, char_uuid: str): ...
            # write_request_func is set as an attribute by BLEServer._setup
    """

    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def update_value(self, service_uuid: str, char_uuid: str) -> None: ...
    def get_characteristic(self, char_uuid: str): ...


def _slim_shot(shot_data: dict) -> dict:
    return {short: shot_data.get(full) for short, full in _SLIM_FIELDS.items()}


class BLEServer:
    """
    BLE GATT peripheral.  Runs its own asyncio loop on a daemon thread so
    the Flask server is not blocked.  All public methods are thread-safe.

    Parameters
    ----------
    on_command:
        Optional callback invoked (in the BLE event loop thread) when a
        mobile client writes to the command characteristic.  The argument
        is the parsed JSON dict, e.g. {"cmd": "get_session"}.
    """

    def __init__(self, on_command: Optional[Callable[[dict], None]] = None) -> None:
        self._on_command = on_command
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._server = None
        self._thread: Optional[threading.Thread] = None
        self._ready = threading.Event()
        self._last_command_time: float = 0.0

    # ------------------------------------------------------------------
    # Public API (thread-safe)
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """Start the BLE peripheral on a background thread.  Returns True on success."""
        if self._thread is not None and self._thread.is_alive():
            logger.warning("BLE server already running; ignoring duplicate start()")
            return self._server is not None
        self._ready.clear()
        try:
            from bless import (  # pylint: disable=import-outside-toplevel
                BlessServer,
                GATTAttributePermissions,
                GATTCharacteristicProperties,
            )
        except ImportError:
            logger.error(
                "BLE support requires the 'bless' package. "
                "Install it with: uv pip install 'openflight[ble]'"
            )
            return False

        self._thread = threading.Thread(
            target=self._run_loop,
            args=(BlessServer, GATTCharacteristicProperties, GATTAttributePermissions),
            daemon=True,
            name="ble-server",
        )
        self._thread.start()

        if not self._ready.wait(timeout=10):
            logger.error("BLE server did not start within 10 seconds")
            return False

        return self._server is not None

    def notify_shot(self, shot_data: dict) -> None:
        """Push a shot to all connected BLE centrals (thread-safe)."""
        if self._server is None or self._loop is None:
            return

        payload = json.dumps(shot_data).encode("utf-8")
        if len(payload) > _MAX_PAYLOAD_BYTES:
            slim = json.dumps(_slim_shot(shot_data)).encode("utf-8")
            logger.debug(
                "BLE: full shot %d bytes > limit; using slim encoding (%d bytes)",
                len(payload),
                len(slim),
            )
            payload = slim

        asyncio.run_coroutine_threadsafe(
            self._push(SHOT_CHARACTERISTIC_UUID, bytearray(payload)), self._loop
        )

    def notify_event(self, event_data: dict) -> None:
        """Push a status event to all connected BLE centrals (thread-safe)."""
        if self._server is None or self._loop is None:
            return
        payload = json.dumps(event_data).encode("utf-8")
        asyncio.run_coroutine_threadsafe(
            self._push(STATUS_CHARACTERISTIC_UUID, bytearray(payload)), self._loop
        )

    def stop(self) -> None:
        """Gracefully stop the server."""
        if self._server and self._loop:
            future = asyncio.run_coroutine_threadsafe(self._server.stop(), self._loop)
            try:
                future.result(timeout=5)
            except Exception:  # pylint: disable=broad-except
                pass

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _run_loop(
        self,
        BlessServer,
        GATTCharacteristicProperties,
        GATTAttributePermissions,
    ) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._loop = loop
        try:
            loop.run_until_complete(
                self._setup(BlessServer, GATTCharacteristicProperties, GATTAttributePermissions)
            )
            loop.run_forever()
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("BLE server loop crashed: %s", exc)
            self._ready.set()
        finally:
            loop.close()

    async def _setup(
        self,
        BlessServer,
        GATTCharacteristicProperties,
        GATTAttributePermissions,
    ) -> None:
        server = BlessServer(name="OpenFlight", loop=self._loop)
        server.write_request_func = self._handle_write

        gatt = {
            OPENFLIGHT_SERVICE_UUID: {
                SHOT_CHARACTERISTIC_UUID: {
                    "Properties": (
                        GATTCharacteristicProperties.read
                        | GATTCharacteristicProperties.notify
                    ),
                    "Permissions": GATTAttributePermissions.readable,
                    "Value": bytearray(b""),
                },
                COMMAND_CHARACTERISTIC_UUID: {
                    "Properties": GATTCharacteristicProperties.write,
                    "Permissions": GATTAttributePermissions.writeable,
                    "Value": bytearray(b""),
                },
                STATUS_CHARACTERISTIC_UUID: {
                    "Properties": (
                        GATTCharacteristicProperties.read
                        | GATTCharacteristicProperties.notify
                    ),
                    "Permissions": GATTAttributePermissions.readable,
                    "Value": bytearray(b""),
                },
            }
        }

        await server.add_gatt(gatt)
        await server.start()
        self._server = server
        logger.info("BLE server started — advertising as 'OpenFlight'")
        self._ready.set()

    async def _push(self, char_uuid: str, payload: bytearray) -> None:
        if self._server is None:
            return
        char = self._server.get_characteristic(char_uuid)
        if char is None:
            return
        try:
            char.value = payload
            await self._server.update_value(OPENFLIGHT_SERVICE_UUID, char_uuid)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("BLE notify failed (…%s): %s", char_uuid[-4:], exc)

    def _dispatch_command(self, cmd: dict) -> None:
        try:
            self._on_command(cmd)  # type: ignore[misc]
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("BLE on_command handler error: %s", exc)

    def _handle_write(self, characteristic, value: bytearray, **_kwargs) -> None:
        """Rate-limited write handler; dispatches on_command to a daemon thread."""
        # Only respond to writes on the command characteristic
        try:
            char_uuid = str(characteristic.uuid).lower()
        except Exception:  # pylint: disable=broad-except
            return
        if char_uuid != COMMAND_CHARACTERISTIC_UUID.lower():
            return

        now = time.monotonic()
        if now - self._last_command_time < _COMMAND_RATE_LIMIT_S:
            logger.debug("BLE command rate-limited")
            return
        self._last_command_time = now

        try:
            cmd = json.loads(bytes(value).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            logger.warning("BLE: malformed command payload")
            return

        if self._on_command is not None:
            threading.Thread(
                target=self._dispatch_command, args=(cmd,), daemon=True, name="ble-cmd"
            ).start()
