export interface Shot {
  id?: string;
  ball_speed_mph: number;
  club_speed_mph: number | null;
  smash_factor: number | null;
  estimated_carry_yards: number;
  carry_range: [number, number];
  club: string;
  timestamp: string;
  peak_magnitude: number | null;
  launch_angle_vertical: number | null;
  launch_angle_horizontal: number | null;
  launch_angle_confidence: number | null;
  angle_source: 'radar' | 'camera' | 'estimated' | null;
  club_angle_deg: number | null;
  club_path_deg: number | null;
  spin_axis_deg: number | null;
  spin_rpm: number | null;
  spin_confidence: number | null;
  spin_quality: 'high' | 'medium' | 'low' | null;
  carry_spin_adjusted: number | null;
  // Computed fields (enriched on arrival)
  apex_height_yards?: number | null;
  total_distance_yards?: number | null;
  face_to_path_deg?: number | null;
  is_mishit?: boolean;
}

export function computeStats(shots: Shot[]): SessionStats {
  if (shots.length === 0) {
    return {
      shot_count: 0, avg_ball_speed: 0, max_ball_speed: 0, min_ball_speed: 0,
      avg_club_speed: null, avg_smash_factor: null, avg_carry_est: 0,
      avg_launch_angle: null, avg_spin_rpm: null,
    };
  }
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const ballSpeeds = shots.map((s) => s.ball_speed_mph);
  const clubSpeeds = shots.map((s) => s.club_speed_mph).filter((v): v is number => v !== null);
  const smashFactors = shots.map((s) => s.smash_factor).filter((v): v is number => v !== null);
  const launchAngles = shots.map((s) => s.launch_angle_vertical).filter((v): v is number => v !== null);
  const spinRpms = shots.map((s) => s.spin_rpm).filter((v): v is number => v !== null);
  return {
    shot_count: shots.length,
    avg_ball_speed: mean(ballSpeeds),
    max_ball_speed: Math.max(...ballSpeeds),
    min_ball_speed: Math.min(...ballSpeeds),
    avg_club_speed: clubSpeeds.length > 0 ? mean(clubSpeeds) : null,
    avg_smash_factor: smashFactors.length > 0 ? mean(smashFactors) : null,
    avg_carry_est: mean(shots.map((s) => s.estimated_carry_yards)),
    avg_launch_angle: launchAngles.length > 0 ? mean(launchAngles) : null,
    avg_spin_rpm: spinRpms.length > 0 ? mean(spinRpms) : null,
  };
}

export function getUniqueClubs(shots: Shot[]): string[] {
  return Array.from(new Set(shots.map((s) => s.club)));
}

export interface SessionStats {
  shot_count: number;
  avg_ball_speed: number;
  max_ball_speed: number;
  min_ball_speed: number;
  avg_club_speed: number | null;
  avg_smash_factor: number | null;
  avg_carry_est: number;
  avg_launch_angle: number | null;
  avg_spin_rpm: number | null;
}
