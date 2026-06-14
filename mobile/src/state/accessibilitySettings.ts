import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  reduceMotion: 'a11y.reduce_motion',
  highContrast: 'a11y.high_contrast',
  largeText: 'a11y.large_text',
} as const;

export interface AccessibilityPrefs {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
}

const DEFAULTS: AccessibilityPrefs = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
};

let _cached: AccessibilityPrefs | undefined;

export async function getAccessibilityPrefs(): Promise<AccessibilityPrefs> {
  if (_cached) return _cached;
  const [rm, hc, lt] = await Promise.all([
    AsyncStorage.getItem(KEYS.reduceMotion),
    AsyncStorage.getItem(KEYS.highContrast),
    AsyncStorage.getItem(KEYS.largeText),
  ]);
  _cached = {
    reduceMotion: rm === 'true',
    highContrast: hc === 'true',
    largeText: lt === 'true',
  };
  return _cached;
}

export async function setAccessibilityPref(
  key: keyof AccessibilityPrefs,
  value: boolean
): Promise<void> {
  if (!_cached) await getAccessibilityPrefs();
  _cached = { ...(_cached ?? DEFAULTS), [key]: value };
  await AsyncStorage.setItem(KEYS[key], value ? 'true' : 'false');
}

export function clearAccessibilityCache(): void {
  _cached = undefined;
}
