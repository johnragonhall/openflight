import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAccessibility } from '../state/useAccessibility';

/**
 * Returns true when reduce motion is active - either via the OS setting
 * (iOS/Android) or the in-app accessibility preference. The in-app value is
 * sourced from AccessibilityContext so it updates live when toggled.
 */
export function useReduceMotion(): boolean {
  const [osReduceMotion, setOsReduceMotion] = useState(false);
  const { prefs } = useAccessibility();

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOsReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOsReduceMotion);
    return () => sub.remove();
  }, []);

  return osReduceMotion || prefs.reduceMotion;
}
