#!/usr/bin/env python3
"""Capture K-LD7 raw ADC (RADC) data alongside OPS243 speed readings.

Runs both radars simultaneously:
- K-LD7: streams RADC + PDAT + TDAT at 3 Mbaud (main thread)
- OPS243: reads speed in a background thread, detects shots by speed gap

The OPS243 ball speed anchors the K-LD7 velocity search for offline analysis.

Usage:
    # K-LD7 only (no OPS243)
    ./scripts/capture_kld7_radc.py --port /dev/ttyUSB0 --duration 60

    # Both radars
    ./scripts/capture_kld7_radc.py --port /dev/ttyUSB0 --ops243-port /dev/ttyACM0 --duration 60

Output:
    .pkl file with RADC + PDAT + TDAT frames, OPS243 shots, and metadata.
"""

from __future__ import annotations

import argparse
import pickle
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

try:
    from kld7 import KLD7, FrameCode, KLD7Exception
except ImportError:
    print("kld7 package not installed. Run: pip install kld7")
    sys.exit(1)

# Add src to path for OPS243 import
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))


def target_to_dict(target):
    if target is None:
        return None
    return {
        "distance": target.distance,
        "speed": target.speed,
        "angle": target.angle,
        "magnitude": target.magnitude,
    }


def read_all_params(radar):
    """Read all configurable parameters from the K-LD7."""
    param_names = [
        "RBFR", "RSPI", "RRAI", "THOF", "TRFT", "VISU",
        "MIRA", "MARA", "MIAN", "MAAN", "MISP", "MASP", "DEDI",
        "RATH", "ANTH", "SPTH", "DIG1", "DIG2", "DIG3", "HOLD", "MIDE", "MIDS",
    ]
    params = {}
    for name in param_names:
        try:
            params[name] = getattr(radar.params, name)
        except Exception:
            pass
    return params


def configure_for_golf(radar, range_m=5, speed_kmh=100):
    """Configure K-LD7 for golf ball detection."""
    range_settings = {5: 0, 10: 1, 30: 2, 100: 3}
    speed_settings = {12: 0, 25: 1, 50: 2, 100: 3}

    params = radar.params
    params.RRAI = range_settings.get(range_m, 0)
    params.RSPI = speed_settings.get(speed_kmh, 3)
    params.DEDI = 2    # Both directions
    params.THOF = 10   # Max sensitivity
    params.TRFT = 1    # Fast tracking
    params.MIAN = -90
    params.MAAN = 90
    params.MIRA = 0
    params.MARA = 100
    params.MISP = 0
    params.MASP = 100
    params.VISU = 0    # No vibration suppression


class OPS243SpeedReader:
    """Background OPS243 speed reader with shot detection."""

    SHOT_GAP_S = 0.5  # Gap between readings that signals shot complete
    MIN_BALL_SPEED_MPH = 30.0

    def __init__(self, port: str):
        self.port = port
        self.radar = None
        self._running = False
        self._thread = None
        self._lock = threading.Lock()
        self.readings = []  # All readings with timestamps
        self.shots = []  # Detected shots: {ball_speed_mph, timestamp, readings}

    def connect(self) -> bool:
        try:
            from openflight.ops243 import OPS243Radar
            self.radar = OPS243Radar(port=self.port)
            self.radar.connect()
            self.radar.configure_for_golf()
            return True
        except Exception as e:
            print(f"OPS243 connection failed: {e}")
            return False

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3.0)
        if self.radar:
            try:
                self.radar.disconnect()
            except Exception:
                pass

    def _read_loop(self):
        """Read speed continuously, detect shots by gap."""
        current_readings = []
        last_reading_time = 0

        while self._running:
            try:
                reading = self.radar.read_speed()
                if reading is None:
                    # Check for shot gap
                    if current_readings and time.time() - last_reading_time > self.SHOT_GAP_S:
                        self._finalize_shot(current_readings)
                        current_readings = []
                    time.sleep(0.01)
                    continue

                now = time.time()
                entry = {
                    "speed_mph": reading.speed,
                    "direction": reading.direction.value,
                    "magnitude": reading.magnitude,
                    "timestamp": now,
                }

                with self._lock:
                    self.readings.append(entry)

                current_readings.append(entry)
                last_reading_time = now

            except Exception:
                time.sleep(0.05)

        # Finalize any remaining readings
        if current_readings:
            self._finalize_shot(current_readings)

    def _finalize_shot(self, readings):
        """Process accumulated readings into a shot."""
        if not readings:
            return

        # Find ball: peak outbound speed
        outbound = [r for r in readings if r["direction"] == "outbound"]
        if not outbound:
            return

        ball_reading = max(outbound, key=lambda r: r["speed_mph"])
        ball_speed = ball_reading["speed_mph"]

        if ball_speed < self.MIN_BALL_SPEED_MPH:
            return

        # Find club: fastest reading before ball
        ball_time = ball_reading["timestamp"]
        club_readings = [r for r in outbound if r["timestamp"] < ball_time]
        club_speed = max((r["speed_mph"] for r in club_readings), default=None)

        shot = {
            "ball_speed_mph": ball_speed,
            "club_speed_mph": club_speed,
            "impact_timestamp": ball_reading["timestamp"],
            "readings": readings,
        }

        with self._lock:
            self.shots.append(shot)

        print(f"\n  [OPS243] Shot: {ball_speed:.1f} mph"
              f"{f', club: {club_speed:.1f} mph' if club_speed else ''}")

    def get_shots(self):
        with self._lock:
            return list(self.shots)

    def get_readings(self):
        with self._lock:
            return list(self.readings)


def main():
    parser = argparse.ArgumentParser(
        description="Capture K-LD7 raw ADC data with optional OPS243 speed reference.",
    )
    # K-LD7 args
    parser.add_argument("--port", default=None, help="K-LD7 serial port (auto-detect if not set)")
    parser.add_argument("--baud", type=int, default=3000000, help="K-LD7 baud rate (default: 3000000)")
    parser.add_argument("--orientation", default="vertical", choices=["vertical", "horizontal"])

    # OPS243 args
    parser.add_argument("--ops243-port", default=None, help="OPS243 serial port (omit to skip)")

    # General
    parser.add_argument("--duration", type=int, default=60, help="Capture duration in seconds")
    parser.add_argument("--output", default=None, help="Output .pkl path")
    parser.add_argument("--club", default=None, help="Club label for metadata")
    parser.add_argument("--shots", type=int, default=None, help="Expected shot count")
    parser.add_argument("--notes", default=None, help="Freeform notes")
    args = parser.parse_args()

    # Auto-detect K-LD7 port
    port = args.port
    if port is None:
        from serial.tools.list_ports import comports
        for p in comports():
            desc = (p.description or "").lower()
            mfg = (p.manufacturer or "").lower()
            if any(kw in desc for kw in ["ftdi", "cp210", "usb-serial", "uart"]):
                port = p.device
                break
            if any(kw in mfg for kw in ["ftdi", "silicon labs"]):
                port = p.device
                break
        if port is None:
            print("No K-LD7 detected. Use --port to specify.")
            sys.exit(1)

    # Output path
    if args.output:
        output_path = Path(args.output).expanduser().resolve()
    else:
        output_dir = Path(__file__).resolve().parent.parent / "session_logs"
        output_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        suffix = f"-{args.club}" if args.club else ""
        output_path = output_dir / f"kld7_radc_{timestamp}{suffix}.pkl"

    # Connect OPS243 if requested
    ops243 = None
    if args.ops243_port:
        ops243 = OPS243SpeedReader(args.ops243_port)
        if not ops243.connect():
            print("Continuing without OPS243.")
            ops243 = None

    print("=" * 60)
    print("  K-LD7 Raw ADC Capture")
    print("=" * 60)
    print(f"  K-LD7 port:  {port}")
    print(f"  K-LD7 baud:  {args.baud}")
    print(f"  OPS243:      {args.ops243_port or 'disabled'}")
    print(f"  Duration:    {args.duration}s")
    print(f"  Orientation: {args.orientation}")
    print(f"  Output:      {output_path}")
    print()

    # Connect K-LD7
    print("Connecting K-LD7...")
    try:
        kld7 = KLD7(port, baudrate=args.baud)
    except (KLD7Exception, Exception) as e:
        print(f"Error: {e}")
        sys.exit(1)
    print(f"  Connected: {kld7}")

    print("Configuring for golf...")
    configure_for_golf(kld7)
    all_params = read_all_params(kld7)
    print()

    # Start OPS243 background reader
    if ops243:
        ops243.start()
        print("  OPS243 speed reader started")

    # Stream K-LD7 RADC + PDAT + TDAT
    frame_codes = FrameCode.RADC | FrameCode.PDAT | FrameCode.TDAT

    metadata = {
        "module": "K-LD7",
        "mode": "RADC",
        "port": port,
        "baud_rate": args.baud,
        "orientation": args.orientation,
        "ops243_port": args.ops243_port,
        "ops243_enabled": ops243 is not None,
        "capture_start": datetime.now().isoformat(),
        "params": all_params,
        "club": args.club,
        "expected_shots": args.shots,
        "notes": args.notes,
    }

    frames = []
    frame_count = 0
    radc_count = 0
    pdat_detection_count = 0
    start_time = time.time()

    print("-" * 60)
    print(f"Streaming RADC + PDAT + TDAT for {args.duration}s (Ctrl+C to stop)")
    if ops243:
        print("OPS243 listening for shots in background")
    print("-" * 60)

    try:
        current_frame = {"timestamp": time.time()}
        seen_in_frame = set()

        for code, payload in kld7.stream_frames(frame_codes, max_count=-1):
            if time.time() - start_time >= args.duration:
                break

            if code in seen_in_frame:
                frames.append(current_frame)
                current_frame = {"timestamp": time.time()}
                seen_in_frame = set()

            seen_in_frame.add(code)

            if code == "RADC":
                current_frame["radc"] = payload
                radc_count += 1

            elif code == "TDAT":
                current_frame["tdat"] = target_to_dict(payload)
                frame_count += 1
                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0
                n_shots = len(ops243.get_shots()) if ops243 else 0
                print(
                    f"\r  Frames: {frame_count}  RADC: {radc_count}  "
                    f"PDAT: {pdat_detection_count}  "
                    f"FPS: {fps:.1f}  "
                    f"{'Shots: ' + str(n_shots) + '  ' if ops243 else ''}"
                    f"Elapsed: {elapsed:.0f}s",
                    end="",
                    flush=True,
                )

            elif code == "PDAT":
                current_frame["pdat"] = [target_to_dict(t) for t in payload] if payload else []
                pdat_detection_count += sum(1 for _ in (payload or []))

        if seen_in_frame:
            frames.append(current_frame)

    except KeyboardInterrupt:
        pass
    except KLD7Exception as e:
        print(f"\nK-LD7 error: {e}")
    finally:
        try:
            kld7.close()
        except Exception:
            pass
        try:
            kld7._port = None
        except Exception:
            pass
        if ops243:
            ops243.stop()

    # Gather OPS243 data
    ops243_shots = ops243.get_shots() if ops243 else []
    ops243_readings = ops243.get_readings() if ops243 else []

    metadata["capture_end"] = datetime.now().isoformat()
    metadata["total_frames"] = len(frames)
    metadata["radc_frames"] = radc_count
    metadata["pdat_detection_count"] = pdat_detection_count
    metadata["ops243_shot_count"] = len(ops243_shots)
    metadata["ops243_reading_count"] = len(ops243_readings)

    print()
    print()
    print("=" * 60)
    print(f"  K-LD7: {len(frames)} frames ({radc_count} with RADC)")
    print(f"  PDAT detections: {pdat_detection_count}")
    if ops243:
        print(f"  OPS243: {len(ops243_shots)} shots, {len(ops243_readings)} readings")
        for i, shot in enumerate(ops243_shots):
            club = f", club: {shot['club_speed_mph']:.1f} mph" if shot['club_speed_mph'] else ""
            print(f"    Shot {i+1}: {shot['ball_speed_mph']:.1f} mph{club}")
    print(f"  Saving to {output_path}")

    data = {
        "metadata": metadata,
        "frames": frames,
        "ops243_shots": ops243_shots,
        "ops243_readings": ops243_readings,
    }
    with open(output_path, "wb") as f:
        pickle.dump(data, f)

    print(f"  Done ({output_path.stat().st_size / 1024:.0f} KB)")
    print("=" * 60)


if __name__ == "__main__":
    main()
