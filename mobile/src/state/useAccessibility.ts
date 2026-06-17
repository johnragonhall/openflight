import { useContext } from 'react';
import { AccessibilityContext } from './AccessibilityContext';

/** Reactive access to accessibility preferences and the derived font scale. */
export function useAccessibility() {
  return useContext(AccessibilityContext);
}
