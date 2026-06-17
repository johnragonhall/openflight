import {
  convertSpeedFromMph,
  convertDistanceFromYards,
  formatSpeed,
  formatDistance,
  getSpeedUnit,
  getDistanceUnit,
  formatCarryRange,
} from '../../src/utils/units';

describe('convertSpeedFromMph', () => {
  it('returns mph unchanged', () => {
    expect(convertSpeedFromMph(100, 'mph')).toBe(100);
  });

  it('converts mph → km/h', () => {
    expect(convertSpeedFromMph(100, 'kmh')).toBeCloseTo(160.934, 3);
  });

  it('converts mph → m/s', () => {
    expect(convertSpeedFromMph(100, 'mps')).toBeCloseTo(44.704, 3);
  });

  it('m/s and km/h differ (regression: both used to collapse to km/h)', () => {
    expect(convertSpeedFromMph(100, 'mps')).not.toBeCloseTo(
      convertSpeedFromMph(100, 'kmh'),
      1,
    );
  });

  it('handles zero', () => {
    expect(convertSpeedFromMph(0, 'kmh')).toBe(0);
    expect(convertSpeedFromMph(0, 'mps')).toBe(0);
  });
});

describe('convertDistanceFromYards', () => {
  it('returns yards unchanged', () => {
    expect(convertDistanceFromYards(100, 'yards')).toBe(100);
  });

  it('converts yards → meters', () => {
    expect(convertDistanceFromYards(100, 'meters')).toBeCloseTo(91.44, 2);
  });

  it('handles zero', () => {
    expect(convertDistanceFromYards(0, 'meters')).toBe(0);
  });
});

describe('formatSpeed', () => {
  it('defaults to 1 decimal', () => {
    expect(formatSpeed(100, 'mph')).toBe('100.0');
  });

  it('honours digits argument', () => {
    expect(formatSpeed(100, 'mph', 0)).toBe('100');
    expect(formatSpeed(100, 'kmh', 1)).toBe('160.9');
    expect(formatSpeed(100, 'mps', 1)).toBe('44.7');
  });
});

describe('formatDistance', () => {
  it('defaults to 0 decimals', () => {
    expect(formatDistance(100, 'yards')).toBe('100');
  });

  it('converts and rounds for meters', () => {
    expect(formatDistance(100, 'meters', 0)).toBe('91');
    expect(formatDistance(100, 'meters', 2)).toBe('91.44');
  });
});

describe('getSpeedUnit', () => {
  it('labels each speed unit', () => {
    expect(getSpeedUnit('mph')).toBe('mph');
    expect(getSpeedUnit('kmh')).toBe('km/h');
    expect(getSpeedUnit('mps')).toBe('m/s');
  });
});

describe('getDistanceUnit', () => {
  it('labels each distance unit', () => {
    expect(getDistanceUnit('yards')).toBe('yds');
    expect(getDistanceUnit('meters')).toBe('m');
  });
});

describe('formatCarryRange', () => {
  it('formats an imperial range with unit suffix', () => {
    expect(formatCarryRange([200, 220], 'yards')).toBe('200–220 yds');
  });

  it('converts a metric range', () => {
    expect(formatCarryRange([200, 220], 'meters')).toBe('183–201 m');
  });
});
