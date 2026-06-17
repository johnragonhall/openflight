import { createContext } from 'react';
import {
  DEFAULT_A11Y_PREFS,
  type AccessibilityPrefs,
  type AccessibilityPrefKey,
} from './accessibilitySettings';

export interface AccessibilityContextValue {
  prefs: AccessibilityPrefs;
  setPref: (key: AccessibilityPrefKey, value: boolean) => void;
  /** Typography multiplier applied app-wide. 1.0 normally, larger when `largeText` is on. */
  fontScale: number;
}

export const AccessibilityContext = createContext<AccessibilityContextValue>({
  prefs: DEFAULT_A11Y_PREFS,
  setPref: () => {},
  fontScale: 1,
});
