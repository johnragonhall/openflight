# Plan: Complete & Thorough Documentation

Date: 2026-06-15
Scope agreed via grill-me: project docs (full) + author local skills/agents + install existing
marketplace skills (no publishing). Mobile = full deep dive. Audience = both layered (user guides +
contributor architecture). Prose follows the stop-slop rules.

## Why this work exists

The `mobile/` Expo app shipped across ~20 commits with no README and no docs. `README.md`,
`AGENTS.md`, and `CLAUDE.md` still describe a radar-only system. Several server and kiosk features
(roll-distance, history REST endpoint, camera stream, accessibility relay, TV mode) ship with no
written reference. This plan closes the gap and adds skills so future agents ramp without
re-deriving the architecture.

---

## Workstream 1 - New deep-dive docs

Contributor-facing (architecture, schemas, protocols):

1. `mobile/README.md` - install, Expo scripts (`start`/`android`/`ios`/`prebuild`/`lint`/`test`),
   device build, kiosk host config, folder map, connection modes (BLE + WebSocket).
2. `docs/mobile-architecture.md` - navigation tree (stack + bottom tabs), the three context
   providers (Connection, UnitPreference, Accessibility), the op-sqlite data layer, theming, and a
   component catalog (tracers, charts, metric cards).
3. `docs/mobile-ble-protocol.md` - service + characteristic UUIDs, the HMAC challenge handshake,
   the base64-JSON command schema, shot/status notifications, and the server-side BLE relay.
4. `docs/bag-database-schema.md` - `clubs` table columns, the `shots.club_def_id` migration, the
   `idx_clubs_bag` index, query functions, and the fitting-range data.
5. `docs/gps-encryption.md` - AES-256-GCM field encryption, key storage in expo-secure-store, the
   IV+ciphertext wire format, and the threat model (defense-in-depth over SQLCipher).
6. `docs/mobile-accessibility.md` - a11y settings, reduce-motion (OS + in-app), font scale, theme
   colors, and the `client_prefs` relay to the kiosk over WebSocket and BLE.
7. `docs/shot-visualization.md` - 2D/3D tracer geometry, dispersion chart, trend line, shape bar.
8. `docs/server-api.md` - REST reference (`/api/history`, `/api/history/<id>/shots`,
   `/api/pair-qr`, `/camera/stream`, `/api/shutdown`) and the full WebSocket event catalog.

User-facing (layered, task walkthroughs):

9. `docs/mobile-app-guide.md` - pairing, bag setup, range and stats use, course/GPS, settings.
10. README TV-mode expansion - Tizen/webOS detection and D-pad navigation (extend existing
    "TV Display Mode" section rather than a new file).

## Workstream 2 - Bring stale docs in sync

11. `README.md` - move "Mobile app" from roadmap to a real feature; add `mobile/` to Project
    Structure; list the new docs in the Documentation index; note roll-distance, history, camera.
12. `docs/CHANGELOG.md` `[Unreleased]` - add: mobile app, kiosk TV mode, a11y panel + relay,
    history endpoint, camera stream, roll-distance, pairing QR, GPS encryption.
13. `AGENTS.md` + root `CLAUDE.md` (twins, kept identical) - add mobile architecture and commands,
    new server endpoints, roll-distance, and the a11y relay.
14. `CONTRIBUTING.md` - mobile contribution flow, Expo build/test commands, the three-suite test
    layout (pytest + ui jest + mobile jest).
15. `PRODUCT.md` + `DESIGN.md` - mobile companion is now real; record glass-material tokens and a11y.
16. `README_AGENT_RUNBOOK.md` - mobile build steps and the current command set.

## Workstream 3 - Author local skills/agents

17. `.claude/skills/openflight-architecture.md` - encodes the full system map (radar/spin/KLD7
    pipeline, mobile BLE/WS, kiosk, server endpoints, doc index) so agents skip re-exploration.
18. `.claude/agents/doc-keeper.md` - agent that audits code-vs-docs drift against this repo's doc map.
19. `.claude/skills/mobile-onboarding.md` - OpenFlight mobile specifics (BLE pairing, bag schema,
    connection contexts) layered on the generic react-native-expo skill.

## Workstream 4 - Wire existing marketplace skills

20. Install/reference into the project: `flask-socketio-realtime`, `raspberry-pi-python`,
    `react-native-expo`, `modern-python`, `codspeed`. Record them in a `.claude/skills/README.md`
    index that maps each skill to the part of the codebase it covers. (Install only - no publishing.)

---

## Verification

- Every internal doc link resolves (check relative paths against the file tree).
- `mobile/README.md` commands match `mobile/package.json` scripts.
- `docs/server-api.md` endpoints match `src/openflight/server.py` routes/events.
- `AGENTS.md` and root `CLAUDE.md` stay byte-identical in shared sections.
- No code changes; docs only. No publishing to public marketplaces.

## Suggested execution order (batched for review)

- Batch A: Workstream 1 docs 1–8 (contributor deep dive).
- Batch B: Workstream 1 docs 9–10 (user guides) + Workstream 2 (sync stale docs).
- Batch C: Workstream 3 (skills/agents) + Workstream 4 (wire marketplace skills).
