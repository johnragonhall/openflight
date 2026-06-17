# Test Plan - No-Camera Display Visualizer (animation)

Verifies the camera-less `/scoreboard` visualization on real Pi/TV hardware: the
synchronized **trajectory arc sweep** + **dispersion slam**, reduce-motion,
low-power, and that the stacked charts **fit** the camera frame. The chart math
and current-club filter are **unit-tested**; the **animation timing, GPU
smoothness, and layout fit** need a real screen.

Code: [DisplayShotVisualizer.tsx](../../ui/src/components/DisplayShotVisualizer.tsx),
[clubCharts.tsx](../../ui/src/components/charts/clubCharts.tsx),
[clubCharts.css](../../ui/src/components/charts/clubCharts.css).

## What you need
- Pi driving a TV; `/scoreboard?tv=1` (also test `&lowpower=1`).
- The camera **off / unavailable** (so the visualizer replaces the camera frame).
- `--mock` + **Simulate Shot**, or a real session, to produce shots for a chosen club.

## Test cases

### TC-VIZ-01 - Visualizer replaces the camera frame
**Steps:** With the camera off, open `/scoreboard?tv=1`.
**PASS:** The camera area shows the **stacked** side-view trajectory (top) over the top-down dispersion
(bottom) - not a blank/"camera unavailable" box. The status pill reads camera unavailable.
**FAIL artifacts:** photo of the full display; confirm camera was actually off.

### TC-VIZ-02 - Current-club only
**Steps:** Log shots with **two different clubs** (e.g. driver then 7-iron), latest = 7-iron.
**PASS:** The charts plot **only the current (latest-shot) club's** shots, not the whole session.
**FAIL artifacts:** photo; note if other clubs' shots appear.

### TC-VIZ-03 - Synchronized shot-in animation
**Steps:** Simulate a shot and watch closely (record it).
**PASS:** On the new shot, the **trajectory arc sweeps left→right** (~1.2 s, cinematic) and the
**dispersion dot "slams" in** timed so it lands **as the arc reaches the ground** - both animations
**end together**. Motion is **smooth** (no stutter) on the Pi GPU.
**FAIL artifacts:** **slow-motion screen recording** (essential for timing); note if the dot appears too
early/late vs the arc, or if motion stutters/drops frames.

### TC-VIZ-04 - Reduce Motion
**Steps:** Open Settings → enable **Reduce Motion** → simulate a shot.
**PASS:** No sweep/slam - the new shot appears in its **final position instantly**; everything else still renders.
**FAIL artifacts:** recording showing motion still played (a11y regression - **Major**).

### TC-VIZ-05 - Low-power / weak GPU
**Steps:** Reload with `/scoreboard?tv=1&lowpower=1` (and/or test on the actual weak TV browser); simulate shots.
**PASS:** Animation remains smooth (it's compositor-only: stroke-dashoffset + transform); no jank even
while the Pi is busy processing the shot.
**FAIL artifacts:** recording; note CPU contention stutter at shot time.

### TC-VIZ-06 - Layout fit (no overflow / clipping)
**Steps:** View on the actual TV resolution; also check a portrait tablet at `/scoreboard`.
**PASS:** Both stacked charts fit the camera frame without clipping, overlap, or scrollbars; titles + any
"needs K-LD7 / default angle" notes are legible.
**FAIL artifacts:** photos at each resolution; mark any clipped/overlapping chart.

### TC-VIZ-07 - Camera-comes-back handoff
**Steps:** With the visualizer showing, enable the camera + start streaming.
**PASS:** The frame switches to the live camera; switching back (camera off) restores the visualizer
without layout breakage.
**FAIL artifacts:** recording of both transitions.

## Artifacts to attach
Slow-motion recording of TC-VIZ-03 (with a visible clock), photos at each tested resolution, and the
exact URL/flags used.
