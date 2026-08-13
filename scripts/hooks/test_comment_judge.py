#!/usr/bin/env python3
"""Self-check for comment_judge.py's timeout path: proves a judge process
that spawns a pipe-inheriting child gets tree-killed within the budget
instead of hanging communicate() forever (the 2026-07-22 pre-commit hang).
Run directly: python scripts/hooks/test_comment_judge.py
"""
import os
import sys
import time

os.environ["HUMANIZER_JUDGE_TIMEOUT"] = "3"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comment_judge  # noqa: E402  (env must be set before import)

HANG_PARENT = (
    "import subprocess, sys, time; "
    "subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)']); "
    "time.sleep(60)"
)


def test_timeout_kills_tree():
    start = time.monotonic()
    try:
        comment_judge.run_judge("x", argv=[sys.executable, "-c", HANG_PARENT])
    except RuntimeError as e:
        elapsed = time.monotonic() - start
        assert "timed out" in str(e), f"wrong error: {e}"
        assert elapsed < 20, f"tree-kill did not unblock communicate(): {elapsed:.0f}s"
        return
    raise AssertionError("expected RuntimeError on timeout")


def test_extract_json():
    got = comment_judge.extract_json('noise {"violations": []} trailing')
    assert got == {"violations": []}


if __name__ == "__main__":
    test_extract_json()
    test_timeout_kills_tree()
    print("comment_judge self-check: 2/2 passed")
