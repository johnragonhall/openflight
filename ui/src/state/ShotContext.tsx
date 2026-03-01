import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Shot } from '../types/shot';

interface ShotContextValue {
  latestShot: Shot | null;
  shots: Shot[];
  isNewShot: boolean;
  addShot: (shot: Shot) => void;
  setShots: (shots: Shot[]) => void;
  clearShots: () => void;
}

const ShotContext = createContext<ShotContextValue | null>(null);

/** Duration to keep isNewShot true — covers the longest animation (shot-glow: 2s) */
const NEW_SHOT_DURATION_MS = 2500;

export function ShotProvider({ children }: { children: ReactNode }) {
  const [latestShot, setLatestShot] = useState<Shot | null>(null);
  const [shots, setShotsState] = useState<Shot[]>([]);
  const [isNewShot, setIsNewShot] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addShot = useCallback((shot: Shot) => {
    setLatestShot(shot);
    setShotsState((prev) => {
      const updated = [...prev, shot];
      // Keep only last 200 shots in UI state to prevent memory issues
      return updated.length > 200 ? updated.slice(-200) : updated;
    });

    setIsNewShot(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsNewShot(false), NEW_SHOT_DURATION_MS);
  }, []);

  const setShots = useCallback((newShots: Shot[]) => {
    setShotsState(newShots);
    if (newShots.length > 0) {
      setLatestShot(newShots[newShots.length - 1]);
    }
    // Session restore — don't trigger animations
  }, []);

  const clearShots = useCallback(() => {
    setLatestShot(null);
    setShotsState([]);
    setIsNewShot(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <ShotContext.Provider value={{ latestShot, shots, isNewShot, addShot, setShots, clearShots }}>
      {children}
    </ShotContext.Provider>
  );
}

export function useShotContext(): ShotContextValue {
  const ctx = useContext(ShotContext);
  if (!ctx) {
    throw new Error('useShotContext must be used within a <ShotProvider>');
  }
  return ctx;
}
