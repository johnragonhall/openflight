# Mobile Accessibility and Preference Relay

The mobile app carries four accessibility preferences, persists them locally, and relays them to
the kiosk so the big screen matches the phone. This covers the prefs, how they apply in the app,
and how they reach the kiosk over both transports.

- Storage: `mobile/src/state/accessibilitySettings.ts`
- Provider and hooks: `mobile/src/state/AccessibilityProvider.tsx`, `useAccessibility`,
  `useFontScale`, `useThemeColors`
- Relay (client): `useSocketConnection` (`client_prefs`), `useBLEConnection` (`set_prefs`)
- Relay (server): `client_prefs` handler in `src/openflight/server.py`

## The four preferences

`AccessibilityPrefs` in `accessibilitySettings.ts`:

| Key | Meaning |
|-----|---------|
| `reduceMotion` | Cut or shorten animations and transitions. |
| `highContrast` | Stronger foreground/background separation. |
| `largeText` | Bump font scale across the app. |
| `colorBlind` | Blue/orange palette safe for red-green color blindness (deuteranopia). |

Each is a boolean, default `false`. They persist in AsyncStorage under `a11y.*` keys. The module
caches the parsed prefs in memory; `setAccessibilityPref` updates both the cache and storage, and
`clearAccessibilityCache` resets the cache (used in tests).

## How prefs apply in the app

- `useFontScale` turns `largeText` into a scale multiplier for text components.
- `useThemeColors` swaps the palette when `highContrast` or `colorBlind` is on, layered on the base
  tokens in `theme.ts`.
- `reduceMotion` combines the OS-level setting with the in-app toggle (`useReduceMotion`); motion
  primitives (`PressableScale`, `RadarPulse`, `AnimatedTabBar`, the tracers' draw-on) check it
  before animating.

## Relay to the kiosk

When the phone connects, it sends the current prefs so the kiosk renders consistently. Both
transports read prefs through `getAccessibilityPrefs()`:

- **Wi-Fi:** on `connect`, `useSocketConnection` emits
  `client_prefs` with `{ accessibility: <prefs> }`.
- **BLE:** right after auth, `useBLEConnection` writes
  `{ cmd: "set_prefs", accessibility: <prefs> }` to the Command characteristic. `sendClientPrefs`
  re-sends on demand if prefs change mid-session.

On the server, the `client_prefs` Socket.IO handler sanitizes the payload and re-emits
`accessibility_prefs_update` with `{ accessibility: <sanitized> }`, which the kiosk UI applies as
CSS class overrides (reduce-motion, high-contrast, large-text). The kiosk's own accessibility panel
and the relayed prefs share the same CSS layer.

## Adding a preference

1. Add the key to `AccessibilityPrefs`, `DEFAULT_A11Y_PREFS`, and the `KEYS` map.
2. Apply it through `useThemeColors`/`useFontScale` or the relevant motion primitive.
3. Extend the server `client_prefs` sanitizer and the kiosk CSS override layer so the relay carries
   it end to end.
