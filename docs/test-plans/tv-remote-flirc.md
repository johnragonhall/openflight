# Test Plan - FLIRC USB-IR Remote

Verifies the brand-agnostic IR path: any IR remote → **FLIRC USB dongle** (acts
as a USB keyboard) → Chromium → `useSpatialNavigation`. No CEC, no `ydotool` -
FLIRC *is* a keyboard. Works on HDMI **or** DisplayPort.

Setup helper: [scripts/tv-remote/flirc_setup.sh](../../scripts/tv-remote/flirc_setup.sh).

## What you need
- Pi (any display connection) with a **FLIRC** dongle plugged into USB.
- Any **IR remote** (TV remote, universal remote, or media remote).
- `sudo apt install flirc` (or the official `.deb` from flirc.tv).
- Kiosk in **TV mode**: `http://<pi-ip>:8080/?tv=1`.

## Setup
1. `flirc_util version` confirms the dongle is detected.
2. Run `scripts/tv-remote/flirc_setup.sh`; when prompted, press the remote button for each of
   Up/Down/Left/Right/OK/Back (mapped to arrows/Enter/Escape).
3. `flirc_util settings` lists the six recorded mappings.

## Test cases

### TC-FLIRC-01 - Dongle enumerates as a keyboard
**Steps:** `flirc_util version`; optionally `cat /proc/bus/input/devices | grep -i flirc`.
**PASS:** FLIRC firmware version prints; it appears as an input/keyboard device.
**FAIL artifacts:** `flirc_util version` output; `lsusb`; `dmesg | tail` after plugging it in.

### TC-FLIRC-02 - All six buttons record
**Steps:** Run `flirc_setup.sh` end to end.
**PASS:** All six prompts accept a button with no "record failed"; `flirc_util settings` shows
`up/down/left/right/enter/escape` bound.
**FAIL artifacts:** the script transcript; `flirc_util settings`; note any button the dongle wouldn't learn (IR protocol unsupported?).

### TC-FLIRC-03 - Keys reach a text field
**Steps:** Focus any OS text field / terminal; press the recorded arrow/Enter/Esc buttons.
**PASS:** Arrow keys move the cursor, Enter/Esc behave as keys - proves FLIRC emits real keystrokes
independent of the app.
**FAIL artifacts:** which buttons produced nothing or the wrong key.

### TC-FLIRC-04 - Arrows move kiosk focus
**Steps:** At `/?tv=1`, press the four directions.
**PASS:** Focus moves to the nearest control each press, ring visible, one move per press.
**FAIL artifacts:** screen recording; if focus doesn't move but TC-FLIRC-03 passed, the issue is TV-mode/focus-ring (see spatial-navigation.md), not FLIRC.

### TC-FLIRC-05 - OK / Back
**Steps:** Focus Settings gear → OK; with Settings open → Back.
**PASS:** OK opens Settings, Back closes it.
**FAIL artifacts:** recording.

### TC-FLIRC-06 - DisplayPort
**Steps:** Repeat TC-FLIRC-04/05 with the Pi on a **DisplayPort** display.
**PASS:** Identical behavior (FLIRC is connection-independent) - this is the key DP win over CEC.
**FAIL artifacts:** note the DP display model.

## Artifacts to attach
`flirc_util version` + `settings`, the setup-script transcript, a recording of press→focus.
