import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getAccessibilityPrefs } from '../state/accessibilitySettings';

/**
 * Returns true when reduce motion is active — either via the OS setting
 * (iOS/Android) or the in-app accessibility preference.
 */
export function useReduceMotion(): boolean {
  const [osReduceMotion, setOsReduceMotion] = useState(false);
  const [appReduceMotion, setAppReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOsReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOsReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getAccessibilityPrefs()
      .then((p) => setAppReduceMotion(p.reduceMotion))
      .catch(() => {});
  }, []);

  return osReduceMotion || appReduceMotion;
}
