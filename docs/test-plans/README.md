# Hardware / Software Manual Test Plans

These features depend on **physical hardware** (TVs, remotes, IR/CEC buses, the
Raspberry Pi GPU, screen-reader software) and therefore **cannot be covered by
the automated suite** (`vitest`, `pytest`). The pure logic underneath each one
*is* unit-tested; these documents verify the parts that only a real device can
prove.

Each plan states, for every check: **what you need**, **the exact steps**,
**what success looks like**, and **how to record a failure**.

---

## Index

| Plan | Verifies | Needs |
|------|----------|-------|
| [tv-remote-cec.md](tv-remote-cec.md) | HDMI-CEC remote → focus moves | Pi + CEC TV + its remote |
| [tv-remote-flirc.md](tv-remote-flirc.md) | FLIRC USB-IR remote → keystrokes | Pi + FLIRC dongle + any IR remote |
| [tv-remote-gpio-ir.md](tv-remote-gpio-ir.md) | GPIO IR receiver → `ir-keytable` keys | Pi + IR receiver on GPIO |
| [tv-remote-bluetooth.md](tv-remote-bluetooth.md) | Bluetooth HID remote → keys | Pi + BT remote/air-mouse |
| [web-remote.md](web-remote.md) | Phone `/remote` D-pad drives the display | Display + a phone on the LAN |
| [spatial-navigation.md](spatial-navigation.md) | The focus engine on a real TV (+ native smart-TV browser) | A TV / 10-foot screen |
| [screen-reader-voiceover.md](screen-reader-voiceover.md) | VoiceOver / TalkBack / desktop SR experience | A device with a screen reader |
| [display-visualizer.md](display-visualizer.md) | No-camera animated trajectory/dispersion on the Pi/TV | Pi + TV, camera off |
| [view-mode-selection.md](view-mode-selection.md) | Interactive/Scoreboard auto-detect + chooser + live switch | Pi + a TV and a monitor |
| [tv-scaling.md](tv-scaling.md) | 7″ kiosk → 98″/8K scaling | Screens at several resolutions |
| [camera-stream.md](camera-stream.md) | MJPEG camera on a localhost-driven TV (token wiring) | Pi + camera + HDMI TV |

---

## Reference test rig

A full pass exercises everything; partial rigs run the subset they can.

**Core**
- Raspberry Pi 5 running the production image, app launched via `scripts/start-kiosk.sh`.
- A **CEC-capable TV** over **HDMI** (note brand + model + firmware).
- A **DisplayPort** monitor or TV (for the "no CEC" paths).
- The TV's **own remote**, plus at least one **universal IR remote**.

**Add-ons (per plan)**
- **FLIRC** USB receiver.
- A **GPIO IR receiver** (e.g. TSOP38238) wired to a GPIO pin.
- A **Bluetooth** remote / air-mouse.
- A **phone** (iOS + Android if possible) on the same LAN.
- A **second screen** for `/scoreboard` separate from the kiosk.

**Software on the Pi (install per plan):** `cec-utils`, `python3-cec`,
`ydotool` (+ `ydotoold`), `ir-keytable`, `flirc`, `bluez`/`bluetoothctl`.

---

## Launching the app for tests

| Surface | URL |
|---------|-----|
| Kiosk (interactive) | `http://<pi-ip>:8080/` |
| Kiosk in **TV mode** (D-pad nav + 10-foot scale ON) | `http://<pi-ip>:8080/?tv=1` |
| Passive scoreboard | `http://<pi-ip>:8080/scoreboard` |
| Scoreboard in TV mode | `http://<pi-ip>:8080/scoreboard?tv=1` |
| Phone web-remote | `http://<pi-ip>:8080/remote` |
| Force GPU low-power | append `&lowpower=1` |

> **Critical:** D-pad / remote navigation and the 10-foot focus ring are only
> active when the page is in **TV mode** - a TV-class user-agent (Samsung
> Tizen / LG webOS) **or** the `?tv=1` query. A plain Pi/Chromium kiosk is
> neither, so for remote tests you **must** use `?tv=1`. If nav "does nothing,"
> check this first.

Use `--mock` (`scripts/start-kiosk.sh --mock`) and the kiosk's **Simulate Shot**
button to produce shots without hitting balls.

---

## Conventions

- **Test IDs:** `TC-<AREA>-NN` (e.g. `TC-CEC-03`). Quote the ID in any bug report.
- **Severity:** **Blocker** (feature unusable) · **Major** (core path broken) ·
  **Minor** (degraded) · **Cosmetic**.
- **Result:** `PASS` / `FAIL` / `BLOCKED` (couldn't run) / `N/A`.
- Always capture the **build**: `git rev-parse --short HEAD` (or note "uncommitted
  working tree + date") and the **UI build** (`ui/dist` hash from the build log).

---

## Recording a failure

When any check does not meet its success criteria, copy this block into the
results log (or a GitHub issue) and fill every field. **A failure with no logs
is not actionable** - attach the artifacts each plan names.

```
### FAIL - <TC-ID> <short title>
- Date / tester:
- Build / commit:           # git short SHA or "uncommitted YYYY-MM-DD"
- Severity:                 # Blocker | Major | Minor | Cosmetic
- Repro rate:               # e.g. 5/5, intermittent 2/5

Environment
- Pi model / OS:            # e.g. Pi 5, Raspberry Pi OS Bookworm 64-bit, kernel x
- Display: brand / model / firmware / connection (HDMI port # | DisplayPort)
- Input device: brand / model (remote, FLIRC, BT MAC, phone OS+browser)
- App URL used:             # include ?tv=1 / ?lowpower=1 as launched
- Relevant package versions: # cec-utils, python3-cec, ydotool, ir-keytable, browser

Steps to reproduce
1.
2.
3.

Expected (per success criteria):
Actual:

Attached artifacts  (see the plan's "Artifacts to attach" list)
- [ ] journalctl / service logs
- [ ] tool output (cec-client, ir-keytable -t, flirc_util, bluetoothctl)
- [ ] browser console + Network (F12) export
- [ ] photo or screen recording (essential for focus/animation/SR issues)
- [ ] timestamps correlating the input press to the log line

Notes / hypotheses:
```

### Results log

Keep a running table per test session:

| TC-ID | Result | Severity | Tester | Build | Notes / issue link |
|-------|--------|----------|--------|-------|--------------------|
| | | | | | |

> For **intermittent** failures, record the repro rate and attach a screen
> recording with a visible clock - timing bugs (animation, debounce, key-repeat,
> live-region announcements) are unreviewable without it.
