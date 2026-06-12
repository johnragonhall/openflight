import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  dim?: boolean;
  subtext?: string;
  confidence?: 'high' | 'medium' | 'low' | null;
}

function ConfidenceDots({ level }: { level: 'high' | 'medium' | 'low' }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <View style={styles.confidenceRow}>
      {([0, 1, 2] as const).map((i) => (
        <View key={i} style={[styles.dot, i < filled ? styles.dotFilled : styles.dotEmpty]} />
      ))}
      <Text style={styles.confidenceLabel}>{level}</Text>
    </View>
  );
}

export function MetricCard({ label, value, unit, dim = false, subtext, confidence }: MetricCardProps) {
  const displayValue = value === null || value === undefined ? '—' : String(value);

  return (
    <View style={[styles.card, dim && styles.dim]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{displayValue}</Text>
        {unit && value !== null && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {subtext != null && <Text style={styles.subtext}>{subtext}</Text>}
      {confidence != null && <ConfidenceDots level={confidence} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    margin: 4,
    minWidth: 90,
  },
  dim: { opacity: 0.45 },
  label: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums' as const],
  },
  unit: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },
  subtext: { color: '#6b7280', fontSize: 10, marginTop: 3 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotFilled: { backgroundColor: '#22c55e' },
  dotEmpty: { backgroundColor: '#374151' },
  confidenceLabel: { color: '#6b7280', fontSize: 9, marginLeft: 2, textTransform: 'uppercase' },
});
