# Test Plan - Spatial D-pad Navigation (real TV)

Verifies the focus engine ([useSpatialNavigation.ts](../../ui/src/state/useSpatialNavigation.ts))
on real hardware. The geometry (`pickInDirection`, `isInViewport`) and the
imperative functions (`navigate`, `activateFocused`, `dismissTopModal`) are
**unit-tested**; this plan covers what jsdom can't: the **visible focus ring**,
**real layout geometry**, **scrolling**, **modal trapping**, and the **native
smart-TV browser** path (where the TV's own remote produces real arrow keydowns).

Applies to any directional input (CEC, FLIRC, GPIO-IR, Bluetooth, web-remote) -
they all funnel through this engine. Run this once the input layer is proven.

## What you need
- A **TV / 10-foot screen** showing the kiosk in TV mode: `/?tv=1` (and `/scoreboard?tv=1`).
- A working directional input (any from the other plans, or a USB keyboard's arrows for a baseline).
- For the native path: a **Samsung Tizen / LG webOS / Android TV** built-in browser pointed at the Pi's URL.

## Test cases

### TC-NAV-01 - Focus is always visible
**Steps:** Press any arrow.
**PASS:** The focused control shows a clear **gold ring** (outline + glow) readable across the room.
The ring shows on **every** programmatic focus move (not just after a physical key) - `.tv` mode
forces it on, bypassing the `:focus-visible` heuristic.
**FAIL artifacts:** photo from ~3 m; note any control that takes focus with **no** visible ring (WCAG 2.4.7 - **Major**).

### TC-NAV-02 - Directional correctness
**Steps:** From a known control, press Right, then Left, Up, Down; traverse the whole header/nav/grid.
**PASS:** Focus lands on the nearest control in the pressed direction; every interactive control is
reachable; no control is "stuck" or unreachable.
**FAIL artifacts:** recording of the traversal; list any control you can't reach or that jumps to a far/wrong element.

### TC-NAV-03 - Edge behaviour (no page scroll)
**Steps:** Drive focus to the last control on an edge, then press further in that direction.
**PASS:** Focus stays put and the **page does not scroll** out from under you (arrows are consumed).
**FAIL artifacts:** recording; note any page scroll-jump.

### TC-NAV-04 - Scroll-into-view for off-screen targets
**Steps:** On a long view (e.g. History/Stats at `/?tv=1`), press Down past the last on-screen control.
**PASS:** Focus steps to the next control below the fold and the view **scrolls it into view**.
**FAIL artifacts:** recording; note if focus dead-ends at the last visible control (off-screen unreachable).

### TC-NAV-05 - Initial / on-view-entry focus (no stranding)
**Steps:** Cold-load `/?tv=1`. Then switch tabs (Live → Stats → History). Then dismiss the club-select interstitial.
**PASS:** On load and after each view change, focus lands on a sensible control (active nav tab or first
control) - pressing a direction immediately works; the remote is never "dead" waiting for a blind first press.
**FAIL artifacts:** recording; note any moment where an arrow press did nothing until a second press.

### TC-NAV-06 - Modal focus trap
**Steps:** Open Settings (gear → OK). Try to navigate (arrows) and Tab out of the panel.
**PASS:** Focus stays **inside** the open panel; arrows don't reach controls behind it; Tab wraps within
it; Back/Escape closes it. Critically, with Settings **closed**, the D-pad is **not** trapped in the
(hidden) panel - you can reach the rest of the UI.
**FAIL artifacts:** recording; **Major** if focus escapes an open dialog, or if the *closed* panel traps the D-pad.

### TC-NAV-07 - Key-repeat / hold
**Steps:** Press-and-hold a direction for ~2 s.
**PASS:** Focus moves **once** (held repeats are ignored) - no runaway overshoot across the grid.
**FAIL artifacts:** recording with a clock; count moves per hold.

### TC-NAV-08 - Native smart-TV browser (zero bridge)
**Steps:** On a Samsung/LG/Android-TV **built-in browser**, open the Pi URL (TV UA auto-enables TV mode).
Drive with the **TV's own remote** (no CEC/FLIRC/phone).
**PASS:** The remote's D-pad moves focus and OK activates natively (the browser maps D-pad→arrow keys,
OK→Enter); 10-foot scaling + focus ring are active.
**FAIL artifacts:** TV brand/model/browser version; recording; note if arrows/OK don't register (some TV
browsers send non-standard keycodes - capture them via a temporary `keydown` logger).

### TC-NAV-09 - Text-entry guard
**Steps:** If any view has a text field / native `<select>` (e.g. language dropdown), focus it and press arrows.
**PASS:** Arrows operate the control (move caret / change option), **not** spatial focus - the engine
yields to text entry.
**FAIL artifacts:** recording; note if spatial nav hijacked a field's arrows.

## Artifacts to attach
3 m photos of the focus ring, screen recordings of each traversal/trap/scroll case, and (for TC-NAV-08)
the TV browser identity + any non-standard keycodes.
