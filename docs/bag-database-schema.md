# Mobile Database Schema

The mobile app stores sessions, shots, and the club bag in a single SQLCipher database
(`openflight.db`) via `@op-engineering/op-sqlite`. This is the schema, the migration approach, and
the query surface.

- Core tables and shot persistence: `mobile/src/db/database.ts`
- Bag tables and stats joins: `mobile/src/db/bagDatabase.ts`

## At-rest security

`initDatabase()` opens the file with `encryptionKey` set to a per-device UUID held in the
Keychain/Keystore via expo-secure-store (`openflight.db-device-key`). Without that key the file
will not decrypt.

A second layer: a SHA-256 integrity stamp `SHA256("openflight:" + deviceKey)` is written to
`_db_meta`. If the encrypted file is restored to a different device (different Keystore key), the
stamp mismatches and `_init` wipes `shots`, `sessions`, and `_db_meta` inside a transaction before
re-stamping, so one install never reads another's data. Android sets `allowBackup=false` to close
the ADB extraction vector.

## Tables

### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `s_<uuid>` |
| `started_at` | TEXT NOT NULL | ISO 8601 |
| `ended_at` | TEXT | ISO 8601, null while active |
| `connection_type` | TEXT NOT NULL | `Wi-Fi`, `BLE`, or `unknown` |
| `shot_count` | INTEGER NOT NULL | maintained by `saveShot`/`deleteShot` |

Index: `idx_sessions_started (started_at)`.

### `shots`

`id` (`sh_<uuid>`) PK, `session_id` FK → `sessions(id)`, `recorded_at` (ISO), `club` (server shot
string). Metric columns: `ball_speed_mph` (NOT NULL), `club_speed_mph`, `smash_factor`,
`estimated_carry_yards` (NOT NULL), `carry_spin_adjusted`, `carry_range_low`, `carry_range_high`,
`launch_angle_vertical`, `launch_angle_horizontal`, `launch_angle_confidence`, `angle_source`,
`club_angle_deg`, `club_path_deg`, `spin_axis_deg`, `spin_rpm`, `spin_confidence`, `spin_quality`,
`apex_height_yards`, `total_distance_yards`, `face_to_path_deg`, `is_mishit` (INTEGER, default 0).

Migration-added columns (idempotent `ALTER TABLE` that swallows duplicate-column errors):
`carry_side_yards`, `curve_yards`, and `club_def_id` (added by `bagDatabase` to link a shot to a
specific bag club for future explicit tagging).

Index: `idx_shots_session (session_id)`.

### `clubs` (bag)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `c_<uuid>` |
| `category` | TEXT NOT NULL | `driver`/`wood`/`hybrid`/`iron`/`wedge`/`putter` |
| `type_key` | TEXT NOT NULL | e.g. `7i`, `pw`, `3w` |
| `abbreviation` | TEXT NOT NULL | short label |
| `brand` | TEXT NOT NULL | default `''` |
| `name` | TEXT NOT NULL | default `''` |
| `in_bag` | INTEGER NOT NULL | 1 = bag, 0 = spare |
| `bag_position` | INTEGER NOT NULL | sort order within the bag |

Index: `idx_clubs_bag (in_bag, bag_position)`.

### `_db_meta`

Key/value table. Currently holds the `device_integrity` stamp.

## Migrations

There is no migration framework. `_init` runs `CREATE TABLE IF NOT EXISTS` for the base schema,
then idempotent `ALTER TABLE ... ADD COLUMN` calls that catch and ignore "duplicate column" errors.
To add a column: add it to the create statement for fresh installs, and add a matching guarded
`ALTER TABLE` for existing installs. `initBagTables()` follows the same pattern: its `club_def_id`
`ALTER TABLE` swallows only "duplicate column" errors and re-throws anything else, and its
`CREATE INDEX` for `idx_clubs_bag` swallows only "already exists" errors.

## Club model and the shot-string mapping

The static catalog lives in `mobile/src/types/bag.ts` (`CLUB_CATEGORIES`). The server reports
shots with its own club strings (`7-iron`, `pitching-wedge`, `3-wood`). `SHOT_CLUB_TO_TYPE_KEY`
maps those to bag `type_key`s, and `getShotClubForTypeKey` reverses it so bag stats can join
against `shots.club`. A bag entry only shows stats when its `type_key` has a `shotClub` mapping.

## Query surface

`database.ts`:
- `createSession(connectionType)`, `endSession(id)`
- `saveShot(sessionId, shot)` (INSERT OR IGNORE; bumps `shot_count`), `deleteShot(id)`
- `getSessions()`, `getShotsForSession(sessionId)`
- `getLifetimeStatsByClub()` (count, avg/min/max carry, computed std-dev), `getClubSessionTrend(club)`
  (per-session averages, last 20 sessions)

Carry stats prefer `carry_spin_adjusted` and fall back to `estimated_carry_yards`.

`bagDatabase.ts`:
- CRUD: `createClub`, `getClubs`, `getBagClubs`, `getSpareClubs`, `getClubById`, `updateClub`,
  `deleteClub`
- Bag ops: `moveClubToBag`, `moveClubToSpare`, `reorderBag` (transactional)
- Joins: `getBagClubsWithStats`, `getSpareClubsWithStats`, `getShotHistoryForClub(typeKey, limit)`

`deleteClub` nulls `shots.club_def_id` for the removed club before deleting the row, so shot history
survives club deletion.
