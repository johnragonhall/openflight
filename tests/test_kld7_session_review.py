"""Tests for offline K-LD7 session review helpers."""

from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from kld7_session_review_lib import analyze_session, load_session
from review_kld7_session import ensure_output_dir


SESSION_PATH = (
    Path(__file__).parent.parent
    / "session_logs"
    / "session_20260403_133805_range.jsonl"
)
NO_KLD7_SESSION_PATH = (
    Path(__file__).parent.parent
    / "session_logs"
    / "session_20260310_150412_range.jsonl"
)


def test_load_session_indexes_shots():
    """Session loader should index the expected shot records."""
    session_meta, shots = load_session(SESSION_PATH)

    assert session_meta["type"] == "session_start"
    assert session_meta["mode"] == "rolling-buffer"
    assert len(shots) == 10
    assert sorted(shots) == list(range(1, 11))
    assert "buffer" in shots[1]
    assert "capture" in shots[1]
    assert "shot" in shots[1]


def test_analyze_session_finds_recoverable_profiles():
    """The angle-offset range session should yield multiple strong profiles."""
    _, results = analyze_session(SESSION_PATH)
    quality_by_shot = {result.shot_number: result.quality for result in results}

    assert len(results) == 10
    assert sum(result.quality == "strong" for result in results) >= 4
    assert quality_by_shot[2] == "strong"
    assert quality_by_shot[8] == "weak"


def test_analyze_session_rejects_logs_without_kld7_buffers():
    """Session review should fail clearly when the session has no K-LD7 buffers."""
    with pytest.raises(ValueError, match="no kld7_buffer entries"):
        analyze_session(NO_KLD7_SESSION_PATH)


def test_ensure_output_dir_requires_safe_clean_target(tmp_path):
    """Cleanup should be opt-in and reject unsafe directories."""
    unsafe_dir = tmp_path / "unsafe"
    unsafe_dir.mkdir()
    (unsafe_dir / "keep.txt").write_text("keep", encoding="utf-8")

    ensure_output_dir(unsafe_dir, clean=False)
    assert (unsafe_dir / "keep.txt").exists()

    with pytest.raises(ValueError, match="Refusing to clean unsafe output directory"):
        ensure_output_dir(unsafe_dir, clean=True)


def test_ensure_output_dir_cleans_safe_review_directory(tmp_path):
    """Cleanup should work for normal session review output directories."""
    safe_dir = tmp_path / "shots" / "session_review_example"
    safe_dir.mkdir(parents=True)
    stale_file = safe_dir / "stale.txt"
    stale_file.write_text("stale", encoding="utf-8")

    ensure_output_dir(safe_dir, clean=True)

    assert not stale_file.exists()
