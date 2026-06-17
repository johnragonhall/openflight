# Test Plan - GPIO IR Receiver (`ir-keytable`)

Verifies the budget IR path: an IR remote → **GPIO IR receiver** (e.g.
TSOP38238) → kernel `gpio-ir` decoder → `ir-keytable` keymap → input keystrokes
→ Chromium → `useSpatialNavigation`. Same brand-agnostic result as FLIRC, no USB
dongle, but needs kernel-overlay + keymap config. Reference:
[tv-remote-control.md → Path 4](../tv-remote-control.md).

## What you need
- Pi with an **IR receiver wired to a GPIO pin** (3.3 V / GND / signal).
- Any IR remote.
- `sudo apt install ir-keytable`.
- The `gpio-ir` overlay enabled in `/boot/firmware/config.txt`, e.g.
  `dtoverlay=gpio-ir,gpio_pin=17` (use your wiring pin), then reboot.
- Kiosk in TV mode: `http://<pi-ip>:8080/?tv=1`.

## Setup
1. After reboot, `ir-keytable` lists a `gpio_ir_recv` device (note the `/dev/lircN` / `rcN`).
2. `sudo ir-keytable -t` and press buttons → scancodes + decoded protocol print.
3. Author `/etc/rc_keymaps/openflight.toml` mapping those scancodes to
   `KEY_UP/DOWN/LEFT/RIGHT/ENTER/ESC` (template in the setup guide).
4. `sudo ir-keytable -w /etc/rc_keymaps/openflight.toml` (and persist it for boot).

## Test cases

### TC-GPIO-01 - Receiver enumerates
**Steps:** `ir-keytable` (no args) after reboot.
**PASS:** A GPIO IR receiver device is listed with its protocols.
**FAIL artifacts:** `ir-keytable` output; the `config.txt` overlay line; `dmesg | grep -i ir`; wiring photo (pin used).

### TC-GPIO-02 - Scancodes decode
**Steps:** `sudo ir-keytable -t`; press Up/Down/Left/Right/OK/Back.
**PASS:** Each press prints a stable scancode and a decoded protocol (nec/rc5/…). The same button
yields the same scancode every time.
**FAIL artifacts:** the `-t` transcript with the scancode per button; note any button that doesn't decode or is unstable.

### TC-GPIO-03 - Keymap applies
**Steps:** Load the keymap (`-w`), then `sudo ir-keytable -t` again (or check `evtest`).
**PASS:** Pressing the remote now emits the mapped `KEY_*` events (not raw scancodes).
**FAIL artifacts:** the `.toml`; `ir-keytable -r` (read current map) output; `-t` showing the key names.

### TC-GPIO-04 - Arrows move kiosk focus
**Steps:** At `/?tv=1`, press the four directions, then OK and Back.
**PASS:** Focus moves correctly; OK activates; Back dismisses dialogs.
**FAIL artifacts:** recording; if keys decode (TC-GPIO-03) but focus doesn't move, it's TV-mode/focus, not IR.

### TC-GPIO-05 - Persists across reboot
**Steps:** Reboot; press an arrow.
**PASS:** The keymap is reapplied automatically and the remote still works.
**FAIL artifacts:** how the keymap is persisted (systemd / `/etc/rc_keymaps` + `rc_maps.cfg`); `ir-keytable -r` after boot.

## Artifacts to attach
`ir-keytable` device list, the `-t` scancode transcript per button, the `.toml` keymap,
the `config.txt` overlay line, and a recording of press→focus.
