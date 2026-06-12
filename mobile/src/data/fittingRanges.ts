export interface FittingRange {
  launch_angle?: [number, number];
  spin_rpm?: [number, number];
  smash_factor?: [number, number];
}

export const FITTING_RANGES: Record<string, FittingRange> = {
  driver:           { launch_angle: [10, 15], spin_rpm: [2000, 2800], smash_factor: [1.45, 1.50] },
  '3-wood':         { launch_angle: [8,  12], spin_rpm: [2900, 3600], smash_factor: [1.40, 1.46] },
  '5-wood':         { launch_angle: [9,  13], spin_rpm: [3200, 4100], smash_factor: [1.37, 1.43] },
  hybrid:           { launch_angle: [10, 14], spin_rpm: [4200, 5200], smash_factor: [1.33, 1.40] },
  '3-iron':         { launch_angle: [11, 15], spin_rpm: [4500, 5500], smash_factor: [1.33, 1.40] },
  '4-iron':         { launch_angle: [12, 16], spin_rpm: [5000, 6000], smash_factor: [1.33, 1.40] },
  '5-iron':         { launch_angle: [13, 17], spin_rpm: [5500, 6500], smash_factor: [1.33, 1.39] },
  '6-iron':         { launch_angle: [14, 18], spin_rpm: [6000, 7000], smash_factor: [1.33, 1.38] },
  '7-iron':         { launch_angle: [15, 19], spin_rpm: [6500, 7500], smash_factor: [1.32, 1.37] },
  '8-iron':         { launch_angle: [16, 20], spin_rpm: [7000, 8000], smash_factor: [1.31, 1.36] },
  '9-iron':         { launch_angle: [17, 22], spin_rpm: [8000, 9000], smash_factor: [1.28, 1.34] },
  'pitching-wedge': { launch_angle: [20, 26], spin_rpm: [9000, 10500], smash_factor: [1.25, 1.32] },
  'gap-wedge':      { launch_angle: [22, 28], spin_rpm: [10000, 11500], smash_factor: [1.22, 1.29] },
  'sand-wedge':     { launch_angle: [26, 32], spin_rpm: [11000, 12500], smash_factor: [1.18, 1.26] },
  'lob-wedge':      { launch_angle: [30, 38], spin_rpm: [12000, 14000], smash_factor: [1.15, 1.23] },
};

export type FitStatus = 'optimal' | 'close' | 'out' | 'no-data';

export function getFitStatus(value: number | null, range: [number, number] | undefined): FitStatus {
  if (value === null || value === undefined || !range) return 'no-data';
  const [lo, hi] = range;
  if (value >= lo && value <= hi) return 'optimal';
  const margin = (hi - lo) * 0.15;
  if (value >= lo - margin && value <= hi + margin) return 'close';
  return 'out';
}

export interface FittingResult {
  metric: string;
  value: number | null;
  range: [number, number] | undefined;
  status: FitStatus;
  unit: string;
}

export function getFittingResults(
  club: string,
  avg_launch: number | null,
  avg_spin: number | null,
  avg_smash: number | null,
): FittingResult[] {
  const r = FITTING_RANGES[club];
  if (!r) return [];
  return [
    { metric: 'Launch Angle', value: avg_launch, range: r.launch_angle, unit: '°', status: getFitStatus(avg_launch, r.launch_angle) },
    { metric: 'Spin Rate',    value: avg_spin,   range: r.spin_rpm,     unit: 'rpm', status: getFitStatus(avg_spin, r.spin_rpm) },
    { metric: 'Smash Factor', value: avg_smash,  range: r.smash_factor, unit: '',   status: getFitStatus(avg_smash, r.smash_factor) },
  ].filter((x) => x.range !== undefined);
}
