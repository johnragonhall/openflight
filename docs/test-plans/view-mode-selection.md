# Test Plan - View-Mode Selection (auto-detect + chooser + switch)

Verifies how a screen picks **Interactive** vs **Scoreboard** mode: the
`start-kiosk.sh` EDID/CEC **auto-detection**, the **first-run chooser** (shown on
larger external screens only - the 7" kiosk panel defaults to Interactive), the
**persisted choice**, and the **live Settings switch**. The pure logic
(`hintMode`, `readSavedMode`, `suggestedViewMode`, the chooser render) is
**unit-tested**; this plan covers on-device detection and the end-to-end
live-switch behavior.

Code: [viewMode.ts](../../ui/src/state/viewMode.ts),
[ViewModeChooser.tsx](../../ui/src/components/ViewModeChooser.tsx),
[displayDetect.ts](../../ui/src/state/displayDetect.ts) (`suggestedViewMode`, `isSmallKioskScreen`),
[ViewModeProvider.tsx](../../ui/src/state/ViewModeProvider.tsx) (live mode + `tv`/`low-power` classes),
detection in [start-kiosk.sh](../../scripts/start-kiosk.sh) (`detect_view_hint`).

## What you need
- Pi + a **TV (HDMI/CEC)** and a **monitor** (HDMI or DP) to compare detection.
- `cec-utils` and `edid-decode` installed (for detection): `sudo apt install cec-utils edid-decode`.
- A way to clear the saved choice between runs: in the kiosk browser console
  `localStorage.removeItem('openflight.viewMode')` then reload (or use a fresh profile/incognito).

## Test cases

### TC-VM-01 - Auto-detect picks Interactive on a TV
**Steps:** On the Pi driving a **TV**, run `scripts/start-kiosk.sh` and read the log line `View auto-detect → …`.
**PASS:** It logs `→ interactive`, and the kiosk URL gains `&viewmode=interactive`.
**FAIL artifacts:** the start-kiosk log; `echo scan | cec-client -s -d 1` output; `edid-decode /sys/class/drm/card*-HDMI-A-*/edid | grep -i 'maximum image size'`.

### TC-VM-02 - Auto-detect picks Scoreboard on a monitor
**Steps:** Repeat on a **monitor** (no CEC, small EDID size).
**PASS:** Logs `→ scoreboard`; URL gains `&viewmode=scoreboard`.
**FAIL artifacts:** start-kiosk log; the EDID size line; whether the monitor unexpectedly answered CEC.

### TC-VM-03 - First-run chooser appears & pre-highlights the detection
**Steps:** Clear the saved mode, load the kiosk **on a larger external screen**.
**PASS:** A full-screen **"How are you using this screen?"** chooser shows two options
(**Interactive** / **Scoreboard**); the auto-detected one carries a **"Detected"** badge and is focused.
**FAIL artifacts:** screenshot; the `?viewmode` in the URL; note if no chooser appeared (a mode was already saved?) or the wrong option was badged.

### TC-VM-04 - 7" kiosk panel skips the chooser
**Steps:** Clear the saved mode and load on the built-in **7" 1024×600** panel.
**PASS:** No chooser appears; the panel goes straight to **Interactive** (it's the operator's control surface).
**FAIL artifacts:** screenshot; `window.screen.width`/`height`; note if the chooser appeared anyway.

### TC-VM-05 - Choice persists across reboot
**Steps:** Pick **Interactive**; confirm the app shows Interactive (scaled UI, focus ring, remote works). Reboot the Pi.
**PASS:** After reboot the chooser does **not** reappear and the app is Interactive - even though `start-kiosk`
still passes a hint, the **saved choice wins**.
**FAIL artifacts:** recording of the load; `localStorage` value; note if the chooser reappeared.

### TC-VM-06 - Detection wrong → user corrects, sticks
**Steps:** On a screen the detector gets wrong (e.g. a large monitor detected as a TV, or a TV missed),
pick the **opposite** option in the chooser.
**PASS:** The app shows the chosen mode and stays there on subsequent loads (the wrong hint does
not override the saved choice).
**FAIL artifacts:** recording; note if the hint kept fighting the saved choice on reload.

### TC-VM-07 - Switch in Settings is LIVE (no reload)
**Steps:** In a chosen device, open Settings → **View mode**, toggle **Interactive mode** off (or on).
**PASS:** The UI switches between Interactive and Scoreboard **immediately, without a page reload**; keyboard/remote
focus is preserved (WCAG 3.2.2); a screen reader hears "Interactive mode" / "Scoreboard mode"; the choice persists.
**FAIL artifacts:** recording; note any full-page reload, lost focus, or a state mismatch.

### TC-VM-08 - `--interactive` / `--scoreboard` / `--no-view-detect` overrides
**Steps:** Launch with each flag in turn (after clearing the saved mode so the hint is used).
Also verify the `--tv` / `--monitor` aliases.
**PASS:** `--interactive` (or `--tv`) → chooser pre-highlights Interactive; `--scoreboard` (or `--monitor`) →
Scoreboard; `--no-view-detect` → no hint (chooser falls back to UA, defaults to Scoreboard on a Pi).
**FAIL artifacts:** the start-kiosk log + resulting URL for each flag.

### TC-VM-09 - Chooser operable by the actual input
**Steps:** On a **TV**, operate the chooser with the **remote** (D-pad + OK). On a monitor, use touch/mouse.
**PASS:** The chooser is operable by whatever input the screen has; the focused option shows a visible ring;
arrow keys move between **Interactive** and **Scoreboard** even before a mode is chosen.
**FAIL artifacts:** recording; **important edge:** if a TV is mis-detected as *Scoreboard*, can the **remote**
still pick Interactive? Capture this - the chooser carries its own arrow-key handler + focus ring so it must.

### TC-VM-10 - Phone /remote never shows the chooser
**Steps:** Open `/remote` on a phone (a fresh one with no saved mode).
**PASS:** The phone shows the D-pad remote, **not** the chooser (it's a controller, not a display).
**FAIL artifacts:** phone screenshot.

### TC-VM-11 - `/scoreboard` route is always the scoreboard
**Steps:** On a fresh device (no saved mode), open `http://<pi-ip>:8080/scoreboard` directly.
**PASS:** The passive scoreboard renders immediately - **no chooser** (the dedicated route is for an unattended
second screen, so it never gates on the first-run pick).
**FAIL artifacts:** screenshot; note if the chooser appeared.

## Artifacts to attach
The `start-kiosk` `View auto-detect →` log, `cec-client` scan + `edid-decode` output for each screen,
the kiosk URL (`?viewmode=…`), the `localStorage` value, and screen recordings of the chooser + the live Settings switch.
