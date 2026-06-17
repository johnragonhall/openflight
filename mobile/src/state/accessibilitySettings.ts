import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  reduceMotion: 'a11y.reduce_motion',
  highContrast: 'a11y.high_contrast',
  largeText: 'a11y.large_text',
  colorBlind: 'a11y.color_blind',
} as const;

export interface AccessibilityPrefs {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  /** Blue/orange palette - safe for red-green color blindness (deuteranopia). */
  colorBlind: boolean;
}

export type AccessibilityPrefKey = keyof AccessibilityPrefs;

export const DEFAULT_A11Y_PREFS: AccessibilityPrefs = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  colorBlind: false,
};

let _cached: AccessibilityPrefs | undefined;

export async function getAccessibilityPrefs(): Promise<AccessibilityPrefs> {
  if (_cached) return _cached;
  try {
    const [rm, hc, lt, cb] = await Promise.all([
      AsyncStorage.getItem(KEYS.reduceMotion),
      AsyncStorage.getItem(KEYS.highContrast),
      AsyncStorage.getItem(KEYS.largeText),
      AsyncStorage.getItem(KEYS.colorBlind),
    ]);
    _cached = {
      reduceMotion: rm === 'true',
      highContrast: hc === 'true',
      largeText: lt === 'true',
      colorBlind: cb === 'true',
    };
  } catch {
    _cached = { ...DEFAULT_A11Y_PREFS };
  }
  return _cached;
}

export async function setAccessibilityPref(
  key: AccessibilityPrefKey,
  value: boolean
): Promise<void> {
  if (!_cached) await getAccessibilityPrefs();
  _cached = { ...(_cached ?? DEFAULT_A11Y_PREFS), [key]: value };
  await AsyncStorage.setItem(KEYS[key], value ? 'true' : 'false');
}

export function clearAccessibilityCache(): void {
  _cached = undefined;
}
