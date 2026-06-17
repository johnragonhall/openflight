import { isValidShot, computeStats, getUniqueClubs, type Shot } from '../../src/types/shot';

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    club: 'driver',
    ball_speed_mph: 150,
    club_speed_mph: 110,
    smash_factor: 1.4,
    estimated_carry_yards: 250,
    carry_range: [240, 260],
    peak_magnitude: null,
    launch_angle_vertical: 12,
    launch_angle_horizontal: 0,
    launch_angle_confidence: 0.9,
    angle_source: 'radar',
    club_angle_deg: 0,
    club_path_deg: 0,
    spin_axis_deg: 0,
    spin_rpm: 2700,
    spin_confidence: 0.9,
    spin_quality: 'high',
    carry_spin_adjusted: null,
    ...overrides,
  };
}

// Minimal raw payload that passes isValidShot.
function validRaw(): Record<string, unknown> {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    club: 'driver',
    ball_speed_mph: 150,
    estimated_carry_yards: 250,
  };
}

describe('isValidShot', () => {
  it('accepts a minimal valid payload', () => {
    expect(isValidShot(validRaw())).toBe(true);
  });

  it.each([null, undefined, 42, 'shot', true, []])(
    'rejects non-object value %p',
    (val) => {
      expect(isValidShot(val)).toBe(false);
    },
  );

  it('rejects a missing or non-string timestamp', () => {
    expect(isValidShot({ ...validRaw(), timestamp: undefined })).toBe(false);
    expect(isValidShot({ ...validRaw(), timestamp: 12345 })).toBe(false);
  });

  it('rejects an unparseable timestamp', () => {
    expect(isValidShot({ ...validRaw(), timestamp: 'not-a-date' })).toBe(false);
  });

  it('rejects an over-long timestamp (>= 100 chars)', () => {
    expect(isValidShot({ ...validRaw(), timestamp: '1'.repeat(100) })).toBe(false);
  });

  it('rejects a missing or non-string club', () => {
    expect(isValidShot({ ...validRaw(), club: undefined })).toBe(false);
    expect(isValidShot({ ...validRaw(), club: 7 })).toBe(false);
  });

  it('rejects an over-long club name (>= 50 chars)', () => {
    expect(isValidShot({ ...validRaw(), club: 'c'.repeat(50) })).toBe(false);
  });

  it('rejects non-finite ball speed', () => {
    expect(isValidShot({ ...validRaw(), ball_speed_mph: NaN })).toBe(false);
    expect(isValidShot({ ...validRaw(), ball_speed_mph: Infinity })).toBe(false);
  });

  it('rejects out-of-range ball speed', () => {
    expect(isValidShot({ ...validRaw(), ball_speed_mph: -1 })).toBe(false);
    expect(isValidShot({ ...validRaw(), ball_speed_mph: 500 })).toBe(false);
  });

  it('rejects non-finite carry', () => {
    expect(isValidShot({ ...validRaw(), estimated_carry_yards: NaN })).toBe(false);
    expect(isValidShot({ ...validRaw(), estimated_carry_yards: 'far' })).toBe(false);
  });

  it('accepts ball speed at the lower bound (0)', () => {
    expect(isValidShot({ ...validRaw(), ball_speed_mph: 0 })).toBe(true);
  });
});

describe('computeStats', () => {
  it('returns a zeroed/null result for an empty array', () => {
    const s = computeStats([]);
    expect(s.shot_count).toBe(0);
    expect(s.avg_ball_speed).toBe(0);
    expect(s.std_dev_carry).toBeNull();
    expect(s.std_dev_ball_speed).toBeNull();
    expect(s.avg_club_speed).toBeNull();
  });

  it('returns null std-dev for a single shot', () => {
    const s = computeStats([makeShot({ ball_speed_mph: 150 })]);
    expect(s.shot_count).toBe(1);
    expect(s.avg_ball_speed).toBe(150);
    expect(s.std_dev_ball_speed).toBeNull();
  });

  it('computes avg/min/max across multiple shots', () => {
    const s = computeStats([
      makeShot({ ball_speed_mph: 140 }),
      makeShot({ ball_speed_mph: 160 }),
    ]);
    expect(s.avg_ball_speed).toBe(150);
    expect(s.min_ball_speed).toBe(140);
    expect(s.max_ball_speed).toBe(160);
    expect(s.std_dev_ball_speed).not.toBeNull();
  });

  it('ignores null optional metrics when averaging', () => {
    const s = computeStats([
      makeShot({ club_speed_mph: null, smash_factor: null, spin_rpm: null }),
      makeShot({ club_speed_mph: 100, smash_factor: 1.4, spin_rpm: 3000 }),
    ]);
    expect(s.avg_club_speed).toBe(100); // only the non-null value counts
    expect(s.avg_smash_factor).toBe(1.4);
    expect(s.avg_spin_rpm).toBe(3000);
  });

  it('prefers spin-adjusted carry when present', () => {
    const s = computeStats([
      makeShot({ carry_spin_adjusted: 200, estimated_carry_yards: 999 }),
    ]);
    expect(s.avg_carry_est).toBe(200);
  });
});

describe('getUniqueClubs', () => {
  it('returns distinct clubs preserving first-seen order', () => {
    const clubs = getUniqueClubs([
      makeShot({ club: 'driver' }),
      makeShot({ club: '7-iron' }),
      makeShot({ club: 'driver' }),
    ]);
    expect(clubs).toEqual(['driver', '7-iron']);
  });

  it('returns empty for no shots', () => {
    expect(getUniqueClubs([])).toEqual([]);
  });
});
