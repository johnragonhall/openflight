export type UnitSystem = 'imperial' | 'metric';

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
