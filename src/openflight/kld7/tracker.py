"""K-LD7 angle radar tracker with ring buffer for shot correlation."""

import logging
import threading
import time
from collections import deque
from typing import Optional

from .types import KLD7Angle, KLD7Frame

logger = logging.getLogger(__name__)


def _target_to_dict(target):
    """Convert a kld7 Target namedtuple to a dict."""
    if target is None:
        return None
    return {
        "distance": target.distance,
        "speed": target.speed,
        "angle": target.angle,
        "magnitude": target.magnitude,
    }


def _find_port():
    """Auto-detect K-LD7 EVAL board USB serial port."""
    try:
        from serial.tools.list_ports import comports
    except ImportError:
        return None
    for port in comports():
        desc = (port.description or "").lower()
        mfg = (port.manufacturer or "").lower()
        if any(kw in desc for kw in ["ftdi", "cp210", "usb-serial", "uart"]):
            return port.device
        if any(kw in mfg for kw in ["ftdi", "silicon labs"]):
            return port.device
    return None


class KLD7Tracker:
    """
    K-LD7 angle radar tracker.

    Streams TDAT+PDAT frames in a background thread into a ring buffer.
    When the OPS243 detects a shot, call get_angle_for_shot() to search
    the buffer for the ball pass and extract angle data.
    """

    def __init__(
        self,
        port: Optional[str] = None,
        range_m: int = 5,
        speed_kmh: int = 100,
        orientation: str = "vertical",
        buffer_seconds: float = 2.0,
    ):
        self.port = port
        self.range_m = range_m
        self.speed_kmh = speed_kmh
        self.orientation = orientation
        self.buffer_seconds = buffer_seconds
        self.max_buffer_frames = int(34 * buffer_seconds)

        self._radar = None
        self._stream_thread: Optional[threading.Thread] = None
        self._running = False
        self._init_ring_buffer()

    def _init_ring_buffer(self):
        """Initialize or reset the ring buffer."""
        self._ring_buffer: deque[KLD7Frame] = deque(maxlen=self.max_buffer_frames)

    def connect(self) -> bool:
        """Connect to K-LD7 and configure for golf."""
        try:
            from kld7 import KLD7
        except ImportError:
            logger.error("kld7 package not installed. Run: pip install kld7")
            return False

        port = self.port or _find_port()
        if not port:
            logger.error("No K-LD7 EVAL board detected")
            return False

        try:
            self._radar = KLD7(port, baudrate=115200)
            logger.info("K-LD7 connected on %s", port)
        except Exception as e:
            logger.error("K-LD7 connection failed: %s", e)
            return False

        self._configure_for_golf()
        return True

    def _configure_for_golf(self):
        """Configure K-LD7 parameters for golf ball detection."""
        range_settings = {5: 0, 10: 1, 30: 2, 100: 3}
        speed_settings = {12: 0, 25: 1, 50: 2, 100: 3}

        params = self._radar.params
        params.RRAI = range_settings.get(self.range_m, 0)
        params.RSPI = speed_settings.get(self.speed_kmh, 3)
        params.DEDI = 2
        params.THOF = 10
        params.TRFT = 1
        params.MIAN = -90
        params.MAAN = 90
        params.MIRA = 0
        params.MARA = 100
        params.MISP = 0
        params.MASP = 100
        params.VISU = 0

        logger.info(
            "K-LD7 configured: range=%dm, speed=%dkm/h, orientation=%s",
            self.range_m, self.speed_kmh, self.orientation,
        )

    def start(self):
        """Start the background streaming thread."""
        if self._running:
            return
        self._running = True
        self._stream_thread = threading.Thread(target=self._stream_loop, daemon=True)
        self._stream_thread.start()
        logger.info("K-LD7 streaming started (orientation=%s)", self.orientation)

    def stop(self):
        """Stop streaming and close connection."""
        self._running = False
        if self._stream_thread:
            self._stream_thread.join(timeout=5)
            self._stream_thread = None
        if self._radar:
            try:
                self._radar.close()
            except Exception:
                pass
            try:
                self._radar._port = None
            except Exception:
                pass
            self._radar = None
        logger.info("K-LD7 stopped")

    def _stream_loop(self):
        """Background thread: stream TDAT+PDAT into ring buffer."""
        from kld7 import FrameCode

        frame_codes = FrameCode.TDAT | FrameCode.PDAT
        current_frame = KLD7Frame(timestamp=time.time())
        seen_in_frame = set()

        try:
            for code, payload in self._radar.stream_frames(frame_codes, max_count=-1):
                if not self._running:
                    break

                if code in seen_in_frame:
                    self._add_frame(current_frame)
                    current_frame = KLD7Frame(timestamp=time.time())
                    seen_in_frame = set()

                seen_in_frame.add(code)

                if code == "TDAT":
                    current_frame.tdat = _target_to_dict(payload)
                elif code == "PDAT":
                    current_frame.pdat = [_target_to_dict(t) for t in payload] if payload else []

            if seen_in_frame:
                self._add_frame(current_frame)

        except Exception as e:
            if self._running:
                logger.error("K-LD7 stream error: %s", e)

    def _add_frame(self, frame: KLD7Frame):
        """Add a frame to the ring buffer."""
        self._ring_buffer.append(frame)

    # Minimum speed (km/h) to consider a detection as a potential ball/club event.
    # Body movement is typically 1-5 km/h; golf ball/club is >10 km/h.
    MIN_SPEED_KMH = 10.0

    # Maximum angle spread (degrees) within an event cluster before it's
    # rejected as noise. Ball passes have tight angle consistency.
    MAX_ANGLE_SPREAD_DEG = 60.0

    # Maximum event duration (seconds). Ball passes are transient (<0.3s).
    # Body movement lasts seconds.
    MAX_EVENT_DURATION_S = 1.0

    # Minimum magnitude for a detection to be considered real.
    # Below this, it's likely noise floor artifacts.
    MIN_MAGNITUDE = 1000

    # Minimum distance (meters) for valid targets. Closer detections are
    # antenna reflections or near-field artifacts.
    MIN_DISTANCE_M = 0.3

    # Minimum number of frames in an event cluster. Single-frame detections
    # are often spurious. Real ball passes span at least 2 frames.
    MIN_EVENT_FRAMES = 2

    # Minimum confidence score to return a result. Below this, the detection
    # is too uncertain to be useful.
    MIN_CONFIDENCE = 0.4

    def _collect_detections(self):
        """Collect all detections from the ring buffer that pass pre-filters."""
        detections = []
        for frame in self._ring_buffer:
            if frame.pdat:
                for target in frame.pdat:
                    if target is not None:
                        mag = target.get("magnitude", 0)
                        speed = abs(target.get("speed", 0))
                        dist = target.get("distance", 0)
                        if (mag >= self.MIN_MAGNITUDE
                                and speed >= self.MIN_SPEED_KMH
                                and dist >= self.MIN_DISTANCE_M):
                            detections.append((
                                frame.timestamp,
                                target["angle"],
                                dist,
                                mag,
                            ))
            elif frame.tdat:
                mag = frame.tdat.get("magnitude", 0)
                speed = abs(frame.tdat.get("speed", 0))
                dist = frame.tdat.get("distance", 0)
                if (mag >= self.MIN_MAGNITUDE
                        and speed >= self.MIN_SPEED_KMH
                        and dist >= self.MIN_DISTANCE_M):
                    detections.append((
                        frame.timestamp,
                        frame.tdat["angle"],
                        dist,
                        mag,
                    ))
        return detections

    def _extract_event(self, detections, shot_timestamp=None, exclude_times=None):
        """Find the best event cluster from detections.

        Args:
            detections: list of (timestamp, angle, distance, magnitude) tuples
            shot_timestamp: prefer events near this time
            exclude_times: set of timestamps to skip (for finding secondary events)

        Returns:
            KLD7Angle or None
        """
        available = detections
        if exclude_times:
            available = [d for d in detections if d[0] not in exclude_times]

        if not available:
            return None

        if shot_timestamp is not None:
            def _score(d):
                time_diff = abs(d[0] - shot_timestamp)
                proximity = max(0.0, 1.0 - time_diff / 2.0)
                return proximity * d[3]
            peak = max(available, key=_score)
        else:
            peak = max(available, key=lambda d: d[3])

        peak_time = peak[0]
        event_detections = [d for d in available if abs(d[0] - peak_time) < 0.5]

        if not event_detections:
            return None

        # Duration filter
        timestamps = [d[0] for d in event_detections]
        event_duration = max(timestamps) - min(timestamps)
        if event_duration > self.MAX_EVENT_DURATION_S:
            logger.debug("K-LD7: rejected — event duration %.2fs > %.1fs",
                          event_duration, self.MAX_EVENT_DURATION_S)
            return None

        # Angle spread filter
        angles = [d[1] for d in event_detections]
        angle_spread = max(angles) - min(angles)
        if angle_spread > self.MAX_ANGLE_SPREAD_DEG:
            logger.debug("K-LD7: rejected — angle spread %.1f° > %.1f°",
                          angle_spread, self.MAX_ANGLE_SPREAD_DEG)
            return None

        total_mag = sum(d[3] for d in event_detections)
        if total_mag == 0:
            return None

        avg_angle = sum(d[1] * d[3] for d in event_detections) / total_mag
        avg_distance = sum(d[2] * d[3] for d in event_detections) / total_mag
        max_magnitude = max(d[3] for d in event_detections)
        num_frames = len(set(d[0] for d in event_detections))

        if num_frames < self.MIN_EVENT_FRAMES:
            logger.debug("K-LD7: rejected — %d frames < min %d",
                          num_frames, self.MIN_EVENT_FRAMES)
            return None

        frame_score = min(num_frames / 3.0, 1.0)
        mag_score = min(max_magnitude / 5000.0, 1.0)

        if len(angles) > 1:
            mean_angle = sum(angles) / len(angles)
            angle_std = (sum((a - mean_angle) ** 2 for a in angles) / len(angles)) ** 0.5
            consistency_score = max(0.0, 1.0 - angle_std / 20.0)
        else:
            consistency_score = 0.5

        confidence = frame_score * 0.4 + mag_score * 0.3 + consistency_score * 0.3
        confidence = round(min(max(confidence, 0.0), 1.0), 2)

        if confidence < self.MIN_CONFIDENCE:
            logger.debug("K-LD7: rejected — confidence %.2f < %.2f",
                          confidence, self.MIN_CONFIDENCE)
            return None

        # Classify: vertical orientation uses angle sign to distinguish ball vs club.
        # KNOWN LIMITATION: This fails for driver swings where angle of attack
        # is positive. Needs temporal/magnitude-based classification with more
        # test data (driver vs iron captures) to build a proper two-event detector.
        detection_class = None
        if self.orientation == "vertical":
            detection_class = "ball" if avg_angle >= 0 else "club"

        logger.info("K-LD7: accepted %s event — angle=%.1f° dist=%.2fm mag=%d "
                     "frames=%d conf=%.2f",
                     detection_class or "unknown",
                     avg_angle, avg_distance, max_magnitude, num_frames, confidence)

        if self.orientation == "vertical":
            return KLD7Angle(
                vertical_deg=round(avg_angle, 1),
                horizontal_deg=None,
                distance_m=round(avg_distance, 2),
                magnitude=max_magnitude,
                confidence=confidence,
                num_frames=num_frames,
                detection_class=detection_class,
            )
        else:
            return KLD7Angle(
                vertical_deg=None,
                horizontal_deg=round(avg_angle, 1),
                distance_m=round(avg_distance, 2),
                magnitude=max_magnitude,
                confidence=confidence,
                num_frames=num_frames,
                detection_class=detection_class,
            )

    def get_angle_for_shot(self, shot_timestamp: Optional[float] = None) -> Optional[KLD7Angle]:
        """
        Search the ring buffer for the ball launch angle.

        For vertical orientation, returns only ball events (angle >= 0°).
        Use get_club_angle() to get the club angle of attack.

        Args:
            shot_timestamp: When the OPS243 detected the shot. If provided,
                events closer to this time are preferred over raw magnitude.
        """
        detections = self._collect_detections()
        if not detections:
            logger.debug("K-LD7: no detections passed pre-filters (speed/mag/dist)")
            return None

        logger.debug("K-LD7: %d detections passed pre-filters from %d buffer frames",
                      len(detections), len(self._ring_buffer))

        result = self._extract_event(detections, shot_timestamp)
        if result is None:
            return None

        # For vertical orientation, if this event is a club detection,
        # try to find a ball event instead
        if self.orientation == "vertical" and result.detection_class == "club":
            # Exclude the club event timestamps and look for a ball event
            club_time = None
            for d in detections:
                if abs(d[1] - result.vertical_deg) < 1.0:
                    club_time = d[0]
                    break
            exclude = set(
                d[0] for d in detections
                if club_time and abs(d[0] - club_time) < 0.5
            )
            ball_result = self._extract_event(detections, shot_timestamp, exclude)
            if ball_result is not None and ball_result.detection_class == "ball":
                return ball_result
            # No ball event found — return the club event anyway
            # (caller can check detection_class)
            return result

        return result

    def get_club_angle(self, shot_timestamp: Optional[float] = None) -> Optional[KLD7Angle]:
        """
        Search the ring buffer for the club angle of attack.

        For vertical orientation, returns only club events (angle < 0°).

        Args:
            shot_timestamp: When the OPS243 detected the shot.
        """
        detections = self._collect_detections()
        if not detections:
            return None

        # Find all events, looking for a club classification
        result = self._extract_event(detections, shot_timestamp)
        if result is None:
            return None

        if result.detection_class == "club":
            return result

        # First event was ball — exclude it and look for club
        exclude = set(
            d[0] for d in detections
            if result.vertical_deg is not None
            and abs(d[1] - result.vertical_deg) < 1.0
        )
        club_result = self._extract_event(detections, shot_timestamp, exclude)
        if club_result is not None and club_result.detection_class == "club":
            return club_result

        return None

    def snapshot_buffer(self) -> list:
        """Return a serializable snapshot of the current ring buffer.

        Call this BEFORE get_angle_for_shot/reset to capture raw data
        for offline analysis alongside OPS243 shot data.
        """
        frames = []
        for frame in self._ring_buffer:
            frames.append({
                "timestamp": frame.timestamp,
                "tdat": frame.tdat,
                "pdat": frame.pdat,
            })
        return frames

    def reset(self):
        """Clear the ring buffer after a shot is processed."""
        self._ring_buffer.clear()
