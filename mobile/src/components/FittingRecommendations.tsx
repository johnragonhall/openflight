import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getFittingResults, type FitStatus } from '../data/fittingRanges';
import type { SessionStats } from '../types/shot';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';

function statusColor(status: FitStatus, C: Palette): string {
  const map: Record<FitStatus, string> = {
    optimal: C.accent,
    close: C.warn,
    out: C.err,
    'no-data': C.muted,
  };
  return map[status];
}

const STATUS_LABEL: Record<FitStatus, string> = {
  optimal: 'Optimal',
  close: 'Close',
  out: 'Off',
  'no-data': 'No data',
};

interface Props {
  club: string;
  stats: SessionStats;
}

export const FittingRecommendations = React.memo(function FittingRecommendations({ club, stats }: Props) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const results = useMemo(
    () => getFittingResults(club, stats.avg_launch_angle, stats.avg_spin_rpm, stats.avg_smash_factor),
    [club, stats.avg_launch_angle, stats.avg_spin_rpm, stats.avg_smash_factor],
  );

  if (results.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Club Fitting · {club.toUpperCase()}</Text>
      {results.map((r) => {
        const color = statusColor(r.status, C);
        const rangeStr = r.range
          ? `${r.range[0]}–${r.range[1]}${r.unit}`
          : '-';
        const valueStr = r.value !== null
          ? `${r.unit === 'rpm' ? Math.round(r.value).toLocaleString() : r.value.toFixed(2)}${r.unit}`
          : '-';
        return (
          <View key={r.metric} style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View>
                <Text style={styles.metric}>{r.metric}</Text>
                <Text style={styles.range}>Optimal: {rangeStr}</Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.value, { color }]}>{valueStr}</Text>
              <Text style={[styles.status, { color }]}>{STATUS_LABEL[r.status]}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginTop: 12,
  },
  title: {
    color: C.sub,
    fontSize: scale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRight: { alignItems: 'flex-end' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metric: { color: C.text, fontSize: scale(13), fontWeight: '600' },
  range: { color: C.sub, fontSize: scale(11), marginTop: 1 },
  value: { fontSize: scale(16), fontWeight: '700', fontVariant: ['tabular-nums' as const] },
  status: { fontSize: scale(10), fontWeight: '600', textTransform: 'uppercase', marginTop: 1 },
});
