import * as SQLite from 'expo-sqlite';
import type { Shot } from '../types/shot';

const db = SQLite.openDatabaseSync('openflight.db');

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      connection_type TEXT NOT NULL DEFAULT 'unknown',
      shot_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      club TEXT NOT NULL,
      ball_speed_mph REAL NOT NULL,
      club_speed_mph REAL,
      smash_factor REAL,
      estimated_carry_yards REAL NOT NULL,
      carry_spin_adjusted REAL,
      carry_range_low REAL,
      carry_range_high REAL,
      launch_angle_vertical REAL,
      launch_angle_horizontal REAL,
      launch_angle_confidence REAL,
      angle_source TEXT,
      club_angle_deg REAL,
      club_path_deg REAL,
      spin_axis_deg REAL,
      spin_rpm REAL,
      spin_confidence REAL,
      spin_quality TEXT,
      apex_height_yards REAL,
      total_distance_yards REAL,
      face_to_path_deg REAL,
      is_mishit INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_shots_session ON shots(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
  `);
}

export function createSession(connectionType: string): string {
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.runSync(
    'INSERT INTO sessions (id, started_at, connection_type) VALUES (?, ?, ?)',
    [id, new Date().toISOString(), connectionType],
  );
  return id;
}

export function endSession(id: string): void {
  db.runSync('UPDATE sessions SET ended_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}

export function saveShot(sessionId: string, shot: Shot): void {
  const shotId = `sh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.runSync(
    `INSERT OR IGNORE INTO shots (
      id, session_id, recorded_at, club, ball_speed_mph, club_speed_mph,
      smash_factor, estimated_carry_yards, carry_spin_adjusted,
      carry_range_low, carry_range_high, launch_angle_vertical,
      launch_angle_horizontal, launch_angle_confidence, angle_source,
      club_angle_deg, club_path_deg, spin_axis_deg, spin_rpm,
      spin_confidence, spin_quality, apex_height_yards, total_distance_yards,
      face_to_path_deg, is_mishit
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      shot.face_to_path_deg ?? null, shot.is_mishit ? 1 : 0,
    ],
  );
  db.runSync('UPDATE sessions SET shot_count = shot_count + 1 WHERE id = ?', [sessionId]);
}

export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  connection_type: string;
  shot_count: number;
}

export function getSessions(): SessionRow[] {
  return db.getAllSync<SessionRow>(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100',
  );
}

export function getShotsForSession(sessionId: string): Shot[] {
  const rows = db.getAllSync<Record<string, unknown>>(
    'SELECT * FROM shots WHERE session_id = ? ORDER BY recorded_at ASC',
    [sessionId],
  );
  return rows.map(rowToShot);
}

function rowToShot(r: Record<string, unknown>): Shot {
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
    angle_source: (r.angle_source as Shot['angle_source']) ?? null,
    club_angle_deg: (r.club_angle_deg as number | null) ?? null,
    club_path_deg: (r.club_path_deg as number | null) ?? null,
    spin_axis_deg: (r.spin_axis_deg as number | null) ?? null,
    spin_rpm: (r.spin_rpm as number | null) ?? null,
    spin_confidence: (r.spin_confidence as number | null) ?? null,
    spin_quality: (r.spin_quality as Shot['spin_quality']) ?? null,
    apex_height_yards: (r.apex_height_yards as number | null) ?? null,
    total_distance_yards: (r.total_distance_yards as number | null) ?? null,
    face_to_path_deg: (r.face_to_path_deg as number | null) ?? null,
    is_mishit: r.is_mishit === 1,
  };
}
