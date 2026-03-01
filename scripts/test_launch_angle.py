#!/usr/bin/env python3
"""
End-to-end test script for launch angle detection.

Starts the camera in continuous capture mode, waits for the sound sensor
(SEN-14262) to detect a golf shot, then triggers the camera capture and
runs ball detection + launch angle calculation.

Usage:
    # Real hardware: wait for sound trigger, capture, analyze
    uv run python scripts/test_launch_angle.py

    # With radar-derived ball speed for better accuracy
    uv run python scripts/test_launch_angle.py --ball-speed 150

    # Multiple shots
    uv run python scripts/test_launch_angle.py --shots 5

    # Mock mode (no hardware required, synthetic ball trajectory)
    uv run python scripts/test_launch_angle.py --mock

    # Custom camera calibration
    uv run python scripts/test_launch_angle.py --camera-height 300 --camera-distance 2000 --focal-length 6.0
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from openflight.camera.capture import CaptureConfig, MockCameraCapture
from openflight.camera.detector import BallDetector
from openflight.camera.launch_angle import CameraCalibration, LaunchAngleCalculator


def wait_for_sound_trigger(gpio_pin: int = 17, timeout: float = 60.0) -> bool:
    """
    Wait for SEN-14262 GATE signal on GPIO pin.

    Args:
        gpio_pin: BCM GPIO pin number (default 17)
        timeout: Max seconds to wait

    Returns:
        True if trigger detected, False on timeout
    """
    try:
        from gpiozero import Button  # pylint: disable=import-outside-toplevel
    except ImportError:
        print("ERROR: gpiozero not available. Install with: uv pip install gpiozero lgpio")
        print("  Or use --mock for testing without hardware.")
        return False

    triggered = False

    def on_trigger():
        nonlocal triggered
        triggered = True

    button = Button(gpio_pin, pull_up=False, bounce_time=0.02)
    button.when_activated = on_trigger

    start = time.time()
    try:
        while not triggered and (time.time() - start) < timeout:
            time.sleep(0.01)
    finally:
        button.close()

    return triggered


def analyze_capture(result, detector, calculator, ball_speed_mph, framerate):
    """Run detection and launch angle analysis on a capture result."""
    print(f"Captured {len(result.frames)} frames (trigger at index {result.trigger_frame_index})")

    if not result.frames:
        print("  ERROR: No frames captured.")
        return None

    # Run ball detection
    print("Running ball detection with tracking...")
    detections = detector.detect_with_tracking(result.frames)

    detected_count = sum(1 for d in detections if d is not None)
    total_count = len(detections)
    detection_rate = (detected_count / total_count * 100) if total_count > 0 else 0

    print(f"  Total frames:    {total_count}")
    print(f"  Ball detected:   {detected_count}")
    print(f"  Detection rate:  {detection_rate:.1f}%")

    if detected_count == 0:
        print("  No ball detections found. Cannot calculate launch angle.")
        return None

    # Show first few detections
    valid_detections = [(i, d) for i, d in enumerate(detections) if d is not None]
    for i, det in valid_detections[:5]:
        print(f"    Frame {i:3d}: x={det.x:.1f}, y={det.y:.1f}, r={det.radius:.1f}, conf={det.confidence:.2f}")

    # Calculate launch angles
    if ball_speed_mph:
        angles = calculator.calculate_with_radar(
            detections, ball_speed_mph=ball_speed_mph, framerate=framerate,
        )
    else:
        angles = calculator.calculate(detections)

    if angles is None:
        print(f"  Launch angle calculation failed (need {calculator.min_detections}+ detections).")
        return None

    return angles


def print_angles(angles, shot_num=None):
    """Print launch angle results."""
    prefix = f"Shot {shot_num}: " if shot_num else ""
    print(f"  {prefix}Vertical: {angles.vertical_deg:+.2f} deg  "
          f"Horizontal: {angles.horizontal_deg:+.2f} deg  "
          f"Confidence: {angles.confidence:.2f}  "
          f"Frames: {angles.frames_used}")


def main():
    parser = argparse.ArgumentParser(
        description="Launch angle detection test — waits for sound trigger, captures, analyzes"
    )
    parser.add_argument(
        "--mock", action="store_true",
        help="Use MockCameraCapture with synthetic trajectory (no hardware)"
    )
    parser.add_argument(
        "--ball-speed", type=float, default=None, metavar="MPH",
        help="Ball speed in mph for radar-derived distance calculation"
    )
    parser.add_argument(
        "--shots", type=int, default=1,
        help="Number of shots to capture (default: 1)"
    )
    parser.add_argument(
        "--num-frames", type=int, default=90,
        help="Frames per capture (default: 90 = ~750ms at 120fps)"
    )
    parser.add_argument(
        "--gpio-pin", type=int, default=17,
        help="BCM GPIO pin for SEN-14262 GATE (default: 17)"
    )
    parser.add_argument(
        "--timeout", type=float, default=60.0,
        help="Seconds to wait for each shot (default: 60)"
    )
    parser.add_argument(
        "--camera-height", type=float, default=300,
        help="Camera height above ground in mm (default: 300)"
    )
    parser.add_argument(
        "--camera-distance", type=float, default=2000,
        help="Camera distance to ball in mm (default: 2000)"
    )
    parser.add_argument(
        "--focal-length", type=float, default=6.0,
        help="Lens focal length in mm (default: 6.0)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  Launch Angle Detection Test")
    print("=" * 60)
    print()

    # Configure capture
    pre_trigger = args.num_frames // 3
    post_trigger = args.num_frames - pre_trigger

    config = CaptureConfig(
        pre_trigger_frames=pre_trigger,
        post_trigger_frames=post_trigger,
    )

    # Set up camera
    if args.mock:
        print("Mode: Mock (synthetic ball trajectory)")
        camera = MockCameraCapture(config=config)
    else:
        print("Mode: Real camera + sound trigger")
        print(f"  Sound trigger: GPIO{args.gpio_pin}")
        try:
            from openflight.camera.capture import CameraCapture
            camera = CameraCapture(config=config)
        except Exception as e:
            print(f"ERROR: Failed to initialize camera: {e}")
            print("  Try --mock for testing without hardware.")
            sys.exit(1)

    print(f"  Frames: {args.num_frames} ({pre_trigger} pre / {post_trigger} post)")
    print(f"  Calibration: height={args.camera_height}mm, dist={args.camera_distance}mm, focal={args.focal_length}mm")
    if args.ball_speed:
        print(f"  Ball speed: {args.ball_speed} mph (radar-derived)")
    print()

    # Initialize detector and calculator
    try:
        detector = BallDetector()
    except Exception as e:
        print(f"ERROR: Failed to initialize BallDetector: {e}")
        sys.exit(1)

    calibration = CameraCalibration(
        camera_height_mm=args.camera_height,
        distance_to_ball_mm=args.camera_distance,
        focal_length_mm=args.focal_length,
    )
    calculator = LaunchAngleCalculator(calibration=calibration)

    # Start camera
    print("Starting camera...")
    try:
        camera.start()
    except Exception as e:
        print(f"ERROR: Failed to start camera: {e}")
        print("  Try --mock for testing without hardware.")
        sys.exit(1)

    # Real camera needs warm-up time for capture thread to fill buffer
    if not args.mock:
        warmup_s = (pre_trigger / config.framerate) + 0.5
        print(f"Camera warm-up ({warmup_s:.1f}s)...")
        time.sleep(warmup_s)

    results = []

    try:
        for shot_num in range(1, args.shots + 1):
            print("-" * 60)
            if args.mock:
                print(f"Shot {shot_num}/{args.shots}: triggering mock capture...")
            else:
                print(f"Shot {shot_num}/{args.shots}: waiting for sound trigger "
                      f"(GPIO{args.gpio_pin}, timeout={args.timeout}s)...")
                print("  Hit a ball!")

                triggered = wait_for_sound_trigger(
                    gpio_pin=args.gpio_pin, timeout=args.timeout,
                )
                if not triggered:
                    print("  Timeout — no sound detected.")
                    continue

                trigger_time = time.time()
                print(f"  BANG! Sound detected at {time.strftime('%H:%M:%S')}")

            result = camera.trigger_capture()

            angles = analyze_capture(
                result, detector, calculator,
                ball_speed_mph=args.ball_speed,
                framerate=config.framerate,
            )

            if angles:
                print_angles(angles, shot_num)
                results.append(angles)
            print()

    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    finally:
        camera.stop()

    # Summary
    if results:
        print("=" * 60)
        print(f"  SUMMARY ({len(results)}/{args.shots} shots)")
        print("=" * 60)
        for i, angles in enumerate(results, 1):
            print_angles(angles, i)

        avg_vert = sum(a.vertical_deg for a in results) / len(results)
        avg_horiz = sum(a.horizontal_deg for a in results) / len(results)
        avg_conf = sum(a.confidence for a in results) / len(results)
        print(f"  Average:  Vertical: {avg_vert:+.2f} deg  "
              f"Horizontal: {avg_horiz:+.2f} deg  "
              f"Confidence: {avg_conf:.2f}")
        print("=" * 60)
    elif not args.mock:
        print("No successful launch angle measurements.")


if __name__ == "__main__":
    main()
