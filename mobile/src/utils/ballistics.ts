import type { Shot } from '../types/shot';
import { classifyShotShape } from './shotShape';

const ROLL_FACTORS: Record<string, number> = {
  driver: 0.17,
  '3-wood': 0.13,
  '5-wood': 0.11,
  hybrid: 0.09,
  '3-iron': 0.08, '4-iron': 0.08, '5-iron': 0.07,
  '6-iron': 0.06, '7-iron': 0.06, '8-iron': 0.05,
  '9-iron': 0.04, 'pitching-wedge': 0.03,
  'gap-wedge': 0.02, 'sand-wedge': 0.02, 'lob-wedge': 0.01,
};

const MISHIT_THRESHOLDS: Record<string, number> = {
  driver: 1.40, '3-wood': 1.35, '5-wood': 1.32,
  hybrid: 1.28, '3-iron': 1.28, '4-iron': 1.27,
  '5-iron': 1.27, '6-iron': 1.26, '7-iron': 1.25,
  '8-iron': 1.25, '9-iron': 1.23, 'pitching-wedge': 1.20,
  'gap-wedge': 1.17, 'sand-wedge': 1.15, 'lob-wedge': 1.12,
};

export function computeApexHeight(
  ball_speed_mph: number,
  launch_angle_deg: number | null,
  spin_rpm: number | null,
): number | null {
  if (launch_angle_deg === null) return null;
  const v0_fps = ball_speed_mph * 1.46667;
  const rad = launch_angle_deg * Math.PI / 180;
  const v0y = v0_fps * Math.sin(rad);
  const g = 32.174;
  const t_apex = v0y / g;
  const h_ft = v0y * t_apex - 0.5 * g * t_apex * t_apex;
  const spin_factor = spin_rpm !== null ? 1 + spin_rpm / 160000 : 1.02;
  return Math.max(0, (h_ft * spin_factor) / 3);
}

export function computeTotalDistance(carry_yards: number, club: string): number {
  const roll = ROLL_FACTORS[club] ?? 0.06;
  return carry_yards * (1 + roll);
}

export function computeFaceToPath(spin_axis_deg: number | null): number | null {
  if (spin_axis_deg === null) return null;
  return spin_axis_deg / 0.82;
}

export function isMishit(smash_factor: number | null, club: string): boolean {
  if (smash_factor === null) return false;
  const threshold = MISHIT_THRESHOLDS[club] ?? 1.20;
  return smash_factor < threshold;
}

export function enrichShot(shot: Shot): Shot {
  const carry = shot.carry_spin_adjusted ?? shot.estimated_carry_yards;
  const face_to_path_deg = computeFaceToPath(shot.spin_axis_deg);
  return {
    ...shot,
    apex_height_yards: computeApexHeight(shot.ball_speed_mph, shot.launch_angle_vertical, shot.spin_rpm),
    total_distance_yards: computeTotalDistance(carry, shot.club),
    face_to_path_deg,
    is_mishit: isMishit(shot.smash_factor, shot.club),
    shot_shape: classifyShotShape(face_to_path_deg, shot.launch_angle_horizontal),
  };
}

export function computeTrajectoryPoints(
  carry_yards: number,
  apex_yards: number,
  numPoints = 60,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = carry_yards * t;
    const y = 4 * apex_yards * t * (1 - t);
    points.push({ x, y });
  }
  return points;
}
