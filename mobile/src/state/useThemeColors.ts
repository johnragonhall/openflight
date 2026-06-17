import { useMemo } from 'react';
import { C } from '../theme';
import { useAccessibility } from './useAccessibility';

export type Palette = typeof C;
type PaletteOverride = { [K in keyof Palette]?: string };

// High-contrast overrides: brighter text, stronger borders, pure-black backdrop.
const HIGH_CONTRAST: PaletteOverride = {
  bg: '#000000',
  s0: '#000000',
  s1: '#0c0c12',
  text: '#ffffff',
  sub: '#e8e3d8',
  muted: '#c9c2b6',
  line: '#3a3530',
  lineMid: '#4a443a',
  accentBright: '#ffd866',
};

// Color-blind (deuteranopia-safe): replace red/green semantics with orange/blue,
// which remain distinguishable without red-green discrimination.
const COLOR_BLIND: PaletteOverride = {
  ok: '#3b9eff',
  okSurface: '#0a1c2e',
  okMuted: '#1e4e7a',
  err: '#ff8c1a',
  errDim: '#3a1e02',
  errText: '#ffc080',
  warn: '#ffd633',
};

/**
 * Returns the active color palette, adjusted for high-contrast and color-blind
 * accessibility preferences. Drop-in replacement for importing `C` directly.
 */
export function useThemeColors(): Palette {
  const { prefs } = useAccessibility();
  return useMemo(() => {
    if (!prefs.highContrast && !prefs.colorBlind) return C;
    return {
      ...C,
      ...(prefs.highContrast ? HIGH_CONTRAST : {}),
      ...(prefs.colorBlind ? COLOR_BLIND : {}),
    } as Palette;
  }, [prefs.highContrast, prefs.colorBlind]);
}
