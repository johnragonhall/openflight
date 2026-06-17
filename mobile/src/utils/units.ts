// ── Granular unit types (mobile) ─────────────────────────────────────────────

export type SpeedUnit = 'mph' | 'kmh' | 'mps';
export type DistanceUnit = 'yards' | 'meters';
export type TemperatureUnit = 'fahrenheit' | 'celsius';

// Matches the kiosk's supported set exactly (ui/src/i18n/translations.ts LangCode)
// and mobile/src/i18n/translations.ts, so the same translation catalog is shared.
export type SupportedLanguage =
  | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it'
  | 'nl' | 'sv' | 'ja' | 'ko' | 'zh-hans' | 'zh-hant'
  | 'th' | 'no' | 'da' | 'fi';

export type UnitCombo = { speed: SpeedUnit; distance: DistanceUnit; label: string };

export const UNIT_COMBOS: UnitCombo[] = [
  { speed: 'mph', distance: 'yards',  label: 'mph, yds' },
  { speed: 'mph', distance: 'meters', label: 'mph, m' },
  { speed: 'kmh', distance: 'meters', label: 'km/h, m' },
  { speed: 'kmh', distance: 'yards',  label: 'km/h, yds' },
  { speed: 'mps', distance: 'meters', label: 'm/s, m' },
  { speed: 'mps', distance: 'yards',  label: 'm/s, yds' },
];

export const LANGUAGES: { code: SupportedLanguage; label: string; native: string }[] = [
  { code: 'en',      label: 'English',               native: 'English' },
  { code: 'es',      label: 'Spanish',               native: 'Español' },
  { code: 'fr',      label: 'French',                native: 'Français' },
  { code: 'de',      label: 'German',                native: 'Deutsch' },
  { code: 'pt',      label: 'Portuguese',            native: 'Português' },
  { code: 'it',      label: 'Italian',               native: 'Italiano' },
  { code: 'nl',      label: 'Dutch',                 native: 'Nederlands' },
  { code: 'sv',      label: 'Swedish',               native: 'Svenska' },
  { code: 'ja',      label: 'Japanese',              native: '日本語' },
  { code: 'ko',      label: 'Korean',                native: '한국어' },
  { code: 'zh-hans', label: 'Chinese (Simplified)',  native: '简体中文' },
  { code: 'zh-hant', label: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'th',      label: 'Thai',                  native: 'ไทย' },
  { code: 'no',      label: 'Norwegian',             native: 'Norsk' },
  { code: 'da',      label: 'Danish',                native: 'Dansk' },
  { code: 'fi',      label: 'Finnish',               native: 'Suomi' },
];

// ── Conversions (from canonical mph / yards) ─────────────────────────────────

const MPH_TO_KMH = 1.60934;
const MPH_TO_MPS = 0.44704;
const YARDS_TO_METERS = 0.9144;

export function convertSpeedFromMph(speedMph: number, unit: SpeedUnit): number {
  switch (unit) {
    case 'kmh': return speedMph * MPH_TO_KMH;
    case 'mps': return speedMph * MPH_TO_MPS;
    default:    return speedMph; // mph
  }
}

export function convertDistanceFromYards(distanceYards: number, unit: DistanceUnit): number {
  return unit === 'meters' ? distanceYards * YARDS_TO_METERS : distanceYards;
}

export function formatSpeed(speedMph: number, unit: SpeedUnit, digits = 1): string {
  return convertSpeedFromMph(speedMph, unit).toFixed(digits);
}

export function formatDistance(distanceYards: number, unit: DistanceUnit, digits = 0): string {
  return convertDistanceFromYards(distanceYards, unit).toFixed(digits);
}

export function getSpeedUnit(unit: SpeedUnit): string {
  switch (unit) {
    case 'kmh': return 'km/h';
    case 'mps': return 'm/s';
    default:    return 'mph';
  }
}

export function getDistanceUnit(unit: DistanceUnit): string {
  return unit === 'meters' ? 'm' : 'yds';
}

export function formatCarryRange(carryRange: [number, number], unit: DistanceUnit): string {
  const min = formatDistance(carryRange[0], unit, 0);
  const max = formatDistance(carryRange[1], unit, 0);
  return `${min}–${max} ${getDistanceUnit(unit)}`;
}
