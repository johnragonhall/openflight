"""Tests for K-LD7 angle radar integration."""

import time

import pytest

from openflight.kld7.types import KLD7Angle, KLD7Frame
from openflight.kld7.tracker import KLD7Tracker


class TestKLD7Types:
    """Tests for K-LD7 data types."""

    def test_kld7_frame_defaults(self):
        frame = KLD7Frame(timestamp=1000.0)
        assert frame.timestamp == 1000.0
        assert frame.tdat is None
        assert frame.pdat == []

    def test_kld7_angle_vertical(self):
        angle = KLD7Angle(vertical_deg=12.5, distance_m=2.0, magnitude=5000, confidence=0.8, num_frames=3)
        assert angle.vertical_deg == 12.5
        assert angle.horizontal_deg is None

    def test_kld7_angle_horizontal(self):
        angle = KLD7Angle(horizontal_deg=-3.2, distance_m=1.5, magnitude=4000, confidence=0.7, num_frames=2)
        assert angle.horizontal_deg == -3.2
        assert angle.vertical_deg is None


class TestKLD7TrackerRingBuffer:
    """Tests for ring buffer and angle extraction logic (no hardware)."""

    def _make_tracker(self, orientation="vertical"):
        """Create a tracker without connecting to hardware."""
        tracker = KLD7Tracker.__new__(KLD7Tracker)
        tracker.orientation = orientation
        tracker.buffer_seconds = 2.0
        tracker.max_buffer_frames = 70
        tracker._init_ring_buffer()
        return tracker

    def test_ring_buffer_stores_frames(self):
        tracker = self._make_tracker()
        now = time.time()
        for i in range(5):
            tracker._add_frame(KLD7Frame(
                timestamp=now + i * 0.03,
                tdat={"distance": 1.0, "speed": 5.0, "angle": 10.0 + i, "magnitude": 3000 + i * 100},
                pdat=[],
            ))
        assert len(tracker._ring_buffer) == 5

    def test_ring_buffer_max_size(self):
        tracker = self._make_tracker()
        tracker.max_buffer_frames = 10
        tracker._ring_buffer = __import__('collections').deque(maxlen=10)
        now = time.time()
        for i in range(20):
            tracker._add_frame(KLD7Frame(
                timestamp=now + i * 0.03,
                tdat={"distance": 1.0, "speed": 5.0, "angle": 0.0, "magnitude": 1000},
                pdat=[],
            ))
        assert len(tracker._ring_buffer) == 10

    def test_get_angle_finds_highest_magnitude_event(self):
        tracker = self._make_tracker(orientation="vertical")
        now = time.time()
        # Background noise frames (no detections)
        for i in range(10):
            tracker._add_frame(KLD7Frame(
                timestamp=now + i * 0.03,
                tdat=None,
                pdat=[],
            ))
        # Ball pass: 3 frames with high magnitude at angle ~15°
        for i in range(3):
            tracker._add_frame(KLD7Frame(
                timestamp=now + 0.30 + i * 0.03,
                tdat={"distance": 2.0, "speed": 50.0, "angle": 14.0 + i, "magnitude": 5000 + i * 100},
                pdat=[{"distance": 2.0, "speed": 50.0, "angle": 14.0 + i, "magnitude": 5000 + i * 100}],
            ))
        # More noise after
        for i in range(5):
            tracker._add_frame(KLD7Frame(
                timestamp=now + 0.50 + i * 0.03,
                tdat=None,
                pdat=[],
            ))

        result = tracker.get_angle_for_shot()
        assert result is not None
        assert result.vertical_deg is not None
        assert 13.0 < result.vertical_deg < 17.0
        assert result.horizontal_deg is None
        assert result.num_frames == 3
        assert result.confidence > 0.0
        assert result.distance_m > 0.0

    def test_get_angle_returns_none_when_no_detections(self):
        tracker = self._make_tracker()
        now = time.time()
        for i in range(5):
            tracker._add_frame(KLD7Frame(timestamp=now + i * 0.03, tdat=None, pdat=[]))
        result = tracker.get_angle_for_shot()
        assert result is None

    def test_get_angle_horizontal_orientation(self):
        tracker = self._make_tracker(orientation="horizontal")
        now = time.time()
        tracker._add_frame(KLD7Frame(
            timestamp=now,
            tdat={"distance": 1.5, "speed": 30.0, "angle": -5.0, "magnitude": 4500},
            pdat=[{"distance": 1.5, "speed": 30.0, "angle": -5.0, "magnitude": 4500}],
        ))
        result = tracker.get_angle_for_shot()
        assert result is not None
        assert result.horizontal_deg is not None
        assert result.vertical_deg is None

    def test_reset_clears_buffer(self):
        tracker = self._make_tracker()
        tracker._add_frame(KLD7Frame(timestamp=time.time(), tdat={"distance": 1.0, "speed": 5.0, "angle": 0.0, "magnitude": 3000}, pdat=[]))
        assert len(tracker._ring_buffer) == 1
        tracker.reset()
        assert len(tracker._ring_buffer) == 0

    def test_prefers_pdat_over_tdat(self):
        """PDAT raw detections should be preferred for angle extraction."""
        tracker = self._make_tracker(orientation="vertical")
        now = time.time()
        # Frame with TDAT at 10° but PDAT at 20° (higher magnitude)
        tracker._add_frame(KLD7Frame(
            timestamp=now,
            tdat={"distance": 1.0, "speed": 5.0, "angle": 10.0, "magnitude": 3000},
            pdat=[{"distance": 1.5, "speed": 8.0, "angle": 20.0, "magnitude": 5000}],
        ))
        result = tracker.get_angle_for_shot()
        assert result is not None
        assert abs(result.vertical_deg - 20.0) < 1.0
