import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UnitSystem } from '../utils/units';
import { UnitPreferenceContext } from './UnitPreferenceContext';

const STORAGE_KEY = 'openflight.unit-system';

// Cache the async read so remounts (e.g. Strict Mode double-invoke) don't
// re-issue the I/O — the value is stable for the lifetime of the process.
let cachedUnitSystem: UnitSystem | null = null;
const unitSystemPromise: Promise<UnitSystem> = AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    cachedUnitSystem = v === 'metric' ? 'metric' : 'imperial';
    return cachedUnitSystem;
  })
  .catch(() => {
    cachedUnitSystem = 'imperial';
    return cachedUnitSystem;
  });

export function UnitPreferenceProvider({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(
    () => cachedUnitSystem ?? 'imperial',
  );

  useEffect(() => {
    if (cachedUnitSystem !== null) return;
    unitSystemPromise.then(setUnitSystemState).catch(() => {});
  }, []);

  const setUnitSystem = useCallback((next: UnitSystem) => {
    setUnitSystemState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => { /* silent */ });
  }, []);

  const value = useMemo(() => ({ unitSystem, setUnitSystem }), [unitSystem, setUnitSystem]);

  return (
    <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>
  );
}
