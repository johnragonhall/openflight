# Mobile App Architecture

How the OpenFlight mobile app is wired: providers, navigation, the two connection transports, the
data layer, and the component catalog. Read this before changing connection logic, the DB schema,
or the navigation tree.

For setup and commands, see [mobile/README.md](../mobile/README.md).

## Provider stack

`App.tsx` nests providers outside the navigator so every screen reads the same context:

```
SafeAreaProvider
└── AccessibilityProvider             # reduce-motion, high-contrast, large-text, color-blind
    └── UnitPreferenceProvider        # speed/distance units, language, temperature
        └── ConnectionProvider        # merged live view: connected, shots, latestShot, setClub, clearSession
            └── ConnectionControlsProvider  # raw transport controls (wifi/ble) - Connection screen only
                └── NavigationContainer (dark NAV_THEME from theme.ts)
```

`useActiveConnection` (called once in `App.tsx`) owns both transport hooks and resolves the merged
view. `ConnectionProvider` exposes that view to every display screen; `ConnectionControlsProvider`
exposes the raw transport control surfaces (`wifi`, `ble`) to the Connection setup screen only - so
screens never branch on Wi-Fi vs BLE and the raw hooks are never prop-drilled through the navigator.

## Connection model

`useActiveConnection` runs both transports at once and picks a winner (Wi-Fi wins ties):

```ts
const wifiActive = wifi.connected;
const bleActive  = ble.status === 'connected';
const connected  = wifiActive || bleActive;
const shots      = wifiActive ? wifi.shots : ble.shots;
```

- **`useSocketConnection`** (Socket.IO): listens for `shot`, `session_state`, `club_changed`,
  `session_cleared`. On connect it emits `get_session` and `client_prefs`. It also owns demo mode,
  which generates club-typical shots with no server. URL scheme is chosen by `buildSecureUrl`:
  HTTP for RFC-1918 LAN hosts, HTTPS otherwise. Release Android builds also need
  `android:usesCleartextTraffic="true"` (set in the release manifest; prebuild-safe equivalent is
  the `expo-build-properties` plugin `android.usesCleartextTraffic`) or the LAN `http://<lan>:8080`
  link is blocked and Wi-Fi Connect silently fails.
- **`useBLEConnection`** (react-native-ble-plx): scans by service UUID, runs the HMAC pairing
  handshake, then subscribes to the Shot and Status characteristics. Reconnect uses a fixed
  backoff of 3s, 6s, 12s for up to 3 attempts. The native `BleManager` is created lazily on the
  first scan (`getManager`), so Wi-Fi-only users never start the Bluetooth stack. All Command
  writes go through one `sendCommand(device, payload)` helper, and the challenge response is
  computed with the pure-JS `src/utils/hmac.ts` (Hermes ships no WebCrypto). Full protocol in
  [mobile-ble-protocol.md](mobile-ble-protocol.md).

Both transports validate every inbound shot with `isValidShot` and cap the in-memory list at 100.

## Navigation

A native-stack root wraps a bottom-tab navigator (`src/types/navigation.ts`):

- **Root stack** (`RootStackParamList`): `MainTabs`, `Connection`, `Pair`, `SessionDetail`, the
  `Settings*` screens (`UnitsPicker`, `Temperature`, `Language`, `Accessibility`), and the
  `Bag*` screens (`BagMain`, `BagAddClub` as a modal, `BagClubDetail`, `BagSpareClubs`).
- **Tabs** (`MainTabParamList`): `Live`, `Analytics`, `History`, `Settings` (order mirrors the
  kiosk). The tab bar is the custom `AnimatedTabBar` (icon glow + active indicator), not the
  default.

The **Analytics** tab (`StatsScreen`) has three sub-views behind a 44pt-min segmented control
(kiosk parity): **Overview** (session KPIs, the virtualized shot table, and `FittingRecommendations`),
**Clubs** (all-time per-club stats via `BagOverview`), and **Trends** (per-club carry trend via
`TrendsView`). A Coaching sub-view is deferred.

`SessionDetail` and `BagClubDetail` take route params (`sessionId`/`label`, `clubId`); the rest
take none.

## Data layer

Two modules share one encrypted SQLCipher handle from `@op-engineering/op-sqlite`.

- **`src/db/database.ts`** owns `initDatabase()`, the `sessions` and `shots` tables, schema
  migrations, and lifetime/trend stat queries. It exposes the shared
  handle through `getDatabase()`.
- **`src/db/bagDatabase.ts`** owns the `clubs` table and the bag-to-stats joins. `initDatabase`
  calls `initBagTables()` with a lazy import to avoid a circular dependency at module load.

Schema and query reference: [bag-database-schema.md](bag-database-schema.md). Persistence is owned
by `src/hooks/useShotPersistence.ts` (not `App.tsx`): it inits the DB, opens a `createSession` row
on the first connect, and saves each shot exactly once with `saveShot(enrichShot(shot))`. Shots are
de-duped by a composite key (`timestamp | ball_speed | carry`, not timestamp alone, so two genuine
shots that share a timestamp both persist). Shots that arrive before the session row exists are
buffered and flushed once it does, so no early shot is dropped. DB-init and save failures surface
through the error banner and the dev-only `src/utils/logger.ts` (silent in release builds).

`enrichShot` (`src/utils/ballistics.ts`) treats the kiosk server as the source of truth: it keeps
server-computed `apex_height_yards`, `total_distance_yards`, `face_to_path_deg`, and `is_mishit`
when present and only computes them from local heuristics as a fallback (demo-mode and legacy
shots), so the phone matches the kiosk. `shot_shape` is display-only and always derived locally.

## State and theming

- **`UnitPreferenceProvider`** holds a granular speed unit (`mph`/`kmh`/`mps`), a distance unit
  (`yards`/`meters`), language, and temperature - there is no longer a binary `unitSystem`.
  Conversions and formatters (`formatSpeed`/`formatDistance`, keyed on the granular units) live in
  `src/utils/units.ts`. The language set is the kiosk's 16
  (`en es fr de pt it nl sv ja ko zh-hans zh-hant th no da fi`, `LangCode` in
  `units.ts`); `useT` maps 1:1 to the vendored kiosk catalog, so tab labels, the Analytics
  segment labels, and the rating chips localize through `t()`. A few mobile-only strings
  (TrendsView header, Add-Club / Connection / Pair screens) are not yet keyed (English-only).
- **`AccessibilityProvider`** reads persisted prefs and exposes `useAccessibility`, `useFontScale`,
  `useThemeColors`. Prefs relay to the kiosk on connect. See
  [mobile-accessibility.md](mobile-accessibility.md).
- **`theme.ts`** is the token source: `C` (colors), `R` (radii), `Glow`, `Anim`, and `Glass`
  (iOS BlurView substrate plus gold tint; Android falls back to a solid elevated surface). The
  palette mirrors the kiosk gold/cream theme so both screens read as one product.

## Component catalog

| Component | Role |
|-----------|------|
| `ShotTracer2D` / `ShotTracer3D` | Trajectory rendering; `ShotTracer3D` uses the RK4 drag+Magnus model in `src/utils/trajectory.ts` (mirrors `ballistics.py`). See [shot-visualization.md](shot-visualization.md). |
| `ShotQualityRow` | Live shot-card quality chips (launch/offline/AoA/spin/club-path), green=perfect / red=off-ideal, from `src/utils/shotQuality.ts`. |
| `TrendsView` / `BagOverview` | Analytics sub-views: per-club carry trend, and all-time per-club stats. |
| `DispersionChart` | Landing scatter with per-club color and a dispersion ellipse. |
| `TrendLineChart` | Per-club carry trend across recent sessions. |
| `ShapeBar` | Draw/straight/fade distribution bar. |
| `MetricCard` / `AnimatedNumber` | Glance-speed metric tiles with count-up animation. |
| `ClubPicker` / `ClubIcon` / `ShotShapePill` | Club selection and shot-shape labeling. |
| `FittingRecommendations` | Gapping/fitting hints from `data/fittingRanges.ts`. |
| `CameraStream` | WebView MJPEG view of the kiosk camera feed. |
| `PressableScale` / `RadarPulse` / `AnimatedTabBar` | Motion primitives (respect reduce-motion). |

## Where to start for common changes

- New shot field: add to `types/shot.ts` + `isValidShot`, the `shots` table and `saveShot`/
  `rowToShot` in `database.ts`, then the relevant component.
- New screen: add to `RootStackParamList` or `MainTabParamList`, register in `App.tsx`.
- New transport command: send it from `useBLEConnection` via the `sendCommand(device, payload)`
  helper (Command characteristic write) and add the matching handler to the server's BLE
  `on_command` to keep parity with the Wi-Fi path.
