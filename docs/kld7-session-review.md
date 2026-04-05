# K-LD7 Session Review

This workflow is for reviewing a full `session_logs/session_*.jsonl` file after a K-LD7 tuning change.

It is intentionally an **offline empirical review tool**, not a live detector.

## What It Does

For each shot in a session log, the review script:

1. parses `rolling_buffer_capture`, `kld7_buffer`, and `shot_detected` rows by `shot_number`
2. re-detects likely club-impact anchors directly from the raw K-LD7 frame buffer
3. scores outward post-impact `pdat` paths by:
   - timing after impact
   - distance growth
   - angle continuity
   - magnitude strength
   - lingering-clutter penalties
4. keeps the best path per shot
5. exports per-shot and session-level plots

The result is a quick way to see whether a session contains real-looking ball-flight distance profiles or mostly clutter.

## Usage

Install analysis dependencies if needed:

```bash
uv pip install -e ".[analysis]"
```

Run the session review:

```bash
PYTHONPATH=src python scripts/review_kld7_session.py session_logs/session_20260403_133805_range.jsonl
```

If you want to remove previously generated files in the output directory first,
use `--clean`. Cleanup is intentionally restricted to directories that look like
`shots/session_review_*`.

```bash
PYTHONPATH=src python scripts/review_kld7_session.py session_logs/session_20260403_133805_range.jsonl --clean
```

Default output location:

```text
shots/session_review_session_20260403_133805_range/
```

That directory is ignored by git.

## Generated Files

- `shot_01_profile.png` ... `shot_N_profile.png`
- `all_shot_profiles_overlay.png`
- `launch_angle_review.png`
- `shot_profiles.csv`
- `summary.md`

## How To Read The Plots

Per-shot plot:

- gray points: all post-impact detections in the selected review window
- black connected line: the chosen coherent path
- orange dashed line: path angle trace
- green lower panel: path magnitude over time

Overlay plot:

- blue: stronger reviewed profiles
- orange: partial profiles
- red: weak/noisy profiles
- black line + gold band: median path and IQR across the session

## Interpretation Rules

Treat a shot as stronger evidence when it shows:

- multiple consecutive frames
- outward distance growth
- limited angle jump
- no obvious lingering return at the same far location afterward

Treat a shot as weak evidence when it:

- starts already deep in a far clutter band
- stays almost flat in distance
- shows only one noisy frame
- leaves obvious lingering returns after the burst

## Limits

- This is not a physics model.
- The inferred impact anchor is heuristic.
- The path angle trace is a secondary diagnostic, not ground truth.
- A single improved session supports further study, but does not by itself validate a K-LD7 tuning change.
