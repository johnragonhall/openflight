export type UnitSystem = 'imperial' | 'metric';

// ── Granular unit types (mobile) ─────────────────────────────────────────────

export type SpeedUnit = 'mph' | 'kmh' | 'mps';
export type DistanceUnit = 'yards' | 'meters';
export type TemperatureUnit = 'fahrenheit' | 'celsius';

export type SupportedLanguage =
  | 'en' | 'es' | 'fr' | 'pt' | 'de' | 'ja' | 'it'
  | 'zh-Hans' | 'ru' | 'ar' | 'hi' | 'ko';

export type UnitCombo = { speed: SpeedUnit; distance: DistanceUnit; label: string };

export const UNIT_COMBOS: UnitCombo[] = [
  { speed: 'mph', distance: 'yards',  label: 'mph, yds' },
  { speed: 'mph', distance: 'meters', label: 'mph, m' },
  { speed: 'kmh', distance: 'meters', label: 'km/h, m' },
  { speed: 'kmh', distance: 'yards',  label: 'km/h, yds' },
  { speed: 'mps', distance: 'meters', label: 'm/s, m' },
  { speed: 'mps', distance: 'yards',  label: 'm/s, yds' },
];

export const LANGUAGES: Array<{ code: SupportedLanguage; label: string; native: string }> = [
  { code: 'en',      label: 'English',    native: 'English' },
  { code: 'es',      label: 'Spanish',    native: 'Español' },
  { code: 'fr',      label: 'French',     native: 'Français' },
  { code: 'pt',      label: 'Portuguese', native: 'Português' },
  { code: 'de',      label: 'German',     native: 'Deutsch' },
  { code: 'ja',      label: 'Japanese',   native: '日本語' },
  { code: 'it',      label: 'Italian',    native: 'Italiano' },
  { code: 'zh-Hans', label: 'Mandarin',   native: '中文' },
  { code: 'ru',      label: 'Russian',    native: 'Русский' },
  { code: 'ar',      label: 'Arabic',     native: 'العربية' },
  { code: 'hi',      label: 'Hindi',      native: 'हिन्दी' },
  { code: 'ko',      label: 'Korean',     native: '한국어' },
];

export function deriveUnitSystem(speed: SpeedUnit, distance: DistanceUnit): UnitSystem {
  return speed === 'mph' && distance === 'yards' ? 'imperial' : 'metric';
}

// ─────────────────────────────────────────────────────────────────────────────

const MPH_TO_KMH = 1.60934;
const YARDS_TO_METERS = 0.9144;

export function convertSpeedFromMph(speedMph: number, unitSystem: UnitSystem): number {
  return unitSystem === 'metric' ? speedMph * MPH_TO_KMH : speedMph;
}

export function convertDistanceFromYards(distanceYards: number, unitSystem: UnitSystem): number {
  return unitSystem === 'metric' ? distanceYards * YARDS_TO_METERS : distanceYards;
}

export function formatSpeed(speedMph: number, unitSystem: UnitSystem, digits = 1): string {
  return convertSpeedFromMph(speedMph, unitSystem).toFixed(digits);
}

export function formatDistance(distanceYards: number, unitSystem: UnitSystem, digits = 0): string {
  return convertDistanceFromYards(distanceYards, unitSystem).toFixed(digits);
}

export function getSpeedUnit(unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? 'km/h' : 'mph';
}

export function getDistanceUnit(unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? 'm' : 'yds';
}

export function formatCarryRange(carryRange: [number, number], unitSystem: UnitSystem): string {
  const min = formatDistance(carryRange[0], unitSystem, 0);
  const max = formatDistance(carryRange[1], unitSystem, 0);
  return `${min}–${max} ${getDistanceUnit(unitSystem)}`;
}
