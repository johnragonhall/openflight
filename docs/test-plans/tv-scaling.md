# Test Plan - TV Scaling (7″ kiosk → 98″ / 8K)

Verifies the UI scales legibly from the 7″ Pi touchscreen to a 98″ 8K TV. The
scale is driven by a resolution-keyed pixel ramp (`--t-*` tokens in
[tokens.css](../../ui/src/tokens.css), with an `@media (min-width: 7680px)` 8K
step), a fluid root font clamp, and the `.tv` class
([ViewModeProvider.tsx](../../ui/src/state/ViewModeProvider.tsx) applies it for Interactive mode, `.tv` rules in
[index.css](../../ui/src/index.css) and [Scoreboard.css](../../ui/src/components/Scoreboard.css)).
This is **resolution-driven**, so it can only be judged on screens of the actual sizes/resolutions.

## What you need
Screens (or a browser that can emulate exact resolutions) at: the **7″ kiosk
(800×480)**, **1080p**, **1440p**, **4K (3840)**, and ideally a real **8K (7680)**
panel - and physically a **large TV** to judge legibility "across the room".

## Test cases

### TC-SCALE-01 - 7″ kiosk stays compact
**Steps:** On the 800×480 kiosk display, view `/` and the live shot view.
**PASS:** The quad stats, gauges, and metric cards fit without clipping or scrolling; text is compact
but readable up close.
**FAIL artifacts:** photo; mark any overflow/clipping.

### TC-SCALE-02 - Ramp steps up by resolution
**Steps:** View the live shot view at 1080p, 1440p, 4K (and 8K if available). At each, compare metric sizes.
**PASS:** Metric/gauge/label sizes **increase** at each step (per the `--t-*` ramp); layouts stay intact
(no overflow); on 8K everything is large enough to read across a room.
**FAIL artifacts:** photos at each resolution side by side; note any step where text didn't grow or a layout broke.

### TC-SCALE-03 - `.tv` mode on the scoreboard
**Steps:** Open `/scoreboard?tv=1` on the TV.
**PASS:** Safe-zone insets (5%) keep content off the bezel; the club title + metric values are large;
focus rings/touch targets are enlarged; backdrop blur is dropped on the constrained GPU.
**FAIL artifacts:** photo from ~3 m; note unreadable text or content lost to overscan.

### TC-SCALE-04 - Legibility at distance (the demo case)
**Steps:** On the 98″ (or largest) TV at the intended viewing distance (2.5–4 m), read each metric aloud without squinting.
**PASS:** Club name, carry/total, gauges, and all metric values are comfortably readable at distance.
**FAIL artifacts:** photo from the viewing position; list any element too small.

### TC-SCALE-05 - Responsive breakpoints (tablet / monitor)
**Steps:** View `/scoreboard` on a tablet (portrait and landscape) and a regular monitor.
**PASS:** At ≤1100px the hero collapses to one column with a 16:9 camera area and the page scrolls; at
≤700px the grids go single-column; the Settings gear is an easy touch target (~44px).
**FAIL artifacts:** screenshots at each width; mark any cramped/overlapping layout or too-small tap target.

### TC-SCALE-06 - `?tv=1` on a non-TV monitor (expectation check)
**Steps:** Open `/?tv=1` on a regular 1080p monitor.
**PASS:** TV-mode tweaks apply (focus ring, touch sizes), but the *large* scaling is driven by actual
resolution - so it looks like a 1080p screen, **not** like the 98″. (Confirms scaling is resolution-based, by design.)
**FAIL artifacts:** only if it behaves unexpectedly vs this description.

## Artifacts to attach
Photos at each resolution/size (ideally the same screen content for comparison), the exact resolution
of each screen, and a from-the-couch photo for the legibility case.
