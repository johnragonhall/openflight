export const C = {
  // Backgrounds — layered depth (matches kiosk: slightly blue-dark)
  bg: '#0a0a0f',
  s0: '#0e0e14',
  s1: '#12121a',
  s2: '#1a1a24',
  s3: '#222230',

  // Borders
  line: '#1c1820',
  lineMid: '#28241e',

  // Accent — premium gold (matches kiosk --color-gold)
  accent: '#d4af37',
  accentDim: '#2a2010',
  accentSurface: '#1a1408',
  accentBright: '#f4cf47',
  accentMuted: '#6b5520',

  // Text — cream family (matches kiosk --color-cream)
  text: '#f5f0e6',
  sub: '#b5afa4',
  muted: '#857d75',

  // Semantic
  warn: '#f59e0b',
  warnDim: '#451a03',
  err: '#ef4444',
  errDim: '#450a0a',
  errText: '#fca5a5',

  // Connected/success stays green (semantic meaning, not brand)
  ok: '#4ade80',
  okSurface: '#0a2318',
  okMuted: '#166534',

  // Mock/demo mode badge (purple — distinct from brand palette)
  mockSurface: '#3b0764',
  mockText: '#e879f9',

  // Tracer canvas backgrounds (intentionally blue-tinted for sky feel)
  canvas2d: '#050b1a',
  canvas3d: '#060d25',
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
  gold:       'rgba(212, 175, 55, 0.18)',
  goldMid:    'rgba(212, 175, 55, 0.10)',
  goldFaint:  'rgba(212, 175, 55, 0.05)',
  goldBright: 'rgba(244, 207, 71, 0.30)',
  amber:      'rgba(245, 158, 11, 0.20)',
} as const;

export const Anim = {
  fast:   160,
  normal: 300,
  slow:   480,
  draw:   900,
  spring: { speed: 18, bounciness: 3 },
  springSnappy: { speed: 24, bounciness: 2 },
} as const;

// Glass material tokens
// iOS: BlurView substrate + gold-tinted overlay = instrument glass behind dark panel
// Android: solid elevated surface (no blur available at same fidelity)
export const Glass = {
  blurIntensity: 85,
  overlayGold:   'rgba(212, 175, 55, 0.05)',
  edgeGold:      'rgba(212, 175, 55, 0.22)',
  border:        'rgba(212, 175, 55, 0.18)',
  androidBg:     '#15151e',
} as const;
