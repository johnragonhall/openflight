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

export const Glow = {
  green:       'rgba(34, 197, 94, 0.18)',
  greenMid:    'rgba(34, 197, 94, 0.10)',
  greenFaint:  'rgba(34, 197, 94, 0.05)',
  greenBright: 'rgba(74, 222, 128, 0.30)',
  amber:       'rgba(245, 158, 11, 0.20)',
} as const;

export const Anim = {
  fast:   160,
  normal: 300,
  slow:   480,
  draw:   900,
  spring: { speed: 18, bounciness: 3 },
  springSnappy: { speed: 24, bounciness: 2 },
} as const;
