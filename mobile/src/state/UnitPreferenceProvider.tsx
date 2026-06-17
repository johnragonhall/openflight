import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  SpeedUnit, DistanceUnit, TemperatureUnit, SupportedLanguage,
} from '../utils/units';
import { UnitPreferenceContext } from './UnitPreferenceContext';

const KEYS = {
  speed: 'openflight.speed-unit',
  distance: 'openflight.distance-unit',
  temperature: 'openflight.temperature-unit',
  language: 'openflight.language',
  legacy: 'openflight.unit-system',
} as const;

type Prefs = {
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  language: SupportedLanguage;
};

const DEFAULTS: Prefs = {
  speedUnit: 'mph',
  distanceUnit: 'yards',
  temperatureUnit: 'fahrenheit',
  language: 'en',
};

let cachedPrefs: Prefs | null = null;

// Load all prefs once; migrate from legacy unit-system key if granular keys absent
const prefsPromise: Promise<Prefs> = Promise.all([
  AsyncStorage.getItem(KEYS.speed),
  AsyncStorage.getItem(KEYS.distance),
  AsyncStorage.getItem(KEYS.temperature),
  AsyncStorage.getItem(KEYS.language),
  AsyncStorage.getItem(KEYS.legacy),
]).then(([speed, distance, temp, lang, legacy]) => {
  const speedUnit: SpeedUnit =
    (speed as SpeedUnit | null) ?? (legacy === 'metric' ? 'kmh' : 'mph');
  const distanceUnit: DistanceUnit =
    (distance as DistanceUnit | null) ?? (legacy === 'metric' ? 'meters' : 'yards');
  cachedPrefs = {
    speedUnit,
    distanceUnit,
    temperatureUnit: (temp as TemperatureUnit | null) ?? 'fahrenheit',
    language: (lang as SupportedLanguage | null) ?? 'en',
  };
  return cachedPrefs;
}).catch(() => {
  cachedPrefs = { ...DEFAULTS };
  return cachedPrefs;
});

export function UnitPreferenceProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => cachedPrefs ?? { ...DEFAULTS });

  useEffect(() => {
    if (cachedPrefs !== null) return;
    prefsPromise.then(setPrefs).catch(() => {});
  }, []);

  const setSpeedUnit = useCallback((unit: SpeedUnit) => {
    setPrefs(p => ({ ...p, speedUnit: unit }));
    AsyncStorage.setItem(KEYS.speed, unit).catch(() => {});
  }, []);

  const setDistanceUnit = useCallback((unit: DistanceUnit) => {
    setPrefs(p => ({ ...p, distanceUnit: unit }));
    AsyncStorage.setItem(KEYS.distance, unit).catch(() => {});
  }, []);

  const setTemperatureUnit = useCallback((unit: TemperatureUnit) => {
    setPrefs(p => ({ ...p, temperatureUnit: unit }));
    AsyncStorage.setItem(KEYS.temperature, unit).catch(() => {});
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setPrefs(p => ({ ...p, language: lang }));
    AsyncStorage.setItem(KEYS.language, lang).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    speedUnit: prefs.speedUnit,
    distanceUnit: prefs.distanceUnit,
    temperatureUnit: prefs.temperatureUnit,
    language: prefs.language,
    setSpeedUnit,
    setDistanceUnit,
    setTemperatureUnit,
    setLanguage,
  }), [prefs, setSpeedUnit, setDistanceUnit, setTemperatureUnit, setLanguage]);

  return (
    <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>
  );
}
