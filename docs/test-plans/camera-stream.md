# Test Plan - Camera Stream on a Localhost-Driven TV (token wiring)

Verifies the MJPEG camera feed on the `/scoreboard` scoreboard and the **camera
token** wiring added this session: the stream `<img>` mounts only when the
camera is live, and the token (delivered to **localhost** clients only) is
threaded `ScoreboardRoute → Scoreboard`. The token issuance + localhost gating are
exercised by `pytest`; this plan proves the **end-to-end MJPEG render** and the
**token availability** on a real Pi-driven TV vs a remote browser.

Code: [Scoreboard.tsx](../../ui/src/components/Scoreboard.tsx) (`cameraLive`,
`cameraStreamUrl`), `/camera/stream` + `admin_token` in
[server.py](../../src/openflight/server.py).

## What you need
- Pi with a working camera; `start-kiosk.sh` (camera enabled).
- **Two viewing contexts:** (a) the Pi driving the TV over **HDMI** (Chromium on the Pi = **localhost**
  client); (b) a **separate** laptop/TV browser hitting `http://<pi-ip>:8080/scoreboard` (**non-localhost**).

## Test cases

### TC-CAM-01 - Live stream renders (localhost / Pi-driven TV)
**Steps:** On the Pi's own Chromium at `/scoreboard?tv=1`, enable the camera + start streaming.
**PASS:** The live MJPEG video fills the camera frame (object-fit cover); the status pill shows camera
active; latency is reasonable.
**FAIL artifacts:** photo; browser console + Network tab showing the `/camera/stream?token=…` request
status; confirm camera enabled via `get_camera_status`.

### TC-CAM-02 - Token present on localhost
**Steps:** On the Pi-driven display, open devtools → Network → inspect the `camera/stream` request URL.
**PASS:** The URL includes `?token=<hex>` and returns 200 (streaming). (The token is emitted in
`admin_token` only to localhost socket peers.)
**FAIL artifacts:** the request URL (redact token) + status code; the socket `admin_token` payload presence.

### TC-CAM-03 - Remote browser: no token → graceful fallback (not a broken image)
**Steps:** On a **separate LAN device**, open `/scoreboard?tv=1` with the camera streaming.
**PASS:** The remote client has **no** camera token (by design - localhost-only), so the stream 401s and
the UI shows the **shot visualizer**, not a broken `<img>`. No console error storm.
**FAIL artifacts:** photo + console/Network from the remote device; note a broken-image icon or repeated 401 spam.

### TC-CAM-04 - Stream only opens when live (no always-on connection)
**Steps:** With the camera **off** (not streaming), open `/scoreboard` and watch the Network tab.
**PASS:** **No** request to `/camera/stream` is made while the camera is off (the `<img>` isn't mounted);
the visualizer shows instead. (Fixes the prior always-on MJPEG connection.)
**FAIL artifacts:** Network export showing any `/camera/stream` request while camera was off.

### TC-CAM-05 - Toggle handoff
**Steps:** Toggle camera off→on→off a few times from the kiosk/app.
**PASS:** The frame switches camera ↔ visualizer cleanly each time; no stuck frame, no leaked connection
(check Network: the stream request ends when toggled off).
**FAIL artifacts:** recording + Network timeline.

## Artifacts to attach
Network-tab exports (showing the `camera/stream` request, its token param redacted, and status),
console logs from both the localhost and the remote client, and photos of each state.
