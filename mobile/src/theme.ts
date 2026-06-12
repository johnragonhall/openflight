export const C = {
  // Backgrounds — layered depth
  bg: '#080808',
  s0: '#0e0e0e',
  s1: '#141414',
  s2: '#1c1c1e',
  s3: '#232325',

  // Borders
  line: '#1e1e1e',
  lineMid: '#282828',

  // Accent — electric green (brand)
  accent: '#22c55e',
  accentDim: '#052e16',
  accentSurface: '#0a2318',
  accentBright: '#4ade80',
  accentMuted: '#166534',

  // Text
  text: '#f0f0f0',
  sub: '#8a8a96',
  muted: '#3e3e46',

  // Semantic
  warn: '#f59e0b',
  warnDim: '#451a03',
  err: '#ef4444',
  errDim: '#450a0a',
  errText: '#fca5a5',
} as const;

export const R = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;
