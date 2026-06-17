import {
  computeApexHeight,
  computeTotalDistance,
  computeFaceToPath,
  isMishit,
  computeTrajectoryPoints,
  enrichShot,
} from '../../src/utils/ballistics';
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

describe('computeApexHeight', () => {
  it('returns null when launch angle is null', () => {
    expect(computeApexHeight(150, null, 2700)).toBeNull();
  });

  it('returns a positive finite height for a normal launch', () => {
    const apex = computeApexHeight(150, 12, 2700);
    expect(apex).not.toBeNull();
    expect(Number.isFinite(apex as number)).toBe(true);
    expect(apex as number).toBeGreaterThan(0);
  });

  it('uses a default spin factor when spin is null', () => {
    expect(computeApexHeight(150, 12, null)).toBeGreaterThan(0);
  });

  it('higher spin yields a higher apex', () => {
    const low = computeApexHeight(150, 12, 2000) as number;
    const high = computeApexHeight(150, 12, 8000) as number;
    expect(high).toBeGreaterThan(low);
  });
});

describe('computeTotalDistance', () => {
  it('applies the driver roll factor', () => {
    expect(computeTotalDistance(200, 'driver')).toBeCloseTo(234, 5); // 200 * 1.17
  });

  it('falls back to 0.06 roll for unknown clubs', () => {
    expect(computeTotalDistance(200, 'mystery-club')).toBeCloseTo(212, 5); // 200 * 1.06
  });
});

describe('computeFaceToPath', () => {
  it('returns null when spin axis is null', () => {
    expect(computeFaceToPath(null)).toBeNull();
  });

  it('divides spin axis by the fallback factor', () => {
    expect(computeFaceToPath(8.2)).toBeCloseTo(10, 5); // 8.2 / 0.82
  });
});

describe('isMishit', () => {
  it('is false when smash factor is null', () => {
    expect(isMishit(null, 'driver')).toBe(false);
  });

  it('flags a smash below the club threshold', () => {
    expect(isMishit(1.35, 'driver')).toBe(true); // driver threshold 1.40
  });

  it('passes a smash at or above the threshold', () => {
    expect(isMishit(1.45, 'driver')).toBe(false);
  });

  it('uses the 1.20 default threshold for unknown clubs', () => {
    expect(isMishit(1.1, 'mystery-club')).toBe(true);
    expect(isMishit(1.25, 'mystery-club')).toBe(false);
  });
});

describe('computeTrajectoryPoints', () => {
  it('returns numPoints + 1 points', () => {
    expect(computeTrajectoryPoints(100, 30, 60)).toHaveLength(61);
  });

  it('starts at the origin and lands at carry distance with zero height', () => {
    const pts = computeTrajectoryPoints(100, 30, 60);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1].x).toBeCloseTo(100, 5);
    expect(pts[pts.length - 1].y).toBeCloseTo(0, 5);
  });

  it('peaks at apex height in the middle', () => {
    const pts = computeTrajectoryPoints(100, 30, 60);
    expect(pts[30].x).toBeCloseTo(50, 5);
    expect(pts[30].y).toBeCloseTo(30, 5); // 4 * 30 * 0.5 * 0.5
  });
});

describe('enrichShot', () => {
  it('prefers server-provided physics values over local recompute', () => {
    const enriched = enrichShot(
      makeShot({
        apex_height_yards: 99,
        total_distance_yards: 288,
        face_to_path_deg: 7,
        is_mishit: true,
      }),
    );
    expect(enriched.apex_height_yards).toBe(99);
    expect(enriched.total_distance_yards).toBe(288);
    expect(enriched.face_to_path_deg).toBe(7);
    expect(enriched.is_mishit).toBe(true);
  });

  it('preserves an explicit is_mishit=false from the server', () => {
    const enriched = enrichShot(makeShot({ is_mishit: false, smash_factor: 1.0 }));
    expect(enriched.is_mishit).toBe(false);
  });

  it('computes locally when the server omitted the fields', () => {
    const enriched = enrichShot(
      makeShot({
        apex_height_yards: undefined,
        total_distance_yards: undefined,
        face_to_path_deg: undefined,
        is_mishit: undefined,
        carry_spin_adjusted: 240,
        club: 'driver',
        spin_axis_deg: 8.2,
      }),
    );
    expect(enriched.total_distance_yards).toBeCloseTo(240 * 1.17, 5);
    expect(enriched.face_to_path_deg).toBeCloseTo(10, 5);
    expect(typeof enriched.apex_height_yards).toBe('number');
  });

  it('always derives shot_shape from the resolved face-to-path', () => {
    // Server face_to_path of +7 (open) with neutral start → fade/slice family.
    const enriched = enrichShot(
      makeShot({ face_to_path_deg: 7, launch_angle_horizontal: 0 }),
    );
    expect(enriched.shot_shape).toBe('slice');
  });
});
