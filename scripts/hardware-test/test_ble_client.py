"""
BLE client test script for OpenFlight GATT peripheral.

Requires: pip install bleak
Run from repo root: python scripts/hardware-test/test_ble_client.py

Pi must be running: scripts/start-kiosk.sh --mock --ble
(--mock skips radar hardware; omit --mock on real hardware)

With a pairing secret set on the Pi, pass it here:
    python scripts/hardware-test/test_ble_client.py --secret <hex_or_plaintext>
"""
import argparse
import asyncio
import hashlib
import hmac
import json
import sys

from bleak import BleakClient, BleakScanner

DEVICE_NAME = "OpenFlight"

SERVICE_UUID    = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
SHOT_UUID       = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
COMMAND_UUID    = "beb5483e-36e1-4688-b7f5-ea07361b26a9"
STATUS_UUID     = "beb5483e-36e1-4688-b7f5-ea07361b26aa"
CHALLENGE_UUID  = "beb5483e-36e1-4688-b7f5-ea07361b26ab"

SCAN_TIMEOUT_S  = 10
SHOT_WAIT_S     = 30


def _write_cmd(data: dict) -> bytes:
    return json.dumps(data).encode()


async def run(secret: bytes | None) -> None:
    print(f"Scanning for '{DEVICE_NAME}' ({SCAN_TIMEOUT_S}s) ...")
    device = await BleakScanner.find_device_by_name(DEVICE_NAME, timeout=SCAN_TIMEOUT_S)
    if device is None:
        print(f"ERROR: '{DEVICE_NAME}' not found. Is the Pi advertising?")
        sys.exit(1)
    print(f"Found: {device.name} [{device.address}]")

    async with BleakClient(device) as client:
        print("Connected.\n")

        # 1. Read Challenge nonce
        nonce_bytes = await client.read_gatt_char(CHALLENGE_UUID)
        nonce = nonce_bytes.decode()
        print(f"[Challenge] nonce = {nonce[:16]}...  ({len(nonce)} chars)")

        # 2. Authenticate if a secret was provided
        if secret:
            digest = hmac.new(secret, nonce.encode(), hashlib.sha256).hexdigest()
            await client.write_gatt_char(
                COMMAND_UUID,
                _write_cmd({"cmd": "auth_challenge", "hmac": digest}),
                response=True,
            )
            print(f"[Auth]      sent HMAC — {digest[:16]}...")
        else:
            print("[Auth]      skipped (no --secret, dev mode)")

        # 3. Subscribe to Status notifications
        status_events: list[str] = []

        def on_status(_, data: bytearray) -> None:
            msg = data.decode()
            status_events.append(msg)
            print(f"[Status]    << {msg}")

        await client.start_notify(STATUS_UUID, on_status)

        # 4. Subscribe to Shot notifications
        shots_received: list[str] = []

        def on_shot(_, data: bytearray) -> None:
            msg = data.decode()
            shots_received.append(msg)
            try:
                parsed = json.loads(msg)
                ball = parsed.get("b") or parsed.get("ball_speed_mph", "?")
                carry = parsed.get("c") or parsed.get("estimated_carry_yards", "?")
                print(f"[Shot]      << ball={ball} mph  carry={carry} yd  (raw len={len(msg)})")
            except json.JSONDecodeError:
                print(f"[Shot]      << (non-JSON) {msg[:80]}")

        await client.start_notify(SHOT_UUID, on_shot)
        print(f"[Shot]      subscribed — waiting {SHOT_WAIT_S}s for a shot ...")
        print("            Hit a shot on the Pi (or press Ctrl-C to skip)\n")

        # 5. get_session command
        await client.write_gatt_char(
            COMMAND_UUID,
            _write_cmd({"cmd": "get_session"}),
            response=True,
        )
        print("[Command]   >> get_session")

        # 6. Wait for shots
        try:
            await asyncio.sleep(SHOT_WAIT_S)
        except asyncio.CancelledError:
            pass

        # 7. Summary
        print("\n── Summary ─────────────────────────────────────")
        print(f"  Shots received : {len(shots_received)}")
        print(f"  Status events  : {len(status_events)}")
        if shots_received:
            print("  PASS — shot notifications working")
        else:
            print("  NOTE — no shots received (trigger one on the Pi, or run in --mock mode)")
        print("────────────────────────────────────────────────")

        await client.stop_notify(SHOT_UUID)
        await client.stop_notify(STATUS_UUID)


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenFlight BLE client test")
    parser.add_argument(
        "--secret",
        default=None,
        help="Pairing secret (plaintext or hex). Omit in dev/no-auth mode.",
    )
    args = parser.parse_args()

    secret: bytes | None = None
    if args.secret:
        raw = args.secret
        # Accept hex string or plaintext
        try:
            secret = bytes.fromhex(raw)
        except ValueError:
            secret = raw.encode()

    try:
        asyncio.run(run(secret))
    except KeyboardInterrupt:
        print("\nInterrupted.")


if __name__ == "__main__":
    main()
