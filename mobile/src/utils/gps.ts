import * as Location from 'expo-location';

export interface GpsCoords {
  latitude: number;
  longitude: number;
}

function haversineMeters(a: GpsCoords, b: GpsCoords): number {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
  const dLon = (b.longitude - a.longitude) * (Math.PI / 180);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat +
    Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * sinLon * sinLon;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function metersToYards(m: number): number {
  return m * 1.09361;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

// 5 decimal places ≈ 1.1 m accuracy — sufficient for club-selection distances
// (~1.2 yd error), while avoiding full sub-centimetre precision in storage.
// Exports (CSV/PDF) apply a coarser 4dp truncation before data leaves the device.
const COORD_PRECISION = 5;

export async function getCurrentCoords(): Promise<GpsCoords> {
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude:  parseFloat(loc.coords.latitude.toFixed(COORD_PRECISION)),
    longitude: parseFloat(loc.coords.longitude.toFixed(COORD_PRECISION)),
  };
}

// Use in exports only — 4dp ≈ 11 m identifies the course without revealing
// the exact hole or shot position in shared files.
export function truncateCoordsForExport(coords: GpsCoords): GpsCoords {
  return {
    latitude:  parseFloat(coords.latitude.toFixed(4)),
    longitude: parseFloat(coords.longitude.toFixed(4)),
  };
}

export function distanceYards(from: GpsCoords, to: GpsCoords): number {
  return metersToYards(haversineMeters(from, to));
}
