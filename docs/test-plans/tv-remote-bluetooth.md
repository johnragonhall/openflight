# Test Plan - Bluetooth HID Remote / Air-Mouse

Verifies that a **Bluetooth HID** remote (or air-mouse) pairs to the Pi and
presents arrows/Enter as a normal keyboard - no bridge, no line-of-sight.
Reference: [tv-remote-control.md → Path 5](../tv-remote-control.md).

## What you need
- Pi with working Bluetooth (`bluez`), `bluetoothctl` available.
- A **Bluetooth remote / air-mouse** in HID-keyboard mode (many "Android TV" remotes).
- Kiosk in TV mode: `http://<pi-ip>:8080/?tv=1`.

## Setup
```
bluetoothctl
power on
agent on
scan on        # put the remote in pairing mode; note its MAC
pair <MAC>
trust <MAC>
connect <MAC>
```

## Test cases

### TC-BT-01 - Pair & connect
**Steps:** Run the pairing sequence above.
**PASS:** `bluetoothctl` shows the device `Paired: yes`, `Trusted: yes`, `Connected: yes`.
**FAIL artifacts:** the `bluetoothctl info <MAC>` output; `dmesg | grep -i blue`; the remote's mode (some have an HID-vs-proprietary toggle).

### TC-BT-02 - Presents as a keyboard
**Steps:** `cat /proc/bus/input/devices` (or `evtest`); focus an OS text field and press arrows/Enter.
**PASS:** The remote appears as an input device emitting `KEY_UP/DOWN/LEFT/RIGHT/ENTER`.
**FAIL artifacts:** the input-devices entry; which buttons emit nothing (proprietary buttons won't).

### TC-BT-03 - Arrows move kiosk focus
**Steps:** At `/?tv=1`, press the directions, OK, Back.
**PASS:** Focus moves correctly; OK activates; Back dismisses.
**FAIL artifacts:** recording; map which physical buttons correspond to arrows/Enter/Esc on this remote.

### TC-BT-04 - Reconnect after sleep / range
**Steps:** Let the remote idle until it sleeps (or walk it out of range and back); press a button.
**PASS:** It auto-reconnects (because `trust`ed) and resumes within a few seconds; no stale key burst.
**FAIL artifacts:** `bluetoothctl info` after the gap; time-to-reconnect; any repeated/stuck keys.

## Artifacts to attach
`bluetoothctl info <MAC>`, the input-devices entry, a button→key map for the specific remote,
and a recording of press→focus.
