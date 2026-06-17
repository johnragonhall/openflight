import { useCallback, useEffect, useRef, useState } from 'react';
import type { Shot } from '../types/shot';
import { enrichShot } from '../utils/ballistics';
import { initDatabase, createSession, endSession, saveShot } from '../db/database';
import { logger } from '../utils/logger';

export interface UseShotPersistenceArgs {
  latestShot: Shot | null;
  connected: boolean;
  connectionLabel: string;
}

export interface ShotPersistence {
  /** Non-null when the local DB could not be opened - surface to the user. */
  dbError: string | null;
  /** End the current DB session and start a fresh one (if connected). */
  resetSession: () => void;
  /** Clear the surfaced DB error after the user dismisses it. */
  dismissDbError: () => void;
}

// Identity of a shot for de-duplication. Timestamp alone collides when two
// shots share a timestamp (Issue 3), so combine it with the speed/carry.
function shotKey(s: Shot): string {
  return `${s.timestamp}|${s.ball_speed_mph}|${s.estimated_carry_yards}`;
}

/**
 * Owns shot persistence: DB init, per-connection session lifecycle, and
 * saving each shot exactly once.
 *
 * Robustness over the previous in-App effects:
 *  - de-dupes by a composite key, not timestamp alone;
 *  - buffers shots that arrive before the DB session exists and flushes them
 *    once it does, so no early shot is dropped.
 */
export function useShotPersistence({
  latestShot,
  connected,
  connectionLabel,
}: UseShotPersistenceArgs): ShotPersistence {
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const savedKeysRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Shot[]>([]);

  const persist = useCallback((sessionId: string, shot: Shot) => {
    saveShot(sessionId, enrichShot(shot)).catch((err) => {
      logger.error('Failed to save shot:', err);
    });
  }, []);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        logger.error('Database init failed:', err);
        setDbError('Could not open local history. Shots won’t be saved this session.');
      });
  }, []);

  // Open a DB session on first connect, then flush any buffered early shots.
  useEffect(() => {
    if (!dbReady || !connected || sessionIdRef.current) return;
    createSession(connectionLabel)
      .then((id) => {
        sessionIdRef.current = id;
        const buffered = pendingRef.current;
        pendingRef.current = [];
        for (const shot of buffered) persist(id, shot);
      })
      .catch((err) => logger.error('Failed to create session:', err));
  }, [connected, connectionLabel, dbReady, persist]);

  // Persist each new shot exactly once; buffer until a session exists.
  useEffect(() => {
    if (!latestShot) return;
    const key = shotKey(latestShot);
    if (savedKeysRef.current.has(key)) return;
    savedKeysRef.current.add(key);

    const id = sessionIdRef.current;
    if (!id) {
      pendingRef.current.push(latestShot);
      return;
    }
    persist(id, latestShot);
  }, [latestShot, persist]);

  const resetSession = useCallback(() => {
    const oldId = sessionIdRef.current;
    sessionIdRef.current = null;
    savedKeysRef.current.clear();
    pendingRef.current = [];
    if (oldId) endSession(oldId).catch((err) => logger.error('Failed to end session:', err));
    if (connected) {
      createSession(connectionLabel)
        .then((id) => { sessionIdRef.current = id; })
        .catch((err) => logger.error('Failed to create session:', err));
    }
  }, [connected, connectionLabel]);

  const dismissDbError = useCallback(() => setDbError(null), []);

  return { dbError, resetSession, dismissDbError };
}
