import { useCallback } from 'react';
import { useAccessibility } from './useAccessibility';

/** No rendered font may be smaller than this, even at the base (1.0) scale. */
export const MIN_FONT_SIZE = 11;

/**
 * Returns a `scale(size)` helper and the raw multiplier driven by the
 * "Larger Text" accessibility preference. Use to scale fixed `fontSize`
 * values defined in StyleSheets:
 *
 *   const { scale } = useFontScale();
 *   <Text style={[s.title, { fontSize: scale(20) }]}>…</Text>
 *
 * The result is floored at {@link MIN_FONT_SIZE} so no text ever renders
 * below the legibility minimum, regardless of the source size or scale.
 */
export function useFontScale() {
  const { fontScale } = useAccessibility();
  const scale = useCallback(
    (size: number) => Math.max(MIN_FONT_SIZE, Math.round(size * fontScale)),
    [fontScale]
  );
  return { scale, fontScale };
}
