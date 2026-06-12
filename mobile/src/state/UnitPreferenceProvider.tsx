import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UnitSystem } from '../utils/units';
import { UnitPreferenceContext } from './UnitPreferenceContext';

const STORAGE_KEY = 'openflight.unit-system';

export function UnitPreferenceProvider({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('imperial');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'metric') setUnitSystemState('metric');
      })
      .catch(() => { /* use default */ });
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
