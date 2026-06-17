import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getAccessibilityPrefs,
  setAccessibilityPref,
  DEFAULT_A11Y_PREFS,
  type AccessibilityPrefs,
  type AccessibilityPrefKey,
} from './accessibilitySettings';
import { AccessibilityContext } from './AccessibilityContext';

/** Font multiplier applied when "Larger Text" is enabled. */
const LARGE_TEXT_SCALE = 1.15;

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(DEFAULT_A11Y_PREFS);

  useEffect(() => {
    getAccessibilityPrefs().then(setPrefs).catch(() => {});
  }, []);

  const setPref = useCallback((key: AccessibilityPrefKey, value: boolean) => {
    // Optimistic update so the UI reacts immediately; persist in the background.
    setPrefs((p) => ({ ...p, [key]: value }));
    setAccessibilityPref(key, value).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      prefs,
      setPref,
      fontScale: prefs.largeText ? LARGE_TEXT_SCALE : 1,
    }),
    [prefs, setPref]
  );

  return (
    <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
  );
}
