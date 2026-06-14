import { classifyShotShape, sortByBagOrder } from '../../src/utils/shotShape';

describe('classifyShotShape', () => {
  it('returns null when both inputs are null', () => {
    expect(classifyShotShape(null, null)).toBeNull();
  });

  it('returns null when both inputs are undefined', () => {
    expect(classifyShotShape(undefined, undefined)).toBeNull();
  });

  it('classifies slice: ftp > 4', () => {
    expect(classifyShotShape(5, 0)).toBe('slice');
  });

  it('classifies fade: ftp 2-4', () => {
    expect(classifyShotShape(3, 0)).toBe('fade');
  });

  it('classifies straight: ftp within -2 to +2', () => {
    expect(classifyShotShape(0, 0)).toBe('straight');
    expect(classifyShotShape(1.9, 1)).toBe('straight');
  });

  it('classifies draw: ftp -4 to -2', () => {
    expect(classifyShotShape(-3, 0)).toBe('draw');
  });

  it('classifies hook: ftp < -4', () => {
    expect(classifyShotShape(-5, 0)).toBe('hook');
  });

  it('classifies push when lateral > 3 and straight curve', () => {
    expect(classifyShotShape(0, 4)).toBe('push');
  });

  it('classifies pull when lateral < -3 and straight curve', () => {
    expect(classifyShotShape(0, -4)).toBe('pull');
  });

  it('classifies push-slice compound', () => {
    expect(classifyShotShape(6, 4)).toBe('push-slice');
  });

  it('classifies pull-hook compound', () => {
    expect(classifyShotShape(-6, -4)).toBe('pull-hook');
  });

  it('uses only ftp when lateral is null', () => {
    expect(classifyShotShape(3, null)).toBe('fade');
  });

  it('uses only lateral when ftp is null', () => {
    expect(classifyShotShape(null, 5)).toBe('push');
    expect(classifyShotShape(null, -5)).toBe('pull');
  });

  it('lateral without ftp: null ftp treats as straight', () => {
    expect(classifyShotShape(null, 0)).toBe('straight');
  });

  // pull-draw and push-fade collapse by design
  it('pull + draw collapses to draw', () => {
    expect(classifyShotShape(-3, -4)).toBe('draw');
  });

  it('push + fade collapses to fade', () => {
    expect(classifyShotShape(3, 4)).toBe('fade');
  });
});

describe('classifyShotShape boundary values', () => {
  // ftp thresholds use strict > / <, so exact values fall into the less-extreme bucket

  it('ftp=4 is fade (not slice, threshold is > 4)', () => {
    expect(classifyShotShape(4, 0)).toBe('fade');
  });

  it('ftp=2 is straight (not fade, threshold is > 2)', () => {
    expect(classifyShotShape(2, 0)).toBe('straight');
  });

  it('ftp=-2 is straight (not draw, threshold is < -2)', () => {
    expect(classifyShotShape(-2, 0)).toBe('straight');
  });

  it('ftp=-4 is draw (not hook, threshold is < -4)', () => {
    expect(classifyShotShape(-4, 0)).toBe('draw');
  });

  it('lateral=3 is not push (threshold is > 3)', () => {
    expect(classifyShotShape(0, 3)).toBe('straight');
  });

  it('lateral=-3 is not pull (threshold is < -3)', () => {
    expect(classifyShotShape(0, -3)).toBe('straight');
  });

  it('ftp just above 4 is slice', () => {
    expect(classifyShotShape(4.01, 0)).toBe('slice');
  });

  it('ftp just above 2 is fade', () => {
    expect(classifyShotShape(2.01, 0)).toBe('fade');
  });

  it('ftp just below -4 is hook', () => {
    expect(classifyShotShape(-4.01, 0)).toBe('hook');
  });

  it('ftp just below -2 is draw', () => {
    expect(classifyShotShape(-2.01, 0)).toBe('draw');
  });

  it('lateral just above 3 is push', () => {
    expect(classifyShotShape(0, 3.01)).toBe('push');
  });

  it('lateral just below -3 is pull', () => {
    expect(classifyShotShape(0, -3.01)).toBe('pull');
  });
});

describe('classifyShotShape — new extreme shapes', () => {
  it('classifies duck-hook: ftp < -8', () => {
    expect(classifyShotShape(-9, 0)).toBe('duck-hook');
    expect(classifyShotShape(-10, 0)).toBe('duck-hook');
  });

  it('classifies banana-slice: ftp > 8', () => {
    expect(classifyShotShape(9, 0)).toBe('banana-slice');
    expect(classifyShotShape(12, 0)).toBe('banana-slice');
  });

  it('classifies block: lateral > 7 with straight curve', () => {
    expect(classifyShotShape(0, 8)).toBe('block');
    expect(classifyShotShape(1, 8)).toBe('block');  // ftp=1 is in straight zone
  });

  it('push (lateral 4-7) still returns push, not block', () => {
    expect(classifyShotShape(0, 4)).toBe('push');
    expect(classifyShotShape(0, 7)).toBe('push');   // boundary: 7 is not > 7
  });

  it('duck-hook threshold: ftp=-8 is hook (not < -8)', () => {
    expect(classifyShotShape(-8, 0)).toBe('hook');
    expect(classifyShotShape(-7.99, 0)).toBe('hook');
  });

  it('banana-slice threshold: ftp=8 is slice (not > 8)', () => {
    expect(classifyShotShape(8, 0)).toBe('slice');
    expect(classifyShotShape(7.99, 0)).toBe('slice');
  });

  it('duck-hook with pull lateral still returns duck-hook', () => {
    // Very extreme hook from a pull start — compound of duck-hook (no special compound name)
    expect(classifyShotShape(-9, -4)).toBe('duck-hook');
  });

  it('banana-slice with push start still returns banana-slice', () => {
    expect(classifyShotShape(9, 4)).toBe('banana-slice');
  });
});

describe('sortByBagOrder', () => {
  it('sorts driver before irons before wedges', () => {
    const result = sortByBagOrder(['sand-wedge', '7-iron', 'driver']);
    expect(result).toEqual(['driver', '7-iron', 'sand-wedge']);
  });

  it('places unknown clubs at end, alphabetically', () => {
    const result = sortByBagOrder(['zzz-custom', 'driver', 'aaa-custom']);
    expect(result[0]).toBe('driver');
    expect(result.slice(1)).toEqual(['aaa-custom', 'zzz-custom']);
  });

  it('returns empty array for empty input', () => {
    expect(sortByBagOrder([])).toEqual([]);
  });

  it('preserves canonical bag order: driver → woods → hybrids → irons → wedges', () => {
    const clubs = ['lob-wedge', 'pitching-wedge', '9-iron', '5-iron', '3-hybrid', '5-wood', 'driver'];
    const result = sortByBagOrder(clubs);
    expect(result).toEqual(['driver', '5-wood', '3-hybrid', '5-iron', '9-iron', 'pitching-wedge', 'lob-wedge']);
  });

  it('does not mutate the input array', () => {
    const clubs = ['sand-wedge', 'driver'];
    const original = [...clubs];
    sortByBagOrder(clubs);
    expect(clubs).toEqual(original);
  });
});
