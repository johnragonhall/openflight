# Test Plan - Phone/Tablet Web-Remote

Verifies the no-hardware, brand-independent fallback end-to-end on real devices:
phone `/remote` D-pad → `sendRemoteKey` → server `remote_key` relay
(re-broadcast) → display's `useRemoteKeyBridge` → `navigate()/activateFocused()/dismissTopModal()`.

The relay + route + click→key mapping are **unit-tested**; this plan covers the
**two-device round-trip + UX** that tests can't: real network, real touch, the
display actually moving.

Code: [RemoteControl.tsx](../../ui/src/components/RemoteControl.tsx),
[useSpatialNavigation.ts](../../ui/src/state/useSpatialNavigation.ts) (`useRemoteKeyBridge`),
server `remote_key` in [server.py](../../src/openflight/server.py).

## What you need
- A **display** in TV mode: `http://<pi-ip>:8080/scoreboard?tv=1` (or `/?tv=1`). **TV mode is required** - the bridge is gated on it.
- A **phone/tablet** on the same LAN, browser open to `http://<pi-ip>:8080/remote`.
- (Optional second device to confirm broadcast scope.)

## Test cases

### TC-WR-01 - Remote page loads & connects
**Steps:** Open `/remote` on the phone.
**PASS:** A D-pad (▲◀OK▶▼) + Back render; the status reads **"Connected"** within a couple seconds.
**FAIL artifacts:** phone screenshot; phone browser console (remote URL); confirm the Pi IP/port and same subnet.

### TC-WR-02 - D-pad moves display focus
**Steps:** With the display showing a visible focus ring, tap ▲/▼/◀/▶ on the phone.
**PASS:** Display focus moves in the tapped direction within ~1 s of each tap; ring clearly visible.
**FAIL artifacts:** **simultaneous recording of phone + display** (essential); display browser console;
note latency, wrong direction, or no movement.
> If nothing moves: confirm the display is in **TV mode** (`?tv=1`) - without it the bridge is inert. This is the #1 cause.

### TC-WR-03 - OK activates, Back dismisses
**Steps:** Move focus to the Settings gear, tap **OK**. With Settings open, tap **Back**.
**PASS:** OK opens Settings; Back closes it. (If nothing is focused yet, OK is a safe no-op - tap a direction first.)
**FAIL artifacts:** recording; note if OK did nothing (was anything focused?) or hit the wrong control.

### TC-WR-04 - Disconnected state disables the D-pad
**Steps:** Stop the server (or drop the phone's Wi-Fi) and watch the remote page.
**PASS:** Status flips to **"Connecting…"** and the D-pad buttons become **disabled** (greyed, not tappable).
**FAIL artifacts:** screenshot of the disabled state; note if buttons stayed active.

### TC-WR-05 - No stale key burst on reconnect
**Steps:** While disconnected (TC-WR-04), attempt to mash the (disabled) buttons; then restore the connection.
**PASS:** On reconnect, **no** queued/stale presses replay - the display does not suddenly jump several
cells. (Buttons being disabled while offline is what prevents this.)
**FAIL artifacts:** recording across the disconnect→reconnect window with a visible clock.

### TC-WR-06 - Cross-platform
**Steps:** Repeat TC-WR-02/03 on **iOS Safari** and **Android Chrome**.
**PASS:** Identical behavior on both; taps register on first touch (no 300 ms delay), no double-fire.
**FAIL artifacts:** per-OS notes; if a tap double-fires or lags, capture the device + browser version.

### TC-WR-07 - Back closes the shutdown dialog
**Steps:** On the display open the shutdown confirm (power button → confirm dialog); from the phone tap **Back**.
**PASS:** Back closes the shutdown dialog (it clicks the dialog's Cancel via `[data-modal-dismiss]`),
i.e. it does **not** confirm shutdown.
**FAIL artifacts:** recording; **Blocker** if Back ever *confirms* shutdown instead of cancelling.

### TC-WR-08 - Bounded blast radius (security sanity)
**Steps:** From the phone, rapidly drive focus around and tap OK on various controls; try to reach a destructive action.
**PASS:** OK only activates the focused control; destructive actions (shutdown) still require the
on-screen confirm whose focus defaults to Cancel - a single relayed OK cannot complete them.
**FAIL artifacts:** recording of any path that reached a destructive action without an explicit confirm.

## Artifacts to attach
Synchronized phone+display recording, both browsers' consoles, the `/remote` page screenshots
(connected + disabled states), and device/OS/browser versions.
