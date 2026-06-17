import { simulateTrajectory, launchFromShot, type LaunchConditions } from '../../src/utils/trajectory';
import type { Shot } from '../../src/types/shot';

const driver: LaunchConditions = {
  ballSpeedMph: 165, launchAngleV: 12, launchAngleH: 0, spinRpm: 2700, spinAxisDeg: 0,
};

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    club: 'driver',
    ball_speed_mph: 165,
    club_speed_mph: 113,
    smash_factor: 1.46,
    estimated_carry_yards: 270,
    carry_range: [260, 280],
    peak_magnitude: null,
    launch_angle_vertical: 12,
    launch_angle_horizontal: 0,
    launch_angle_confidence: 0.9,
    angle_source: 'radar',
    club_angle_deg: 3,
    club_path_deg: 0,
    spin_axis_deg: 0,
    spin_rpm: 2700,
    spin_confidence: 0.9,
    spin_quality: 'high',
    carry_spin_adjusted: null,
    ...overrides,
  };
}

describe('simulateTrajectory', () => {
  it('produces a physically plausible driver flight', () => {
    const t = simulateTrajectory(driver);
    expect(t.carryYards).toBeGreaterThan(200);
    expect(t.carryYards).toBeLessThan(340);
    expect(t.apexYards).toBeGreaterThan(15);
    expect(t.apexYards).toBeLessThan(70);
    expect(t.flightTimeS).toBeGreaterThan(4);
    expect(t.flightTimeS).toBeLessThan(9);
    expect(Math.abs(t.lateralYards)).toBeLessThan(5); // axis 0 -> ~straight
    expect(t.points.length).toBeGreaterThan(10);
    expect(t.points[0]).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('starts at the tee and lands near ground level', () => {
    const t = simulateTrajectory(driver);
    const last = t.points[t.points.length - 1];
    expect(last.z).toBeLessThan(1); // returns to ground
    expect(last.x).toBeCloseTo(t.carryYards, 0);
  });

  it('curves right for a positive (fade) spin axis and left for negative', () => {
    const fade = simulateTrajectory({ ...driver, spinAxisDeg: 12 });
    const draw = simulateTrajectory({ ...driver, spinAxisDeg: -12 });
    expect(fade.lateralYards).toBeGreaterThan(3);
    expect(draw.lateralYards).toBeLessThan(-3);
  });

  it('higher launch angle yields a higher apex', () => {
    const low = simulateTrajectory({ ...driver, launchAngleV: 8 });
    const high = simulateTrajectory({ ...driver, launchAngleV: 18 });
    expect(high.apexYards).toBeGreaterThan(low.apexYards);
  });
});

describe('launchFromShot', () => {
  it('returns null without a vertical launch angle', () => {
    expect(launchFromShot(makeShot({ launch_angle_vertical: null }))).toBeNull();
  });

  it('uses measured spin when present', () => {
    expect(launchFromShot(makeShot({ spin_rpm: 3100 }))?.spinRpm).toBe(3100);
  });

  it('falls back to club-typical spin when spin is missing', () => {
    expect(launchFromShot(makeShot({ club: 'driver', spin_rpm: null }))?.spinRpm).toBe(2700);
    expect(launchFromShot(makeShot({ club: '7-iron', spin_rpm: null }))?.spinRpm).toBe(6500);
  });

  it('defaults missing horizontal angle and spin axis to zero', () => {
    const l = launchFromShot(makeShot({ launch_angle_horizontal: null, spin_axis_deg: null }));
    expect(l?.launchAngleH).toBe(0);
    expect(l?.spinAxisDeg).toBe(0);
  });
});
