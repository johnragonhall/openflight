import { createContext } from 'react';
import type {
  UnitSystem, SpeedUnit, DistanceUnit, TemperatureUnit, SupportedLanguage,
} from '../utils/units';

export interface UnitPreferenceContextValue {
  unitSystem: UnitSystem;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  language: SupportedLanguage;
  setSpeedUnit: (unit: SpeedUnit) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setLanguage: (lang: SupportedLanguage) => void;
}

export const UnitPreferenceContext = createContext<UnitPreferenceContextValue>({
  unitSystem: 'imperial',
  setUnitSystem: () => {},
  speedUnit: 'mph',
  distanceUnit: 'yards',
  temperatureUnit: 'fahrenheit',
  language: 'en',
  setSpeedUnit: () => {},
  setDistanceUnit: () => {},
  setTemperatureUnit: () => {},
  setLanguage: () => {},
});
