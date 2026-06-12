import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getFittingResults, type FitStatus } from '../data/fittingRanges';
import type { SessionStats } from '../types/shot';

const STATUS_COLOR: Record<FitStatus, string> = {
  optimal: '#22c55e',
  close: '#f59e0b',
  out: '#ef4444',
  'no-data': '#374151',
};

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

export function FittingRecommendations({ club, stats }: Props) {
  const results = getFittingResults(
    club,
    stats.avg_launch_angle,
    stats.avg_spin_rpm,
    stats.avg_smash_factor,
  );

  if (results.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Club Fitting · {club.toUpperCase()}</Text>
      {results.map((r) => {
        const color = STATUS_COLOR[r.status];
        const rangeStr = r.range
          ? `${r.range[0]}–${r.range[1]}${r.unit}`
          : '—';
        const valueStr = r.value !== null
          ? `${r.unit === 'rpm' ? Math.round(r.value).toLocaleString() : r.value.toFixed(2)}${r.unit}`
          : '—';
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
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111', borderRadius: 12, padding: 14, marginTop: 12,
  },
  title: {
    color: '#9ca3af', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRight: { alignItems: 'flex-end' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metric: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  range: { color: '#6b7280', fontSize: 11, marginTop: 1 },
  value: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums' as const] },
  status: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 1 },
});
