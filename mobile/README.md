# OpenFlight Mobile

The OpenFlight companion app for iOS and Android. It connects to the Raspberry Pi kiosk over
Bluetooth LE or Wi-Fi, shows live shots, stores a personal shot history on-device, and manages
your club bag. Built with Expo (React Native).

> Contributor onboarding lives in [docs/mobile-architecture.md](../docs/mobile-architecture.md).
> End-user walkthroughs live in [docs/mobile-app-guide.md](../docs/mobile-app-guide.md).

## Requirements

- Node 20+ and npm
- A physical iOS or Android device (BLE and SQLCipher need native modules, so Expo Go and the
  simulator do not cover the full app). Use a dev client build.
- Xcode (iOS) or Android Studio + SDK (Android) for device builds
- Optional: a running OpenFlight kiosk to pair with. Without one, use the in-app demo mode.

## Install

```bash
cd mobile
npm install        # runs patch-package via postinstall
```

## Run

| Command | What it does |
|---------|--------------|
| `npm start` | Start the Expo dev server (Metro). |
| `npm run android` | Build and launch the dev client on a connected Android device. |
| `npm run ios` | Build and launch the dev client on a connected iOS device. |
| `npm run prebuild` | Regenerate native `android/` and `ios/` projects (`expo prebuild --clean`). |
| `npm run lint` | ESLint over `src/`. |
| `npm test` | Jest (jest-expo preset), single run. |

First run on a device: `npm run android` or `npm run ios` compiles the native dev client. After
that, `npm start` plus the installed dev client gives hot reload.

## Connect to a kiosk

The app supports two transports. `App.tsx` prefers Wi-Fi when both are live.

- **Wi-Fi (Socket.IO):** enter the kiosk host on the Connect screen, for example
  `192.168.1.50:8080`. The client sends cleartext HTTP only to RFC-1918 LAN addresses; any other
  host is forced to HTTPS/WSS (see `buildSecureUrl` in `src/hooks/useSocketConnection.ts`).
  Release Android builds also require `android:usesCleartextTraffic="true"` (set in the release
  manifest; prebuild-safe equivalent is the `expo-build-properties` plugin's
  `android.usesCleartextTraffic`) or the LAN HTTP link is blocked.
- **Bluetooth LE:** scan for the `OpenFlight` peripheral, then pair once by scanning the kiosk QR
  code. Pairing stores a 32-byte secret in the device Keychain/Keystore and authenticates every
  later connection with an HMAC challenge. See
  [docs/mobile-ble-protocol.md](../docs/mobile-ble-protocol.md).

No kiosk on hand? Open the Connect screen and start the demo. `useSocketConnection` synthesizes
club-typical shots every 4 to 7 seconds so you can exercise the UI offline.

## Folder map

```
mobile/
├── App.tsx                 # Root: providers, navigators, shot persistence wiring
├── src/
│   ├── components/         # Presentational + chart/tracer components
│   ├── data/               # Static club catalog and fitting ranges
│   ├── db/                 # op-sqlite (SQLCipher) data layer
│   │   ├── database.ts     # Core schema, sessions/shots, stat queries
│   │   └── bagDatabase.ts  # Bag/clubs tables and stats joins
│   ├── hooks/              # useActiveConnection, useBLEConnection, useSocketConnection, useShotPersistence
│   ├── screens/            # One file per screen; bag/ and settings/ subgroups
│   ├── state/              # Context providers (Connection, Units, Accessibility)
│   ├── types/              # Shot, bag, navigation type definitions
│   ├── utils/              # ballistics, trajectory (RK4), shotQuality, units, shotShape
│   └── theme.ts            # Color, radius, glow, animation, glass tokens
├── android/                # Generated native project (expo prebuild)
└── ios/                    # Generated native project (expo prebuild)
```

## Security defaults

- **At rest:** the shot database uses SQLCipher with a per-device key in the Keychain/Keystore. A
  device-integrity stamp wipes the DB if the file lands on a different device. See
  [docs/bag-database-schema.md](../docs/bag-database-schema.md).
- **BLE:** HMAC-SHA256 challenge-response with a paired secret, constant-time verification on the
  Pi, rotating nonce.

## Testing

`npm test` runs the Jest suite under the `jest-expo` preset. Put component tests next to the code
as `*.test.tsx`. The web kiosk UI has its own suite under `ui/`, and the Python backend uses
pytest. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full three-suite layout.
