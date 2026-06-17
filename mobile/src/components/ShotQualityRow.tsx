import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Shot } from '../types/shot';
import { getShotQualities, qualityColor, type Quality } from '../utils/shotQuality';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

type QKey = 'vLaunch' | 'hLaunch' | 'aoa' | 'clubPath' | 'spin';

const METRICS: { key: QKey; label: string; directional?: boolean }[] = [
  { key: 'vLaunch', label: 'Launch' },
  { key: 'hLaunch', label: 'Offline' },
  { key: 'aoa', label: 'AoA' },
  { key: 'clubPath', label: 'Path', directional: true },
  { key: 'spin', label: 'Spin' },
];

/**
 * Kiosk-parity quality chips for a shot: Low/Perfect/High (magnitude) and
 * Left/Perfect/Right (club path), color-coded green=perfect, red=off-ideal.
 * Renders nothing when no metric has a rating (e.g. no angle/spin data).
 */
export const ShotQualityRow = React.memo(function ShotQualityRow({ shot }: { shot: Shot }) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);
  const q = useMemo(() => getShotQualities(shot), [shot]);
  const labelSets = useMemo(() => ({
    magnitude: { low: t('qualityLow'), medium: t('qualityPerfect'), high: t('qualityHigh') } as Record<Quality, string>,
    directional: { low: t('qualityLeft'), medium: t('qualityPerfect'), high: t('qualityRight') } as Record<Quality, string>,
  }), [t]);

  const items = METRICS
    .map((m) => ({ ...m, quality: q[m.key] as Quality | null }))
    .filter((m): m is typeof m & { quality: Quality } => m.quality != null);

  if (items.length === 0) return null;

  return (
    <View style={s.row}>
      {items.map((m) => {
        const labels = m.directional ? labelSets.directional : labelSets.magnitude;
        const color = qualityColor(m.quality, C);
        return (
          <View key={m.key} style={s.chip}>
            <Text style={s.metricLabel}>{m.label}</Text>
            <View style={s.qualityRow}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <Text style={[s.qualityText, { color }]} numberOfLines={1}>{labels[m.quality]}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexGrow: 1,
    minWidth: 64,
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.s1,
    borderRadius: R.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  metricLabel: {
    color: C.muted,
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  qualityText: { fontSize: scale(13), fontWeight: '700' },
});
