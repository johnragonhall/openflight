# Test Plan - HDMI-CEC Remote Bridge

Verifies that the **TV's own remote** drives kiosk focus over HDMI-CEC:
`TV remote → HDMI-CEC bus → cec_remote.py (libcec callback) → ydotool key → Chromium → useSpatialNavigation`.

Code under test: [scripts/tv-remote/cec_remote.py](../../scripts/tv-remote/cec_remote.py),
[openflight-cec.service](../../scripts/tv-remote/openflight-cec.service). Setup guide:
[tv-remote-control.md](../tv-remote-control.md). Highest-risk unknown: the libcec
**keypress callback signature** (`cec_remote.py` reads `args[-2], args[-1]`) and
Pi 5 CEC support - both can only be confirmed on-device.

## What you need
- Raspberry Pi 5 driving a **CEC-capable TV over HDMI** (not DisplayPort - DP has no CEC).
- The **TV's own remote**.
- Packages: `sudo apt install cec-utils python3-cec ydotool`.
- `ydotoold` running with uinput access; the CEC service installed (see setup guide).
- Kiosk launched in **TV mode**: `http://<pi-ip>:8080/?tv=1`.
- **CEC enabled on the TV** (brand names): Samsung **Anynet+**, LG **SimpLink**,
  Sony **Bravia Sync**, Philips **EasyLink**, Panasonic **VIERA Link**, Vizio/TCL/Hisense **CEC**.

## Setup & pre-checks
1. Enable CEC on the TV; confirm the HDMI input the Pi uses passes CEC (some sets only do CEC on one port).
2. `cec-client -l` → an adapter is listed.
3. `echo 'scan' | cec-client -s -d 1` → the **TV appears** in the device list.
4. `sudo systemctl enable --now ydotool` (or run `ydotoold`); `systemctl status ydotool` is active.
5. Install + start the bridge, then watch it: `journalctl -u openflight-cec -f`.
6. For signature debugging, temporarily set the logger to DEBUG so `args=…` lines print on each press.

## Test cases

### TC-CEC-01 - CEC bus detects the TV
**Steps:** Run the `scan` command above.
**PASS:** The TV is listed with a logical address and OSD name.
**FAIL artifacts:** full `cec-client -s` output; TV CEC setting screen photo; HDMI port #.

### TC-CEC-02 - Bridge receives keypress events
**Steps:** With `journalctl -u openflight-cec -f` open and logger at DEBUG, press **Up** on the TV remote.
**PASS:** A `CEC keypress callback args=…` line appears within ~1 s of the press.
**FAIL artifacts:** the journal tail (or its silence), the exact remote button pressed, repro rate.
> If **nothing** logs: the callback isn't firing → CEC not reaching the Pi (recheck TC-CEC-01 / TV port / CEC enabled).

### TC-CEC-03 - Callback signature maps correctly
**Steps:** Read the `args=…` payload logged in TC-CEC-02 for each of Up/Down/Left/Right/OK/Back.
**PASS:** The last two args are `(keycode, duration)`; the keycode matches the HDMI-CEC user-control
code the bridge maps (`0x01 Up, 0x02 Down, 0x03 Left, 0x04 Right, 0x00 Select, 0x0D Exit`). The
mapped key fires only on the **press** edge (`duration == 0`), not twice.
**FAIL artifacts:** the raw `args=` tuples for every button. *This is the most likely real defect* -
if the tuple order differs on your libcec build, capture it so the `_on_keypress` slice can be fixed.

### TC-CEC-04 - Arrows move focus
**Steps:** With the kiosk at `/?tv=1` and a visible gold focus ring on some control, press Up/Down/Left/Right.
**PASS:** Focus moves to the nearest control in the pressed direction each press; the ring is clearly
visible across the room; one press = one move (no overshoot).
**FAIL artifacts:** screen recording showing the press → focus result; note if focus moves the wrong
direction, jumps multiple cells (debounce/repeat), or doesn't move (ring invisible → see spatial-navigation.md).

### TC-CEC-05 - OK activates, Back dismisses
**Steps:** Focus the Settings gear, press **OK**. With Settings open, press **Back**.
**PASS:** OK opens Settings; Back closes it (clicks the panel's `[data-modal-dismiss]`).
**FAIL artifacts:** recording; note whether OK did nothing (focus was on `<body>`) or activated the wrong control.

### TC-CEC-06 - ydotool actually injects
**Steps:** If TC-CEC-02 logs keypresses but TC-CEC-04 shows no focus movement, check the journal for `ydotool exit …` warnings.
**PASS:** No `ydotool exit` warnings; keys reach Chromium.
**FAIL artifacts:** the `ydotool exit <code> … : <stderr>` lines; `systemctl status ydotool`; the
`YDOTOOL_SOCKET` value in the service unit vs the running `ydotoold`.

### TC-CEC-07 - Debounce (held / double events)
**Steps:** Single, deliberate presses ×5; then press-and-hold a direction briefly.
**PASS:** Each discrete press = exactly one focus move; a brief hold does not stride many cells.
**FAIL artifacts:** recording with a visible clock; count of moves per press.

### TC-CEC-08 - Service lifecycle
**Steps:** Reboot the Pi. After boot, press an arrow. Separately, restart the kiosk browser and press an arrow.
**PASS:** Remote works after a cold boot (service auto-starts) and still works after a kiosk restart
(service is independent).
**FAIL artifacts:** `systemctl status openflight-cec`; `journalctl -u openflight-cec -b`.

### TC-CEC-09 - DisplayPort negative check
**Steps:** Move the Pi to a **DisplayPort** display and start the service.
**PASS:** The service logs the clear "no CEC adapter - use FLIRC" error and exits cleanly (no crash loop).
**FAIL artifacts:** `journalctl -u openflight-cec`; confirm it didn't restart-loop silently.

## Artifacts to attach (this plan)
`journalctl -u openflight-cec` (DEBUG), the raw `args=` tuples, `cec-client` scan output,
`systemctl status` for `openflight-cec` and `ydotool`, and a screen recording of the press→focus behavior.
