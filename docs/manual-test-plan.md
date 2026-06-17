# Manual / Hardware-in-the-Loop Test Plan

This plan validates the parts of OpenFlight that cannot be exercised by automated tests because
they need real radar hardware, a wired sound trigger, BLE/Wi-Fi transports, a phone, the camera,
or SQLCipher on a real device. Follow it top-to-bottom to qualify a release.

## What is already automated (do not re-test here)

These are pure-logic / mocked tests. They cover math and parsing, not hardware or transport.

| Suite | Path | Covers |
|-------|------|--------|
| Python unit | `tests/` (pytest) | Ballistics, carry (`test_ballistics.py`, `test_launch_monitor.py`), rolling-buffer DSP on canned I/Q (`test_rolling_buffer.py`), K-LD7 geometry/RADC math (`test_kld7*.py`), Flask routes + Socket.IO with a mocked monitor (`test_server.py`), session JSONL (`test_session_logger.py`), Trackman compare (`test_compare_trackman.py`), camera frame plumbing (`test_camera.py`), `start-kiosk` arg parsing (`test_start_kiosk.py`). |
| Mobile unit | `mobile/__tests__/utils/`, `mobile/__tests__/types/` | HMAC-SHA256 vs RFC 4231 (`hmac.test.ts`), unit conversions, shot validation/stats, shot-shape derivation. |

Everything else -- radar I/Q from a real OPS243, the SEN-14262 trigger, K-LD7 angle radars, the
camera MJPEG feed, the BLE GATT link, the Wi-Fi Socket.IO link end to end, SQLCipher on a device,
and the kiosk-to-phone loop -- is **only** covered by the cases below.

Reference docs (do not duplicate them; link out):
[sound-trigger-wiring.md](sound-trigger-wiring.md),
[raspberry-pi-setup.md](raspberry-pi-setup.md),
[trackman-test-process.md](trackman-test-process.md),
[mobile-ble-protocol.md](mobile-ble-protocol.md),
[server-api.md](server-api.md),
[mobile-architecture.md](mobile-architecture.md),
[bag-database-schema.md](bag-database-schema.md),
[mobile-accessibility.md](mobile-accessibility.md).

## How to use this plan

1. Record the build under test once at the top of the run: kiosk commit (`git rev-parse --short HEAD`
   on the Pi), mobile build (APK/IPA version + commit), and the `scripts/start-kiosk.sh` flags used.
2. Walk the cases in order. The KIOSK-* cases bring up hardware; the BLE-*/WIFI-*/DB-*/etc. cases
   assume a running kiosk from KIOSK-01.
3. Log every case in the results table. A case is **PASS** only if **all** "Expected success"
   bullets hold. Anything else is **FAIL** (or **BLOCKED** if a prerequisite case failed).
4. For every FAIL, fill in a Failure Record (template below) and attach the artifacts named in that
   case's "How to record a failure".

### Results log

| Test ID | Result (PASS/FAIL/BLOCKED/SKIP) | Tester | Notes / Failure Record link |
|---------|----------------------------------|--------|-----------------------------|
| KIOSK-01 |  |  |  |
| KIOSK-02 |  |  |  |
| KIOSK-03 |  |  |  |
| KIOSK-04 |  |  |  |
| KIOSK-05 |  |  |  |
| KIOSK-06 |  |  |  |
| API-01 |  |  |  |
| API-02 |  |  |  |
| CAM-01 |  |  |  |
| BLE-01 |  |  |  |
| BLE-02 |  |  |  |
| BLE-03 |  |  |  |
| BLE-04 |  |  |  |
| WIFI-01 |  |  |  |
| WIFI-02 |  |  |  |
| WIFI-03 |  |  |  |
| DB-01 |  |  |  |
| DB-02 |  |  |  |
| MOB-01 |  |  |  |
| MOB-02 |  |  |  |
| MOB-03 |  |  |  |
| MOB-04 |  |  |  |
| MOB-05 |  |  |  |
| MOB-06 |  |  |  |

### Failure record template

Copy one block per failure.

```
FAILURE RECORD
Test ID:          <e.g. BLE-02>
Build/commit:     kiosk <short sha> / mobile <version+sha>
Date / time:      <ISO 8601>
Device + OS:      <e.g. Pixel 8 / Android 14, or iPhone 13 / iOS 18.2; Pi 5 / RPi OS 64-bit>
Start flags:      <scripts/start-kiosk.sh flags in use>
Step that failed: <exact numbered step>
Expected:         <the specific bullet that did not hold, with the value you expected>
Actual:           <what you observed, with the actual value/state>
Artifacts:        <list -- see per-case "How to record a failure">
```

Standard artifacts by platform:

- **Android:** `adb logcat -d > crash.txt`, and the focused filter
  `adb logcat -d | findstr /i "FATAL AndroidRuntime UnsatisfiedLinkError"` (catches native/BLE/SQLCipher
  load failures). Also a screenshot of the failing screen.
- **iOS:** the relevant log lines from the Console app / Xcode device log, plus a screenshot.
- **Kiosk:** the session JSONL at `~/openflight_sessions/session_*.jsonl` (newest file). Grab the
  entry types relevant to the case -- usually `trigger_event`, `shot_detected`, and `iq_blocks` /
  `rolling_buffer_capture`; for K-LD7 also `kld7_buffer`. Plus the kiosk terminal/stderr output.
- **Screen values:** record the exact on-screen metric values, not "looked wrong".

---

## KIOSK -- radar, trigger, K-LD7, server

### KIOSK-01 -- Kiosk cold boot and server up

**Why it is not unit-tested.** test_server.py runs Flask with a mocked monitor and no hardware;
this confirms the real serial bring-up, UI build, and Socket.IO handshake on the Pi.

**Prerequisites.** Pi 5 wired per [raspberry-pi-setup.md](raspberry-pi-setup.md) and
[sound-trigger-wiring.md](sound-trigger-wiring.md); OPS243-A on USB; latest main; rolling buffer
already saved to flash (see CLAUDE.md "Radar Setup (One-Time)").

**Procedure.**
1. Run scripts/start-kiosk.sh (default: rolling buffer + sound trigger).
2. Watch the terminal for radar init and the UI build, then open the kiosk UI on the touchscreen.
3. In a browser console on the kiosk, confirm the Socket.IO connection.

**Expected success.**
- Terminal shows the OPS243 opening its serial port with no SerialException and rolling buffer mode
  armed at sample rate 30,000 Hz / FFT 4096 (constants in rolling_buffer/processor.py).
- Kiosk UI renders the live screen (no error overlay).
- On Socket.IO connect the client receives an admin_token event with token + camera_token and a
  trigger_status event (see [server-api.md](server-api.md)).
- A session_start row appears in the newest ~/openflight_sessions/session_*.jsonl.

**How to record a failure.** Attach kiosk stderr and the newest session JSONL (session_start
presence). If serial fails, note the OPS243 USB device path and any dmesg USB lines.

### KIOSK-02 -- Sound trigger arms and re-arms (SEN-14262 to HOST_INT)

**Why it is not unit-tested.** The trigger is a physical GATE-to-HOST_INT edge; no automated test
sees real impact audio or the hardware interrupt.

**Prerequisites.** KIOSK-01 passing. R17 soldered (47k start; see
[sound-trigger-wiring.md](sound-trigger-wiring.md)). Hitting mat + ball + a club, or a sharp clap to
simulate impact. For an isolated check, run
scripts/hardware-test/test_sound_trigger_hardware.py.

**Procedure.**
1. Confirm the SEN-14262 GATE LED is off at rest (if stuck on, R17 is wrong -- see wiring doc).
2. Produce a sharp impact sound (clap or club strike).
3. Repeat 5 times with ~3s gaps.

**Expected success.**
- Each impact produces a trigger_event row in the session JSONL with the accept decision and a
  latency consistent with the hardware path (~10 us class, not the ~5-6 ms speed-trigger path; see
  the latency table in CLAUDE.md).
- The trigger re-arms after every shot (5 impacts give 5 accepted trigger_event rows, no stuck state
  where only the first fires).

**How to record a failure.** Attach the session JSONL filtered to trigger_event rows and note
whether GATE LED behavior was nominal. If zero triggers fire, capture the SEN-14262 GATE wiring and
R17 value.

### KIOSK-03 -- Real shot: ball speed, smash, carry

**Why it is not unit-tested.** Real I/Q from a struck ball; test_rolling_buffer.py only replays
canned buffers.

**Prerequisites.** KIOSK-02 passing. Real club + balls into a net/mat. Select the matching club in
the UI first (matters for carry/roll and spin guardrails -- see
[trackman-test-process.md](trackman-test-process.md)).

**Procedure.**
1. Set the active club in the UI to match the club in hand.
2. Hit 10 normal shots.
3. Read each shot tile and confirm the session JSONL shot_detected rows.

**Expected success.**
- Every struck ball above the floor produces a shot Socket.IO event and a shot_detected row.
- ball_speed_mph >= 35 for accepted shots (the min ball speed floor; weaker reads are rejected, not
  shown as 0).
- smash_factor is physically plausible (~1.2-1.5 for a driver; lower for wedges).
- estimated_carry_yards is non-zero and ordered sensibly vs ball speed; carry_range_low <=
  estimated_carry_yards <= carry_range_high.
- total_distance_yards >= estimated_carry_yards (club roll factor applied via _ROLL_PCT_BY_CLUB in
  launch_monitor.py; e.g. driver adds ~22%, wedges ~1-3%).

**How to record a failure.** Attach shot_detected + rolling_buffer_capture (raw I/Q) and the
on-screen values per shot. Note the club selected.

### KIOSK-04 -- Spin extraction quality and guardrails

**Why it is not unit-tested.** Spin needs real seam modulation in the I/Q; rail/clutter behavior
only shows on live signal.

**Prerequisites.** KIOSK-03 passing. A high-spin club (7-iron/PW) and a driver for contrast.

**Procedure.**
1. Hit 10 shots with a 7-iron, then 10 with the driver.
2. Inspect spin_rpm, spin_confidence, spin_quality, and spin_rejection_reason in the JSONL.

**Expected success.**
- A meaningful fraction of shots report a non-null spin_rpm with spin_quality in high/medium/low.
- Rejected shots still log a candidate and a reason (per
  [trackman-test-process.md](trackman-test-process.md)): upper-rail candidates near ~12000 RPM
  rejected as filter-edge noise; lower-rail ~3300-3500 RPM capped to low confidence; implausibly low
  lower-rail values withheld for high-spin clubs.
- No shot shows an obviously impossible spin (e.g. 12000 RPM accepted at high confidence on a
  driver).

**How to record a failure.** Attach shot_detected (spin diagnostic fields) and
rolling_buffer_capture for the suspect shots.

### KIOSK-05 -- K-LD7 launch angle and aim (dual radar)

**Why it is not unit-tested.** Needs both K-LD7 radars streaming real RADC; test_kld7*.py uses
recorded frames.

**Prerequisites.** Two K-LD7 + FTDI adapters with udev symlinks /dev/kld7_vertical and
/dev/kld7_horizontal (./scripts/setup/setup_kld7_devices.sh --show) and low-latency mode
(setup_kld7_latency.sh). Start with scripts/start-kiosk.sh --kld7 (or --trackman-test for the full
angle preset -- see [trackman-test-process.md](trackman-test-process.md)).

**Procedure.**
1. Verify startup logs show both devices and "USB serial latency_timer=1ms" for each.
2. Hit 10 shots; deliberately include 2 low-launch and 2 pushed/pulled shots.

**Expected success.**
- Startup logs list vertical and horizontal K-LD7 with low-latency confirmed.
- Every live shot emits a vertical and a horizontal launch angle (radar-measured when plausible,
  else the documented fallback: vertical from club/speed/smash estimate, horizontal neutral 0.0).
- launch_angle_vertical tracks intent: low-launch shots read lower than full shots; pushed/pulled
  shots show a non-zero horizontal angle of the expected sign.
- kld7_buffer rows carry per-frame diagnostics; angle_source reflects radar vs estimated.

**How to record a failure.** Attach kld7_buffer and shot_detected (angle fields), plus the physical
setup notes (mount tilt, ball distance) from the Trackman process doc. For deep misses, capture raw
RADC .pkl per that doc.

### KIOSK-06 -- Carry/apex/roll vs Trackman (accuracy gate)

**Why it is not unit-tested.** Requires a reference launch monitor side by side.

**Prerequisites.** KIOSK-05 passing. Trackman (or equivalent) running alongside. Follow
[trackman-test-process.md](trackman-test-process.md) end to end (--trackman-test, raw RADC logging,
export with shot order/club/metrics).

**Procedure.**
1. Run a session of 30+ shots across 3+ clubs with both systems capturing.
2. Run compare_trackman.py and the replay_kld7_trackman.py gates per the Trackman doc.

**Expected success.**
- OpenFlight detects the same shots Trackman saw (no large detect-rate gap).
- Per-club bias is reported and within the team's accepted tolerance; the within-0.5-degree K-LD7
  gate (--require-within-half-degree) passes or its misses are bucketed (production two-frame /
  timing-recoverable / one-frame / true miss).
- Replay preflight shows payload_invalid: 0 and raw RADC coverage (each payload exactly 3072 bytes),
  per the Trackman doc.

**How to record a failure.** Attach the comparison CSV, the replay summary/diagnostics JSON, the
OpenFlight JSONL, and the Trackman CSV. Do not loosen guardrails to pass -- log the bias instead.

### API-01 -- REST endpoints over LAN

**Why it is not unit-tested.** test_server.py calls the test client in-process; this confirms the
real LAN binding, the localhost gate on /api/pair-qr, and JSONL-backed history.

**Prerequisites.** KIOSK-01 running; a second machine on the same LAN; at least one finished session
in ~/openflight_sessions/.

**Procedure.**
1. From the Pi itself: GET /api/pair-qr. From the LAN machine: GET /api/pair-qr.
2. From the LAN machine: GET /api/history, then GET /api/history/<session_id>/shots for a real id,
   and once for a bad id like ../etc.

**Expected success.**
- /api/pair-qr on the Pi returns { v, s, h, p } (secret hex, LAN IP, port); from the LAN machine it
  returns 403 (secret never crosses the network -- see [server-api.md](server-api.md)).
- /api/history returns newest-first sessions capped at 20.
- /api/history/<id>/shots returns the shot_detected objects; a bad id returns 400 and a missing file
  returns 404.

**How to record a failure.** Attach the raw HTTP responses (status + body) and the session JSONL the
id maps to.

### API-02 -- Socket.IO command surface and radar config validation

**Why it is not unit-tested.** Confirms the live event loop and that mobile/web both drive the same
events; ranges enforced on real config writes.

**Prerequisites.** KIOSK-01 running; a Socket.IO client (browser console or the phone).

**Procedure.**
1. Emit get_session, set_club (club "7-iron"), clear_session, simulate_shot.
2. Emit set_radar_config with an in-range value, then min_speed 999 (out of range).
3. Emit client_prefs with an accessibility payload.

**Expected success.**
- get_session gives session_state (stats, shots, mock_mode); set_club gives club_changed;
  clear_session gives session_cleared; simulate_shot gives a shot event.
- In-range set_radar_config gives radar_config; out-of-range (min_speed outside 0-200, max_speed
  outside 10-300, min_magnitude outside 0-100) gives radar_config_error.
- client_prefs gives an accessibility_prefs_update re-broadcast.

**How to record a failure.** Attach the emitted payloads and received events verbatim.

### CAM-01 -- Camera MJPEG stream and token gate

**Why it is not unit-tested.** test_camera.py mocks frames; this needs the real camera device and the
token-gated multipart stream.

**Prerequisites.** KIOSK-01 running with a camera attached; the camera_token from the connect
admin_token event; the admin_token for toggles.

**Procedure.**
1. With camera disabled, GET /camera/stream?token=<camera_token>.
2. Emit toggle_camera (token=admin) then toggle_camera_stream (token=admin).
3. GET /camera/stream?token=<camera_token> again; then once with a wrong token.

**Expected success.**
- While disabled/not streaming, /camera/stream returns 503.
- After enabling + streaming, the stream returns multipart/x-mixed-replace; boundary=frame and
  renders live frames.
- A wrong/absent token is rejected (not served frames).
- get_camera_status reports enabled/available/streaming + ball-detection state.

**How to record a failure.** Attach the HTTP response headers, camera_status payload, and the kiosk
camera init log lines.

---

## MOBILE -- BLE transport

> **Emulator/dev caveat.** BLE cannot be exercised on an Android emulator -- it exposes no Bluetooth
> radio that react-native-ble-plx can use -- and the kiosk BLE GATT peripheral (`ble_server.py`)
> requires Linux/BlueZ, so it does not run on a Windows/macOS dev box. Every BLE case below needs a
> **physical Android phone + a real Pi (or Linux host) running `scripts/start-kiosk.sh --ble`**. See
> Known issues -> "BLE against a mock kiosk".

### BLE-MOCK -- BLE against a mock/dev kiosk (currently blocked)

**Status.** Not possible in the current dev setup (emulator has no BLE; `ble_server.py` is
Linux-only). Tracked under Known issues. Until a cross-platform BLE mock exists, validate BLE only
with the real-hardware cases below (BLE-01..04).

### BLE-01 -- Pairing handshake (QR scan to HMAC auth)

**Why it is not unit-tested.** hmac.test.ts proves the digest math; it cannot exercise the QR scan,
the SecureStore write, the GATT Challenge/Command round-trip, or the Pi's compare_digest.

**Prerequisites.** Kiosk started **with** a pairing secret (not open mode). Phone build installed,
Bluetooth + camera permissions grantable (Android 31+ requests BLUETOOTH_SCAN, BLUETOOTH_CONNECT,
ACCESS_FINE_LOCATION). Kiosk showing the pairing QR (from /api/pair-qr). Protocol:
[mobile-ble-protocol.md](mobile-ble-protocol.md).

**Procedure.**
1. On the phone open the Pair screen and scan the kiosk QR.
2. Disable/avoid Wi-Fi so the app chooses BLE.
3. Let the app scan, connect, and authenticate.

**Expected success.**
- Phone stores the secret in SecureStore under openflight.ble-pairing-secret (Keychain/Keystore).
- BLE status transitions idle -> scanning -> connecting -> connected
  ([mobile-architecture.md](mobile-architecture.md)).
- Phone reads the 64-char hex Challenge nonce, writes auth_challenge with a 64-char hex HMAC, and the
  Pi accepts (compare_digest); auth holds until nonce expiry (nonce refreshes every 240s, valid
  300s, so auth is good for <= 5 min then re-auths).
- Right after auth the phone auto-sends get_session and set_prefs and live shots begin to flow.

**How to record a failure.** Android: adb logcat -d > crash.txt plus the
"FATAL AndroidRuntime UnsatisfiedLinkError" filter (catches a missing native BLE module). Attach the
phone BLE status reached and the kiosk ble_server.py stderr around the auth attempt.

### BLE-02 -- Auth rejection (wrong secret)

**Why it is not unit-tested.** The reject path is the Pi's constant-time compare on a real link.

**Prerequisites.** Kiosk with a pairing secret (confirm it is NOT in open mode -- open mode accepts
every command and would mask this test). A phone whose stored secret is wrong (re-pair against a
stale QR, or corrupt the SecureStore entry in a dev build).

**Procedure.**
1. Force BLE. Let the phone connect and submit auth_challenge with a digest from the wrong secret.

**Expected success.**
- The Pi does NOT authenticate the client; subsequent commands (get_session, etc.) are not honored
  and no shot notifications arrive.
- The app surfaces a failed/unauthenticated state rather than silently appearing connected with no
  data.
- A re-pair with the correct QR then succeeds (BLE-01 path).

**How to record a failure.** Attach kiosk ble_server.py log lines showing the rejected auth, and the
phone-side status. Confirm open-mode was not in effect.

### BLE-03 -- Shot + status streaming and slim encoding

**Why it is not unit-tested.** Needs real GATT notifications and the >512-byte slim fallback over the
wire.

**Prerequisites.** BLE-01 passing. Kiosk producing shots (real or simulate_shot).

**Procedure.**
1. With BLE connected, trigger 10+ shots on the kiosk.
2. Trigger clear_session from the kiosk side.

**Expected success.**
- Each shot arrives on the Shot characteristic and appears on the phone Live screen with matching
  ball speed / carry / launch / spin.
- Oversized shot JSON (>512 bytes) arrives slim-encoded (short keys b/c/l/s/q/t/sp/sm/cs per
  [mobile-ble-protocol.md](mobile-ble-protocol.md)) and still renders correctly.
- A session_cleared event on the Status characteristic clears the phone's shot list.
- Malformed shots are dropped and malformedCount increments (does not crash the list).

**How to record a failure.** Attach the on-screen values vs the kiosk shot_detected rows for any
mismatch, and adb logcat -d for parse errors.

### BLE-04 -- Auto-reconnect backoff

**Why it is not unit-tested.** Needs a real disconnect and the timer-driven backoff on device.

**Prerequisites.** BLE-01 passing and streaming.

**Procedure.**
1. While connected over BLE, restart ble_server / toggle Pi Bluetooth to force an unexpected
   disconnect.
2. Watch the phone's reconnect timing; then bring BLE back up.

**Expected success.**
- The phone attempts reconnect at 3s, then 6s, then 12s (RECONNECT_DELAYS_MS = [3000,6000,12000],
  MAX_RECONNECT_ATTEMPTS = 3), and stops after 3 attempts if still down.
- When the kiosk returns within the window, the phone reconnects, re-authenticates against the
  current nonce, and shots resume.
- The native BleManager is only created on first scan (getManager): a fresh Wi-Fi-only launch shows
  no BLE init in logs.

**How to record a failure.** Attach a timestamped log of reconnect attempts (adb logcat -d) so the
3/6/12s spacing can be verified.

---

## MOBILE -- Wi-Fi / Socket.IO transport

### WIFI-01 -- Live shots over Wi-Fi and transport precedence

**Why it is not unit-tested.** Needs the real Socket.IO link and the Wi-Fi-wins-ties resolution in
useActiveConnection.

**Prerequisites.** Phone and Pi on the same LAN; also paired for BLE (to test precedence). Kiosk
running.

**Procedure.**
1. Connect the phone over Wi-Fi to the Pi host:port.
2. Trigger 10+ shots (real or simulate_shot).
3. With both Wi-Fi and BLE available, confirm which transport drives the UI.

**Expected success.**
- shot, session_state, club_changed, session_cleared all arrive; shots render on Live.
- On connect the app emits get_session and client_prefs automatically.
- With both transports up, Wi-Fi wins (shots come from the Wi-Fi path); the in-memory list is capped
  at 100.
- buildSecureUrl uses HTTP for RFC-1918 LAN hosts (no TLS error) and HTTPS otherwise.
- On a **release** Android APK the LAN HTTP link only works because the release manifest sets
  android:usesCleartextTraffic="true" (now baked in; prebuild-safe equivalent is the
  expo-build-properties plugin android.usesCleartextTraffic). Without it a release build silently
  fails to connect over Wi-Fi while a debug build still works -- if Connect does nothing on a release
  build, suspect cleartext is off.

**How to record a failure.** Attach the host:port used, the on-screen values vs kiosk shot_detected,
and adb logcat -d.

### WIFI-02 -- Session lifecycle events

**Why it is not unit-tested.** Needs the live server to emit real lifecycle events to the device.

**Prerequisites.** WIFI-01 connected.

**Procedure.**
1. From the kiosk, change the active club, then clear the session.

**Expected success.**
- club_changed updates the phone active club; session_cleared empties the phone shot list and
  ends/rolls the local session.
- These mirror the BLE Status-characteristic events (transport parity per
  [server-api.md](server-api.md)).

**How to record a failure.** Attach the event payloads and the phone state before/after.

### WIFI-03 -- Demo mode (no server)

**Why it is not unit-tested.** Demo generation is logic, but the no-network UX path runs only on
device.

**Prerequisites.** Phone with Wi-Fi off / no reachable kiosk.

**Procedure.**
1. Enable demo mode in the app.

**Expected success.**
- Club-typical shots are generated locally (e.g. a 5-iron lands in the documented demo band: ball
  ~100-118 mph) with no server connection, capped at 100, and each passes isValidShot.
- Disabling demo mode stops generation cleanly.

**How to record a failure.** Attach a screenshot of generated shots and adb logcat -d if values look
implausible.

### WIFI-MOCK -- Connect an emulator to a mock kiosk on the dev PC

**Why it is not unit-tested.** Exercises the real Socket.IO link from an emulator to a server running
on the host machine, including the emulator host-loopback alias.

**Prerequisites.** Dev PC with the repo and `uv`; Android emulator running the app.

**Procedure.**
1. On the PC, start the mock kiosk: `uv run openflight-server --web-port 8080 --mock --no-camera`.
   Confirm http://localhost:8080 loads in a PC browser.
2. In the app: Connect -> Wi-Fi -> enter **`10.0.2.2:8080`** -> Connect.
   (An emulator reaches the host loopback via `10.0.2.2` -- NOT `localhost`/`127.0.0.1`, and usually
   NOT the PC's LAN IP.)
3. Inject a shot from the PC (mock mode does not auto-fire shots):
   `uv run python -c "import socketio,time; c=socketio.Client(); c.connect('http://localhost:8080'); c.emit('simulate_shot'); time.sleep(1); c.disconnect()"`

**Expected success.**
- App shows "Connected via Wi-Fi"; each `simulate_shot` appears live on the Live screen.
- `10.0.2.2` is RFC-1918, so `buildSecureUrl` uses cleartext HTTP (no TLS error).

**How to record a failure.** Note the address used; confirm reachability (`adb shell` then
`curl 10.0.2.2:8080`); confirm Windows Firewall allowed the server port; attach `adb logcat -d`.

---

## MOBILE -- on-device storage, app lifecycle

### DB-01 -- SQLCipher encryption at rest

**Why it is not unit-tested.** SQLCipher + the hardware Keystore key only exist on a real device;
units never open an encrypted file.

**Prerequisites.** A debug build on a real device with shots saved; adb (Android) or file access.

**Procedure.**
1. Save several shots (BLE-03 or WIFI-01).
2. Pull the DB file openflight.db from the app sandbox and try to open it with a plain sqlite3 (no
   key).

**Expected success.**
- Plain sqlite3 cannot read tables (file is encrypted; "file is not a database" / cipher error).
- In-app, the same shots read back correctly -- proving the Keystore-backed device-UUID key
  (openflight.db-device-key) decrypts it (see header comment in mobile/src/db/database.ts and
  [bag-database-schema.md](bag-database-schema.md)).
- ALTER TABLE migration columns (carry_side_yards, curve_yards) exist and do not
  error on a second app launch (idempotent).

**How to record a failure.** Attach the sqlite3 error, and the
"adb logcat -d | findstr /i UnsatisfiedLinkError" output if op-sqlite/SQLCipher failed to load
natively.

### DB-02 -- Device-integrity wipe on key mismatch

**Why it is not unit-tested.** The wipe triggers on a real cross-device restore / Keystore change.

**Prerequisites.** A debug build where you can change the stored device key or restore the DB to a
different install.

**Procedure.**
1. Save shots on device A.
2. Simulate a foreign install: change the _db_meta device_integrity stamp (or move the encrypted
   file to a build with a different openflight.db-device-key) so the SQLCipher key still opens it but
   the integrity hash differs.
3. Relaunch and call initDatabase().

**Expected success.**
- On mismatch, shots, sessions, and _db_meta are wiped in a transaction and re-stamped with this
  device SHA256 of the string "openflight:<deviceKey>" -- so the new install never sees another
  installation data.
- A matching stamp on a normal relaunch does NOT wipe anything (existing shots persist).

**How to record a failure.** Attach the row counts before/after relaunch and adb logcat -d around
the init.

### MOB-01 -- Accessibility prefs relay to kiosk

**Why it is not unit-tested.** Needs the phone-to-server client_prefs/set_prefs round-trip on a live
link.

**Prerequisites.** Phone connected (Wi-Fi or BLE); kiosk visible. See
[mobile-accessibility.md](mobile-accessibility.md).

**Procedure.**
1. On the phone toggle reduce-motion, high-contrast, large-text, and a color-blind mode.

**Expected success.**
- Phone emits client_prefs (Wi-Fi) or set_prefs (BLE); the kiosk receives accessibility_prefs_update
  and visibly applies the change (e.g. animations stop under reduce-motion).
- The phone UI itself also reflects the prefs (font scale, contrast).

**How to record a failure.** Attach the relayed payload, a kiosk screenshot before/after, and the
accessibility_prefs_update event.

### MOB-02 -- Units / temperature / language live switching

**Why it is not unit-tested.** Conversion math is unit-tested; the live granular-unit re-render on
device is not.

**Prerequisites.** Phone with shots displayed.

**Procedure.**
1. Switch speed unit (mph -> kmh -> mps), distance (yards <-> meters), temperature, and language
   while a shot is on screen.

**Expected success.**
- Displayed metrics re-render immediately using the new granular unit (e.g. 150 mph -> ~241 km/h),
  driven by formatSpeed/formatDistance (see [mobile-architecture.md](mobile-architecture.md)); no app
  restart needed.
- Language switch relabels UI strings; temperature unit updates where shown. All 16 kiosk
  languages (en es fr de pt it nl sv ja ko zh-hans zh-hant th no da fi) are selectable; tab labels
  and the Analytics segment labels relabel too. (The previously English-only mobile screens --
  TrendsView, Connection (Wi-Fi/BLE), Add-Club, Pair -- are now keyed too; their strings are
  English-first and fall back to English in languages not yet translated.)

**How to record a failure.** Attach before/after screenshots with the exact values shown.

### MOB-03 -- Bag persistence

**Why it is not unit-tested.** Needs the clubs table on a real SQLCipher handle across launches.

**Prerequisites.** Phone debug or release build.

**Procedure.**
1. Add a club, edit it, mark a spare, then fully close and relaunch the app.

**Expected success.**
- The club, edits, and spare flag persist across a cold relaunch (bag tables initialized via
  initBagTables(); see [bag-database-schema.md](bag-database-schema.md)).
- Bag-to-stats joins show the club shots where applicable.

**How to record a failure.** Attach the bag screen before/after relaunch and adb logcat -d.

### MOB-04 -- StatsView under 100-shot load

**Why it is not unit-tested.** Stat math is unit-tested; render performance with a full in-memory
list + DB-backed lifetime/trend queries is device-only.

**Prerequisites.** A session/history with 100+ shots across several clubs.

**Procedure.**
1. Open StatsView and the dispersion/trend charts with the full data set; scroll and switch clubs.

**Expected success.**
- Charts (DispersionChart, TrendLineChart, ShapeBar) render and remain interactive; no ANR / frozen
  frames; the in-memory list cap of 100 holds.
- Lifetime stats (getLifetimeStatsByClub) and per-club trend (getClubSessionTrend, last 20 sessions)
  return sane averages/std-dev (no NaN, no negative carry).

**How to record a failure.** Attach a screen recording of the jank and adb logcat -d for slow-frame /
GC warnings.

### MOB-05 -- Cold start and background-to-foreground

**Why it is not unit-tested.** App lifecycle, DB re-open, and transport re-acquire only happen on
device.

**Prerequisites.** Phone with a prior session and a reachable kiosk.

**Procedure.**
1. Cold-start the app (killed process), confirm DB init and history load.
2. Connect, then background the app for ~60s and return.

**Expected success.**
- Cold start initializes the DB once (single _initPromise) and shows prior history without a wipe
  (integrity stamp matched).
- After foregrounding, the transport re-acquires (Wi-Fi reconnects, or BLE follows the 3/6/12s
  backoff) and live shots resume without duplicate persistence (shots de-duped by the composite key
  timestamp|ball_speed|carry).

**How to record a failure.** Attach adb logcat -d across the background/foreground transition and
note any duplicated or missing shots vs the kiosk.

### MOB-06 -- Live shot-quality chips and 3D trajectory

**Why it is not unit-tested.** shotQuality.test.ts and trajectory.test.ts cover the math; the on-card
chip rendering, the color-blind palette swap, and the RK4-vs-parabola 2D/3D curves only show on device.

**Prerequisites.** Phone with live or demo shots (a curving shot is ideal -- e.g. a sliced/hooked
driver). Toggle a color-blind mode to check the palette.

**Procedure.**
1. Produce a few shots spanning good and off-ideal launch/spin/club-path.
2. Open the live shot card and read the ShotQualityRow chips.
3. Switch to the 3D tracer; inspect a high-spin/off-center shot.
4. Enable a color-blind mode and recheck the chip colors.

**Expected success.**
- Each chip reads Low/Perfect/High (launch, offline, AoA, spin) or Left/Perfect/Right (club path),
  green for perfect and red for off-ideal; under a color-blind mode the off-ideal/perfect colors map
  to orange/blue.
- Both tracers (ShotTracer3D and ShotTracer2D) draw a curved flight path from the on-device RK4
  drag+Magnus model that bends with the spin axis (not a flat parabola) for shots with a vertical
  launch angle; a shot with no vertical angle falls back to the parabola.

**How to record a failure.** Attach a screenshot of the chips (with the shot values) and of the 3D
tracer, plus the color-blind-mode screenshot.

---

## Known issues / bugs to investigate

- **BLE against a mock kiosk does not connect in the dev setup.** Root cause: Android emulators expose
  no BLE radio to react-native-ble-plx, and the kiosk BLE GATT server (`ble_server.py`) requires
  Linux/BlueZ so it cannot run on a Windows/macOS dev box. Workaround: validate BLE only on a physical
  Android phone paired to a real Pi (or Linux host) running the BLE server. Open question: whether to
  build a cross-platform BLE mock for development. (Reported 2026-06-16.)

---

## Looks-current checklist for the tester

Before signing off a release, confirm you actually exercised at least one case in each block: KIOSK
(radar+trigger), K-LD7 angles, Trackman accuracy, REST + Socket.IO, camera, BLE auth + stream +
reconnect, Wi-Fi live + lifecycle + demo, SQLCipher at rest + integrity wipe, accessibility relay, units/lang, bag persistence, stats under load, and app lifecycle.
