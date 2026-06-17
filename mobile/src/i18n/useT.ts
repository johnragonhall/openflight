import { useCallback } from 'react';
import { useUnitPreference } from '../state/useUnitPreference';
import { t as lookup, interpolate, type LangCode, type TKey } from './translations';

export type { TKey } from './translations';

export type TFunction = (key: TKey, vars?: Record<string, string | number>) => string;

/**
 * Returns a translation function `t(key, vars?)` bound to the user's selected
 * language. The mobile language set (`SupportedLanguage`) is identical to the
 * kiosk translation catalog's `LangCode`, so the stored code is used directly;
 * `t()` falls back to English for any key a language hasn't translated.
 */
export function useT(): TFunction {
  const { language } = useUnitPreference();
  return useCallback<TFunction>(
    (key, vars) => {
      const value = lookup(language as LangCode, key);
      return vars ? interpolate(value, vars) : value;
    },
    [language],
  );
}
