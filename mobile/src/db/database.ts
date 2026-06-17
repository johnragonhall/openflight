import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { open } from '@op-engineering/op-sqlite';
import type { Shot, ClubLifetimeStat, ClubSessionPoint } from '../types/shot';

// ------------------------------------------------------------------
// Database security layer
//
// At-rest encryption: SQLCipher (via @op-engineering/op-sqlite).
// The encryption key is the per-device UUID stored in Android Keystore
// / iOS Keychain via expo-secure-store - hardware-backed on supported
// devices. Without the Keystore key the database file cannot be
// decrypted.
//
// Additionally, a SHA-256 integrity hash ties the database to this
// specific device installation. If the encrypted file is transferred to
// a different device (different Keystore), the hash mismatch triggers a
// full wipe on next open - belt-and-suspenders on top of encryption.
//
// ADB backup is disabled in AndroidManifest (allowBackup=false), which
// is the primary extraction vector on non-rooted devices.
// ------------------------------------------------------------------

const DEVICE_KEY_STORE = 'openflight.db-device-key';
type Database = ReturnType<typeof open>;
let _db: Database | null = null;
let _initPromise: Promise<void> | null = null;

function getDb(): Database {
  if (!_db) throw new Error('Database not initialised - call initDatabase() first');
  return _db;
}

/** Expose the shared DB handle to sibling modules (e.g. bagDatabase). */
export function getDatabase(): Database {
  return getDb();
}

async function getOrCreateDeviceKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DEVICE_KEY_STORE);
  if (!key) {
    key = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_KEY_STORE, key);
  }
  return key;
}

async function buildIntegrityHash(deviceKey: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `openflight:${deviceKey}`,
  );
}

export function initDatabase(): Promise<void> {
  if (!_initPromise) _initPromise = _init();
  return _initPromise;
}

async function _init(): Promise<void> {
  const deviceKey = await getOrCreateDeviceKey();
  const expectedHash = await buildIntegrityHash(deviceKey);

  // SQLCipher key is the hardware-backed device UUID - never leaves the Keystore.
  _db = open({ name: 'openflight.db', encryptionKey: deviceKey });
  const db = _db;

  await db.execute(
    `CREATE TABLE IF NOT EXISTS _db_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS sessions (
      id              TEXT PRIMARY KEY,
      started_at      TEXT NOT NULL,
      ended_at        TEXT,
      connection_type TEXT NOT NULL DEFAULT 'unknown',
      shot_count      INTEGER NOT NULL DEFAULT 0
    )`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS shots (
      id                      TEXT PRIMARY KEY,
      session_id              TEXT NOT NULL,
      recorded_at             TEXT NOT NULL,
      club                    TEXT NOT NULL,
      ball_speed_mph          REAL NOT NULL,
      club_speed_mph          REAL,
      smash_factor            REAL,
      estimated_carry_yards   REAL NOT NULL,
      carry_spin_adjusted     REAL,
      carry_range_low         REAL,
      carry_range_high        REAL,
      launch_angle_vertical   REAL,
      launch_angle_horizontal REAL,
      launch_angle_confidence REAL,
      angle_source            TEXT,
      club_angle_deg          REAL,
      club_path_deg           REAL,
      spin_axis_deg           REAL,
      spin_rpm                REAL,
      spin_confidence         REAL,
      spin_quality            TEXT,
      apex_height_yards       REAL,
      total_distance_yards    REAL,
      face_to_path_deg        REAL,
      is_mishit               INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )`,
  );
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_shots_session ON shots(session_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)`);

  // Schema migrations - idempotent; ALTER TABLE throws if column already exists.
  await db.execute('ALTER TABLE shots ADD COLUMN carry_side_yards REAL').catch(() => {});
  await db.execute('ALTER TABLE shots ADD COLUMN curve_yards REAL').catch(() => {});

  // Bag feature tables (lazy import to avoid circular deps at module load time)
  const { initBagTables } = await import('./bagDatabase');
  await initBagTables();

  const metaResult = await db.execute(
    "SELECT value FROM _db_meta WHERE key = 'device_integrity'",
  );
  const existing = (metaResult.rows as { value: string }[])?.[0];

  if (!existing) {
    await db.execute(
      "INSERT INTO _db_meta (key, value) VALUES ('device_integrity', ?)",
      [expectedHash],
    );
  } else if (existing.value !== expectedHash) {
    // Encrypted file opened with correct SQLCipher key but integrity stamp
    // doesn't match this Keystore - e.g. restored to a different device.
    // Wipe and re-stamp so callers never see another installation's data.
    await db.execute('BEGIN');
    try {
      await db.execute('DELETE FROM shots');
      await db.execute('DELETE FROM sessions');
      await db.execute('DELETE FROM _db_meta');
      await db.execute(
        "INSERT INTO _db_meta (key, value) VALUES ('device_integrity', ?)",
        [expectedHash],
      );
      await db.execute('COMMIT');
    } catch (txErr) {
      await db.execute('ROLLBACK');
      throw txErr;
    }
  }
}

export async function createSession(connectionType: string): Promise<string> {
  const id = `s_${Crypto.randomUUID()}`;
  await getDb().execute(
    'INSERT INTO sessions (id, started_at, connection_type) VALUES (?, ?, ?)',
    [id, new Date().toISOString(), connectionType],
  );
  return id;
}

export async function endSession(id: string): Promise<void> {
  await getDb().execute(
    'UPDATE sessions SET ended_at = ? WHERE id = ?',
    [new Date().toISOString(), id],
  );
}

export async function saveShot(sessionId: string, shot: Shot): Promise<string> {
  const shotId = `sh_${Crypto.randomUUID()}`;
  await getDb().execute(
    `INSERT OR IGNORE INTO shots (
      id, session_id, recorded_at, club, ball_speed_mph, club_speed_mph,
      smash_factor, estimated_carry_yards, carry_spin_adjusted,
      carry_range_low, carry_range_high, launch_angle_vertical,
      launch_angle_horizontal, launch_angle_confidence, angle_source,
      club_angle_deg, club_path_deg, spin_axis_deg, spin_rpm,
      spin_confidence, spin_quality, apex_height_yards, total_distance_yards,
      carry_side_yards, curve_yards, face_to_path_deg, is_mishit
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      shotId, sessionId, shot.timestamp, shot.club,
      shot.ball_speed_mph, shot.club_speed_mph ?? null, shot.smash_factor ?? null,
      shot.estimated_carry_yards, shot.carry_spin_adjusted ?? null,
      shot.carry_range?.[0] ?? null, shot.carry_range?.[1] ?? null,
      shot.launch_angle_vertical ?? null, shot.launch_angle_horizontal ?? null,
      shot.launch_angle_confidence ?? null, shot.angle_source ?? null,
      shot.club_angle_deg ?? null, shot.club_path_deg ?? null,
      shot.spin_axis_deg ?? null, shot.spin_rpm ?? null,
      shot.spin_confidence ?? null, shot.spin_quality ?? null,
      shot.apex_height_yards ?? null, shot.total_distance_yards ?? null,
      shot.carry_side_yards ?? null, shot.curve_yards ?? null,
      shot.face_to_path_deg ?? null, shot.is_mishit ? 1 : 0,
    ],
  );
  await getDb().execute(
    'UPDATE sessions SET shot_count = shot_count + 1 WHERE id = ?',
    [sessionId],
  );
  return shotId;
}

export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  connection_type: string;
  shot_count: number;
}

export async function getSessions(): Promise<SessionRow[]> {
  const result = await getDb().execute(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT 500',
  );
  return ((result.rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    started_at: r.started_at as string,
    ended_at: (r.ended_at as string | null) ?? null,
    connection_type: r.connection_type as string,
    shot_count: r.shot_count as number,
  }));
}

export async function getShotsForSession(sessionId: string): Promise<Shot[]> {
  const result = await getDb().execute(
    'SELECT * FROM shots WHERE session_id = ? ORDER BY recorded_at ASC',
    [sessionId],
  );
  const rows = (result.rows ?? []) as Record<string, unknown>[];
  return rows.map(rowToShot);
}

const VALID_ANGLE_SOURCES = new Set<string>(['radar', 'camera', 'estimated']);
const VALID_SPIN_QUALITIES = new Set<string>(['high', 'medium', 'low']);

function rowToShot(r: Record<string, unknown>): Shot {
  const rawAngleSource = typeof r.angle_source === 'string' ? r.angle_source : null;
  const rawSpinQuality = typeof r.spin_quality === 'string' ? r.spin_quality : null;
  return {
    timestamp: r.recorded_at as string,
    club: r.club as string,
    ball_speed_mph: r.ball_speed_mph as number,
    club_speed_mph: (r.club_speed_mph as number | null) ?? null,
    smash_factor: (r.smash_factor as number | null) ?? null,
    estimated_carry_yards: r.estimated_carry_yards as number,
    carry_spin_adjusted: (r.carry_spin_adjusted as number | null) ?? null,
    carry_range: [
      (r.carry_range_low as number | null) ?? 0,
      (r.carry_range_high as number | null) ?? 0,
    ],
    peak_magnitude: null,
    launch_angle_vertical: (r.launch_angle_vertical as number | null) ?? null,
    launch_angle_horizontal: (r.launch_angle_horizontal as number | null) ?? null,
    launch_angle_confidence: (r.launch_angle_confidence as number | null) ?? null,
    angle_source: (rawAngleSource && VALID_ANGLE_SOURCES.has(rawAngleSource.toLowerCase())
      ? rawAngleSource.toLowerCase() as Shot['angle_source']
      : null),
    club_angle_deg: (r.club_angle_deg as number | null) ?? null,
    club_path_deg: (r.club_path_deg as number | null) ?? null,
    spin_axis_deg: (r.spin_axis_deg as number | null) ?? null,
    spin_rpm: (r.spin_rpm as number | null) ?? null,
    spin_confidence: (r.spin_confidence as number | null) ?? null,
    spin_quality: (rawSpinQuality && VALID_SPIN_QUALITIES.has(rawSpinQuality.toLowerCase())
      ? rawSpinQuality.toLowerCase() as Shot['spin_quality']
      : null),
    apex_height_yards: (r.apex_height_yards as number | null) ?? null,
    total_distance_yards: (r.total_distance_yards as number | null) ?? null,
    carry_side_yards: (r.carry_side_yards as number | null) ?? null,
    curve_yards: (r.curve_yards as number | null) ?? null,
    face_to_path_deg: (r.face_to_path_deg as number | null) ?? null,
    is_mishit: r.is_mishit === 1,
  };
}

export async function deleteShot(shotId: string): Promise<void> {
  const db = getDb();
  const shot = await db.execute('SELECT session_id FROM shots WHERE id = ?', [shotId]);
  const row = ((shot.rows ?? []) as { session_id: string }[])[0];
  await db.execute('DELETE FROM shots WHERE id = ?', [shotId]);
  if (row?.session_id) {
    await db.execute(
      'UPDATE sessions SET shot_count = MAX(0, shot_count - 1) WHERE id = ?',
      [row.session_id],
    );
  }
}

export async function getLifetimeStatsByClub(): Promise<ClubLifetimeStat[]> {
  const result = await getDb().execute(`
    SELECT
      club,
      COUNT(*)                                                              AS shot_count,
      AVG(COALESCE(carry_spin_adjusted, estimated_carry_yards))            AS avg_carry,
      AVG(total_distance_yards)                                            AS avg_total,
      MIN(COALESCE(carry_spin_adjusted, estimated_carry_yards))            AS min_carry,
      MAX(COALESCE(carry_spin_adjusted, estimated_carry_yards))            AS max_carry,
      CASE WHEN COUNT(*) > 1 THEN
        MAX(0,
          AVG(COALESCE(carry_spin_adjusted, estimated_carry_yards) *
              COALESCE(carry_spin_adjusted, estimated_carry_yards)) -
          AVG(COALESCE(carry_spin_adjusted, estimated_carry_yards)) *
          AVG(COALESCE(carry_spin_adjusted, estimated_carry_yards))
        )
      ELSE NULL END                                                        AS var_carry
    FROM shots
    GROUP BY club
    ORDER BY club
  `);
  const rows = (result.rows ?? []) as Record<string, unknown>[];
  // op-sqlite has no SQRT(); compute the standard deviation in JS from the
  // population variance (E[X²] − E[X]²) returned by the query.
  return rows.map((r) => {
    const variance = (r.var_carry as number | null) ?? null;
    return {
      club: r.club as string,
      shot_count: r.shot_count as number,
      avg_carry: (r.avg_carry as number | null) ?? 0,
      avg_total: (r.avg_total as number | null) ?? null,
      min_carry: (r.min_carry as number | null) ?? 0,
      max_carry: (r.max_carry as number | null) ?? 0,
      std_dev_carry: variance != null ? Math.sqrt(variance) : null,
    };
  });
}

export async function getClubSessionTrend(club: string): Promise<ClubSessionPoint[]> {
  // Returns up to the 20 most-recent sessions for this club (chronological order).
  const result = await getDb().execute(`
    SELECT
      s.started_at                                                          AS session_date,
      AVG(COALESCE(sh.carry_spin_adjusted, sh.estimated_carry_yards))     AS avg_carry,
      AVG(sh.total_distance_yards)                                         AS avg_total,
      COUNT(*)                                                             AS shot_count
    FROM shots sh
    JOIN sessions s ON sh.session_id = s.id
    WHERE sh.club = ?
    GROUP BY s.id
    ORDER BY s.started_at ASC
    LIMIT 20
  `, [club]);
  const rows = (result.rows ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    session_date: r.session_date as string,
    avg_carry: (r.avg_carry as number | null) ?? 0,
    avg_total: (r.avg_total as number | null) ?? null,
    shot_count: r.shot_count as number,
  }));
}
