# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Mobile `ShotTracer2D` now uses the on-device RK4 drag+Magnus model
  (`trajectory.ts`), matching `ShotTracer3D`; both fall back to the parabola only
  when a shot has no vertical launch angle.
- Mobile i18n routing completed for the previously English-only screens -
  TrendsView, ConnectionScreen (Wi-Fi + BLE panels + demo), AddClubScreen, and
  PairScreen now go through `t()` (new `conn*`/`ble*`/`trend*`/`club*`/`pair*`
  keys in the English catalog; other languages fall back to English until
  translated). ConnectionScreen tabs also meet the 44pt HIG touch target.
- Mobile connection layer refactored: `useActiveConnection` owns both transport
  hooks and resolves the merged Wi-Fi/BLE view (Wi-Fi wins ties); the raw
  transport controls are exposed only to the Connection screen via
  `ConnectionControlsProvider`/`useConnectionControls`.
- Mobile shot persistence moved out of `App.tsx` into `useShotPersistence`:
  de-dupes by a composite key (timestamp + ball speed + carry, not timestamp
  alone), buffers shots that arrive before the DB session exists, and routes
  failures through a dev-only `src/utils/logger.ts`.
- Mobile units are now granular - `SpeedUnit` (`mph`/`kmh`/`mps`) and
  `DistanceUnit` (`yards`/`meters`) replace the binary `UnitSystem`;
  `UnitPreferenceContext` no longer exposes `unitSystem`.
- Mobile `enrichShot` now prefers server-computed `apex_height_yards`,
  `total_distance_yards`, `face_to_path_deg`, and `is_mishit` when present,
  falling back to local heuristics only for demo/legacy shots, so the phone
  matches the kiosk.
- Mobile BLE: the native `BleManager` is created lazily on first scan (Wi-Fi-only
  users never start the Bluetooth stack), and all Command writes go through one
  `sendCommand` helper. The BLE wire protocol is unchanged.
- Carry estimation now adds a club-specific roll factor for total distance
  (`estimated_total_distance` / `_ROLL_PCT_BY_CLUB` in `launch_monitor.py`).
- Spin detection: drop the autocorrelation override branch. The autocorr
  peak inside the envelope search region often lands at minimum lag
  (~12000 RPM / upper rail) by spectral coincidence, which previously
  flipped legitimate mid-range FFT seam picks to the upper rail and got
  them rejected as bandpass-shoulder noise. The autocorr fallback still
  *confirms* the FFT pick when the two agree within 10%; disagreements
  are now logged for diagnostics but never replace the FFT result.
- Spin detection: lower `SPIN_SNR_MIN` from 3.0 → 2.5 so marginal but
  real seam tones are reported at low confidence instead of dropped.
- Mobile tabs renamed and reordered to mirror the kiosk: the **Stats** tab is
  now **Analytics**, and the tab order is **Live, Analytics, History, Settings**.
- Mobile Analytics tab restructured into sub-views: **Overview** (session KPIs +
  virtualized shot table + fitting recommendations), **Clubs** (all-time per-club
  via `BagOverview`), and **Trends** (per-club carry trend via the new
  `src/components/TrendsView.tsx`). A Coaching sub-view is deferred. The sub-tab
  segment meets the 44pt touch-target minimum.
- Mobile language set aligned to the kiosk's 16 (`en es fr de pt it nl sv ja ko
  zh-hans zh-hant th no da fi`) in `src/utils/units.ts` - dropped ru/ar/hi and
  fixed zh casing. `useT` now maps 1:1 to the vendored kiosk catalog `LangCode`;
  tab labels, Analytics segment labels, and rating chips route through `t()`. A
  few mobile-only strings (TrendsView header, Add-Club / Connection / Pair
  screens) are not yet keyed and remain English-only.
- Kiosk `/scoreboard` header now shows the OpenFlight wordmark image
  (`openflighttransparentlogo.png`, `.display-mode__logo` in
  `ui/src/components/Scoreboard.tsx`) in place of the "OpenFlight Display"
  eyebrow text; the sr-only `<h1>OpenFlight Display</h1>` is kept for
  screen readers.

### Removed
- **Mobile Range tab** (and `RangeScreen.tsx`, dead `CourseScreen.tsx`): the app
  tabs are now Live, Analytics, History, Settings.
- **All mobile GPS functionality**: `src/utils/gps.ts`, the HMAC-AEAD
  `src/utils/gpsEncryption.ts` (and its test), the `saveShotGps` /
  `getShotsGps` / `decryptShotGps` DB helpers, and the `gps_coords_enc` column
  migration in `src/db/database.ts`. The `expo-location` dependency and its
  config plugin / iOS location usage description were removed; the deleted
  `docs/gps-encryption.md` doc went with it. (Android `ACCESS_FINE/COARSE_LOCATION`
  permissions are kept - they are required for BLE scanning on Android < 12, not
  for GPS.)

### Added
- **Mobile companion app** (`mobile/`): Expo iOS/Android app that connects to
  the kiosk over Wi-Fi (Socket.IO) or Bluetooth LE, mirrors live shots, stores
  an encrypted on-device shot history, and manages a club bag with per-club
  stats, dispersion, and trend charts. See [mobile/README.md](../mobile/README.md)
  and [mobile-architecture.md](mobile-architecture.md).
- **Mobile shot-quality rating chips** (kiosk parity): `src/utils/shotQuality.ts`
  (ported from the kiosk `shotQuality.ts`/`shotMetrics.ts`) and
  `src/components/ShotQualityRow.tsx` render Low/Perfect/High (launch, offline,
  AoA, spin) and Left/Perfect/Right (club path) chips on the live shot card,
  color-coded green=perfect / red=off-ideal (color-blind → blue/orange). Tests:
  `__tests__/utils/shotQuality.test.ts`.
- **On-device trajectory physics**: `src/utils/trajectory.ts` ports
  `src/openflight/ballistics.py::simulate()` (RK4 drag + Magnus with spin decay).
  `ShotTracer3D` now draws the real curved flight path (including side curve from
  the spin axis), falling back to a parabola only when there is no vertical launch
  angle. Tests: `__tests__/utils/trajectory.test.ts`.
- **BLE GATT peripheral** (`src/openflight/ble_server.py`): advertises the
  OpenFlight service, pushes shots/events to paired phones, and authenticates
  with a rotating-nonce HMAC-SHA256 challenge verified in constant time.
  Protocol: [mobile-ble-protocol.md](mobile-ble-protocol.md).
- **QR pairing endpoint** `GET /api/pair-qr` (localhost-only) hands the kiosk a
  pairing payload to render as a QR code; the phone scans it once.
- **History REST API**: `GET /api/history` (session summaries) and
  `GET /api/history/<session_id>/shots` (per-shot detail) read the JSONL logs.
- **Camera stream**: `GET /camera/stream` MJPEG endpoint plus `toggle_camera`,
  `toggle_camera_stream`, and `get_camera_status` Socket.IO events; the mobile
  app embeds the feed via `CameraStream`.
- **Accessibility relay**: the phone sends reduce-motion / high-contrast /
  large-text / color-blind prefs to the kiosk over WebSocket (`client_prefs`)
  and BLE (`set_prefs`); the kiosk applies them as CSS overrides. See
  [mobile-accessibility.md](mobile-accessibility.md).
- **Kiosk Smart-TV mode**: auto-detects Tizen / webOS / `?tv=1`, enlarges the
  UI for 10-foot viewing, drops backdrop blur on constrained GPUs, and adds
  full spatial D-pad navigation across all controls.
- **TV remote control**: navigate the kiosk/`/scoreboard` UI with a remote via any
  of HDMI-CEC, FLIRC/IR, Bluetooth HID, or a no-hardware phone web-remote
  (`GET /remote` + the `remote_key` Socket.IO relay). Spatial D-pad focus
  engine (`ui/src/state/useSpatialNavigation.ts`), `RemoteControl` page, and Pi
  bridges (`scripts/tv-remote/cec_remote.py`, `openflight-cec.service`,
  `flirc_setup.sh`). Setup: [tv-remote-control.md](tv-remote-control.md).
- **Camera-less scoreboard visualizer**: when no camera is streaming, the `/scoreboard`
  view shows an animated trajectory + dispersion for the current club
  (`ui/src/components/DisplayShotVisualizer.tsx`, `ui/src/components/charts/clubCharts.tsx`).
- **View-mode selection**: a first-run **Interactive vs Scoreboard** chooser
  (`ui/src/components/ViewModeChooser.tsx`), seeded by `start-kiosk.sh`
  EDID/CEC auto-detection (`--interactive` / `--scoreboard` / `--no-view-detect`
  override it; `--tv` / `--monitor` kept as aliases). The small 7" kiosk panel
  defaults to Interactive and skips the chooser. Saved per device
  (`ui/src/state/viewMode.ts`) and switchable in Settings → View mode.
- **Server API reference**: [server-api.md](server-api.md) documents every REST
  endpoint and Socket.IO event.
- `scripts/analysis/replay_club_speed.py`: offline replay of a proposed
  MEDIAN club-speed picker against any session log. Builds the same
  candidate set the production picker uses, applies a 30 % magnitude
  floor, and reports the median speed for each `rolling_buffer_capture`
  alongside the originally logged (magnitude-pick) value, with smash
  factors as a physical sanity check. The script is exploratory and
  does not change production behaviour — it lets us inspect what a
  median-based picker would have produced before committing to a code
  change.
- `scripts/analysis/plot_spin_debug.py`: 4-panel diagnostic for a single
  `rolling_buffer_capture` (speed timeline, raw I/Q, bandpass envelope,
  envelope FFT spectrum) to inspect what the spin algorithm saw and why
  it accepted or rejected a shot.
- K-LD7 shot-correlation analysis workflow and theory writeup
  - `scripts/analyze_kld7.py --pair-shots` for offline club-to-ball pairing on `.pkl` captures
  - `docs/kld7-ball-detection-theory.md` with capture findings and detection rationale
- K-LD7 session-review workflow for full JSONL logs
  - `scripts/review_kld7_session.py` for per-shot profile review on `session_logs/session_*.jsonl`
  - `docs/kld7-session-review.md` documenting the empirical review method and outputs
- Persistent rolling buffer mode workaround for OPS243-A HOST_INT pin bug (per OmniPreSense)
  - `persist_rolling_buffer_mode()` method saves settings to flash memory
  - `test_rolling_buffer_persist.py` script for one-time radar setup and verification
  - Rolling buffer + sound trigger is now the default operating mode
- Grafana Alloy integration for shipping session logs to Grafana Cloud Loki
  - Setup script (`scripts/setup_alloy.sh`) and config (`config/alloy.alloy`)
  - Auto-starts with `start-kiosk.sh` when credentials are configured
  - Observability documentation with LogQL query examples
- Launch angle estimation from club type and ball speed (fallback when camera unavailable)
- Tunable Hough circle detection with all 5 parameters as CLI args (`--hough-param1`, `--hough-param2`, `--hough-min-radius`, `--hough-max-radius`, `--hough-min-dist`)
- Interactive `--tune` mode in `test_launch_angle.py` with live OpenCV trackbar sliders
- Mock mode now simulates realistic spin and launch angle data (TrackMan-based per-club averages)
- Sound trigger wiring guide with MOSFET circuit design (`docs/sound-trigger-wiring.md`)
- Camera integration with real-time ball detection in UI
- Ball detection indicator in header (shows detection status)
- Camera tab with live MJPEG stream and detection overlay
- Hough circle transform as default ball detector (replaces YOLO dependency)
- ByteTrack object tracking for persistent ball identification
- Club speed detection and smash factor calculation
- Rolling buffer mode for experimental spin rate detection
- Session logging to JSONL files (`~/openflight_sessions/`)
- I/Q streaming mode with FFT and 2D CFAR noise rejection
- `--mode rolling-buffer` flag for spin detection
- `--session-location` and `--log-dir` flags for session logging
- Roboflow API integration as optional detection backend
- YOLO performance tuning documentation for Raspberry Pi
- ONNX model export support for faster inference
- Threaded camera capture for improved FPS
- Rolling buffer spin detection documentation

### Changed
- K-LD7 launch-angle processing now uses OPS243 impact timestamps for live correlation
- K-LD7 ball-burst selection now prefers coherent far-target paths instead of averaging all far PDAT detections
- Live K-LD7 vertical launch angles now fall back to the existing club-and-speed estimate when the radar result is an obvious false positive
- Spin detection improved: Hann windowing, zero-padding to 256 points, band-limited search
- All shot metrics (spin, launch angle, club speed, carry) always shown in UI
- Shot logging unified — all metrics in single `shot_detected` entry
- Shot `mode` and `readings_data` are now proper dataclass fields (no more monkey-patching)
- Session logging enabled in mock mode for testing Alloy integration
- Default ball detection uses Hough circles instead of YOLO (no ML model required)
- Camera enabled by default in kiosk mode (use `--no-camera` to disable)
- Dropped Python 3.9 support (requires >=3.10)
- Updated Raspberry Pi setup guide with camera UI and observability instructions

### Fixed
- Mobile live "Clear" button now clears local shots immediately.
  `useSocketConnection.clearSession` previously only emitted to the server, which
  was a no-op in demo mode, so the live list never cleared.
- Mobile bag now reliably shows added clubs: `BagScreen` loads the club list
  independently of the lifetime-stats query, so a stats failure no longer blanks
  the bag.
- Mobile Wi-Fi "Connect" now works on release Android builds: the release
  `android/app/src/main/AndroidManifest.xml` sets `android:usesCleartextTraffic="true"`
  (the debug manifest already did), so release builds no longer silently block
  the app's `http://<lan>:8080` Socket.IO connection. HTTP is still restricted to
  RFC-1918 LAN hosts via `buildSecureUrl`; the prebuild-safe equivalent is the
  `expo-build-properties` plugin's `android.usesCleartextTraffic`.
- Mobile Wi-Fi "Connect" now gives feedback instead of appearing to do nothing:
  `useSocketConnection` exposes `connecting` + `errorMessage` (a `connect_error`
  handler plus an 8s timeout), and the Connection screen shows a "Connecting…" state
  and a failure message.
- Mobile StatsView shot-log table is now virtualized (synced FlatLists) for long
  sessions; HomeScreen reloads History-style data on focus and uses a
  collision-proof `keyExtractor` (`id ?? timestamp-index`); ShotDisplay guards
  `carry_range` before formatting.
- Mobile BLE pairing auth now works on-device: the HMAC-SHA256 challenge response
  uses the pure-JS `src/utils/hmac.ts` instead of `crypto.subtle`, which Hermes
  does not provide.
- Mobile startup crash fixed: Expo packages aligned to SDK 56. `expo-blur` (was
  `14.1.5`) and `expo-camera` (was `16.1.11`) were stale majors whose Kotlin
  modules referenced classes absent from SDK-56 `expo-modules-core`, throwing
  `NoClassDefFoundError` during native module registration before any UI loaded.
  Also added `expo-font` as a direct dependency (peer of `@expo/vector-icons`) and
  de-duplicated it, and dropped the direct `expo-modules-core` dependency (provided
  by `expo`) to prevent future version skew.

### Security
- Mobile Android `allowBackup` set to `false` so the encrypted DB is excluded
  from device backups, matching the documented at-rest security design.

## [0.2.0] - 2024-12-01

### Added
- Web UI with React frontend and Flask-SocketIO backend
- Real-time shot display with ball speed, carry distance, smash factor
- Session statistics view with per-club filtering
- Shot history with pagination
- Debug panel for radar tuning and raw readings
- Mock mode for development without hardware
- Kiosk mode script for Raspberry Pi deployment
- Systemd service for auto-start on boot
- Camera module for launch angle detection (experimental)
- Camera-based ball tracking for launch angle
- Club type selection (Driver through PW)

### Changed
- Migrated from CDM324/HB100 radar to OPS243-A
- Improved carry distance estimation model

## [0.1.0] - 2024-10-01

### Added
- Initial OPS243-A radar driver
- Basic launch monitor with shot detection
- CLI interface for monitoring shots
- Python API for integration
- Carry distance estimation based on ball speed

[Unreleased]: https://github.com/jewbetcha/openflight/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jewbetcha/openflight/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jewbetcha/openflight/releases/tag/v0.1.0
