import {
  inRange,
  hLaunchQuality,
  getRanges,
  getShotQualities,
  DEFAULT_RANGES,
} from '../../src/utils/shotQuality';
import type { Shot } from '../../src/types/shot';

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    club: 'driver',
    ball_speed_mph: 150,
    club_speed_mph: 110,
    smash_factor: 1.45,
    estimated_carry_yards: 250,
    carry_range: [240, 260],
    peak_magnitude: null,
    launch_angle_vertical: null,
    launch_angle_horizontal: null,
    launch_angle_confidence: null,
    angle_source: null,
    club_angle_deg: null,
    club_path_deg: null,
    spin_axis_deg: null,
    spin_rpm: null,
    spin_confidence: null,
    spin_quality: null,
    carry_spin_adjusted: null,
    ...overrides,
  };
}

describe('inRange', () => {
  it('classifies low / perfect / high against a band', () => {
    const r = { min: 12, max: 15 };
    expect(inRange(10, r)).toBe('low');
    expect(inRange(13.5, r)).toBe('medium');
    expect(inRange(20, r)).toBe('high');
    expect(inRange(12, r)).toBe('medium'); // boundary inclusive
    expect(inRange(15, r)).toBe('medium');
  });
});

describe('hLaunchQuality', () => {
  it('uses absolute value and returns null when missing', () => {
    const r = { min: 0, max: 2 };
    expect(hLaunchQuality(null, r)).toBeNull();
    expect(hLaunchQuality(undefined, r)).toBeNull();
    expect(hLaunchQuality(-1.5, r)).toBe('medium');
    expect(hLaunchQuality(-5, r)).toBe('high');
    expect(hLaunchQuality(5, r)).toBe('high');
  });
});

describe('getRanges', () => {
  it('returns the per-club band for a known club', () => {
    expect(getRanges('driver').vLaunch).toEqual({ min: 12, max: 15 });
    expect(getRanges('7-iron').spin).toEqual({ min: 6000, max: 8000 });
  });

  it('falls back to DEFAULT_RANGES for an unknown club', () => {
    expect(getRanges('mystery')).toBe(DEFAULT_RANGES);
  });
});

describe('getShotQualities', () => {
  it('rates a driver shot across all metrics', () => {
    const q = getShotQualities(makeShot({
      club: 'driver',
      launch_angle_vertical: 13.5, // 12-15 -> medium
      launch_angle_horizontal: 0.5, // |0.5| in 0-1 -> medium
      club_angle_deg: 3,            // 2-5 -> medium
      club_path_deg: 0,             // -3..3 -> medium
      spin_rpm: 2300,               // 2000-2600 -> medium
    }));
    expect(q).toEqual({ vLaunch: 'medium', hLaunch: 'medium', aoa: 'medium', clubPath: 'medium', spin: 'medium' });
  });

  it('flags low/high and directional left/right', () => {
    const q = getShotQualities(makeShot({
      club: 'driver',
      launch_angle_vertical: 8,   // < 12 -> low
      club_path_deg: -5,          // < -3 -> low (Left)
      spin_rpm: 4000,             // > 2600 -> high
    }));
    expect(q.vLaunch).toBe('low');
    expect(q.clubPath).toBe('low');
    expect(q.spin).toBe('high');

    const right = getShotQualities(makeShot({ club: 'driver', club_path_deg: 5 }));
    expect(right.clubPath).toBe('high'); // Right
  });

  it('returns null for metrics with no data', () => {
    const q = getShotQualities(makeShot({ club: 'driver' }));
    expect(q).toEqual({ vLaunch: null, hLaunch: null, aoa: null, clubPath: null, spin: null });
  });
});
