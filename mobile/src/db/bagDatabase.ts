import * as Crypto from 'expo-crypto';
import { getDatabase, getLifetimeStatsByClub } from './database';
import type { Club, ClubWithStats, ClubCategory, ClubCategoryDef } from '../types/bag';
import { SHOT_CLUB_TO_TYPE_KEY, getShotClubForTypeKey } from '../types/bag';

// ── Schema ────────────────────────────────────────────────────────────────────

export async function initBagTables(): Promise<void> {
  const db = getDatabase();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clubs (
      id           TEXT PRIMARY KEY,
      category     TEXT NOT NULL,
      type_key     TEXT NOT NULL,
      abbreviation TEXT NOT NULL,
      brand        TEXT NOT NULL DEFAULT '',
      name         TEXT NOT NULL DEFAULT '',
      in_bag       INTEGER NOT NULL DEFAULT 1,
      bag_position INTEGER NOT NULL DEFAULT 0
    )
  `);
  // Idempotent migration: add club_def_id to shots for future explicit tagging
  await db.execute('ALTER TABLE shots ADD COLUMN club_def_id TEXT').catch(() => {});
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clubs_bag ON clubs(in_bag, bag_position)').catch(() => {});
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createClub(
  club: Omit<Club, 'id'>,
): Promise<Club> {
  const id = `c_${Crypto.randomUUID()}`;
  const db = getDatabase();

  // Auto-increment bag_position if not specified
  let position = club.bag_position;
  if (position === 0) {
    const res = await db.execute(
      'SELECT COALESCE(MAX(bag_position), -1) + 1 AS next FROM clubs WHERE in_bag = 1',
    );
    position = (res.rows as Array<{ next: number }>)?.[0]?.next ?? 0;
  }

  await db.execute(
    `INSERT INTO clubs (id, category, type_key, abbreviation, brand, name, in_bag, bag_position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, club.category, club.type_key, club.abbreviation,
      club.brand, club.name, club.in_bag ? 1 : 0, position,
    ],
  );

  return { ...club, id, bag_position: position };
}

export async function getClubs(): Promise<Club[]> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM clubs ORDER BY in_bag DESC, bag_position ASC',
  );
  return ((result.rows ?? []) as Record<string, unknown>[]).map(rowToClub);
}

export async function getBagClubs(): Promise<Club[]> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM clubs WHERE in_bag = 1 ORDER BY bag_position ASC',
  );
  return ((result.rows ?? []) as Record<string, unknown>[]).map(rowToClub);
}

export async function getSpareClubs(): Promise<Club[]> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM clubs WHERE in_bag = 0 ORDER BY category ASC, type_key ASC',
  );
  return ((result.rows ?? []) as Record<string, unknown>[]).map(rowToClub);
}

export async function getClubById(id: string): Promise<Club | null> {
  const db = getDatabase();
  const result = await db.execute('SELECT * FROM clubs WHERE id = ?', [id]);
  const row = ((result.rows ?? []) as Record<string, unknown>[])[0];
  return row ? rowToClub(row) : null;
}

export async function updateClub(
  id: string,
  updates: Partial<Omit<Club, 'id'>>,
): Promise<void> {
  const db = getDatabase();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.brand !== undefined)       { fields.push('brand = ?');       values.push(updates.brand); }
  if (updates.name !== undefined)        { fields.push('name = ?');        values.push(updates.name); }
  if (updates.in_bag !== undefined)      { fields.push('in_bag = ?');      values.push(updates.in_bag ? 1 : 0); }
  if (updates.bag_position !== undefined){ fields.push('bag_position = ?'); values.push(updates.bag_position); }
  if (updates.abbreviation !== undefined){ fields.push('abbreviation = ?'); values.push(updates.abbreviation); }

  if (fields.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE clubs SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteClub(id: string): Promise<void> {
  const db = getDatabase();
  // Unlink shots that referenced this club
  await db.execute('UPDATE shots SET club_def_id = NULL WHERE club_def_id = ?', [id]);
  await db.execute('DELETE FROM clubs WHERE id = ?', [id]);
}

export async function moveClubToBag(id: string): Promise<void> {
  const db = getDatabase();
  const res = await db.execute(
    'SELECT COALESCE(MAX(bag_position), -1) + 1 AS next FROM clubs WHERE in_bag = 1',
  );
  const position = (res.rows as Array<{ next: number }>)?.[0]?.next ?? 0;
  await db.execute(
    'UPDATE clubs SET in_bag = 1, bag_position = ? WHERE id = ?',
    [position, id],
  );
}

export async function moveClubToSpare(id: string): Promise<void> {
  await updateClub(id, { in_bag: false });
}

export async function reorderBag(orderedIds: string[]): Promise<void> {
  const db = getDatabase();
  await db.execute('BEGIN');
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute('UPDATE clubs SET bag_position = ? WHERE id = ?', [i, orderedIds[i]]);
    }
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
}

// ── Stats join ────────────────────────────────────────────────────────────────

export async function getBagClubsWithStats(): Promise<ClubWithStats[]> {
  const [clubs, allStats] = await Promise.all([
    getBagClubs(),
    getLifetimeStatsByClub(),
  ]);

  // Index existing stats by shots.club string
  const statsByClub: Record<string, { avg_carry: number; avg_total: number | null; shot_count: number }> = {};
  for (const s of allStats) {
    statsByClub[s.club] = { avg_carry: s.avg_carry, avg_total: s.avg_total ?? null, shot_count: s.shot_count };
  }

  return clubs.map((club) => {
    const shotClub = getShotClubForTypeKey(club.type_key);
    const stats = shotClub ? statsByClub[shotClub] : undefined;
    return {
      ...club,
      avg_carry: stats?.avg_carry ?? null,
      avg_total: stats?.avg_total ?? null,
      shot_count: stats?.shot_count ?? 0,
      last_shot_at: null,
    };
  });
}

export async function getSpareClubsWithStats(): Promise<ClubWithStats[]> {
  const [clubs, allStats] = await Promise.all([
    getSpareClubs(),
    getLifetimeStatsByClub(),
  ]);

  const statsByClub: Record<string, { avg_carry: number; avg_total: number | null; shot_count: number }> = {};
  for (const s of allStats) {
    statsByClub[s.club] = { avg_carry: s.avg_carry, avg_total: s.avg_total ?? null, shot_count: s.shot_count };
  }

  return clubs.map((club) => {
    const shotClub = getShotClubForTypeKey(club.type_key);
    const stats = shotClub ? statsByClub[shotClub] : undefined;
    return {
      ...club,
      avg_carry: stats?.avg_carry ?? null,
      avg_total: stats?.avg_total ?? null,
      shot_count: stats?.shot_count ?? 0,
      last_shot_at: null,
    };
  });
}

// ── Shot history per club ─────────────────────────────────────────────────────

export interface ShotHistoryRow {
  id: string;
  recorded_at: string;
  ball_speed_mph: number;
  club_speed_mph: number | null;
  estimated_carry_yards: number;
  carry_spin_adjusted: number | null;
  spin_rpm: number | null;
  session_id: string;
}

export async function getShotHistoryForClub(
  typeKey: string,
  limit = 60,
): Promise<ShotHistoryRow[]> {
  const shotClub = getShotClubForTypeKey(typeKey);
  if (!shotClub) return [];

  const db = getDatabase();
  const result = await db.execute(
    `SELECT id, recorded_at, ball_speed_mph, club_speed_mph,
            estimated_carry_yards, carry_spin_adjusted, spin_rpm, session_id
     FROM shots
     WHERE club = ?
     ORDER BY recorded_at DESC
     LIMIT ?`,
    [shotClub, limit],
  );
  return ((result.rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    recorded_at: r.recorded_at as string,
    ball_speed_mph: r.ball_speed_mph as number,
    club_speed_mph: (r.club_speed_mph as number | null) ?? null,
    estimated_carry_yards: r.estimated_carry_yards as number,
    carry_spin_adjusted: (r.carry_spin_adjusted as number | null) ?? null,
    spin_rpm: (r.spin_rpm as number | null) ?? null,
    session_id: r.session_id as string,
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToClub(r: Record<string, unknown>): Club {
  return {
    id: r.id as string,
    category: r.category as ClubCategory,
    type_key: r.type_key as string,
    abbreviation: r.abbreviation as string,
    brand: r.brand as string,
    name: r.name as string,
    in_bag: (r.in_bag as number) === 1,
    bag_position: r.bag_position as number,
  };
}
