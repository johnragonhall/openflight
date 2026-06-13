import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { AnimatedNumber } from './AnimatedNumber';
import { C, R } from '../theme';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  dim?: boolean;
  subtext?: string;
  confidence?: 'high' | 'medium' | 'low' | null;
  size?: 'primary' | 'default';
  flex?: number;
  /** Raw numeric value — when provided, the display animates to this number */
  animateRawValue?: number | null;
  /** Formatter applied to the animating raw value */
  animateFormatter?: (v: number) => string;
}

const DOT_INDICES = [0, 1, 2] as const;
const FILLED_DOTS: Record<'high' | 'medium' | 'low', number> = { high: 3, medium: 2, low: 1 };

const ConfidenceDots = React.memo(function ConfidenceDots({
  level,
}: {
  level: 'high' | 'medium' | 'low';
}) {
  const filled = FILLED_DOTS[level];
  return (
    <View style={styles.dotsRow}>
      {DOT_INDICES.map((i) => (
        <View key={i} style={[styles.dot, i < filled ? styles.dotOn : styles.dotOff]} />
      ))}
      <Text style={styles.dotLabel}>{level}</Text>
    </View>
  );
});

export const MetricCard = React.memo(function MetricCard({
  label,
  value,
  unit,
  dim = false,
  subtext,
  confidence,
  size = 'default',
  flex,
  animateRawValue,
  animateFormatter,
}: MetricCardProps) {
  const isEmpty = value === null || value === undefined;
  const display = isEmpty ? '—' : String(value);
  const isPrimary = size === 'primary';

  // Flash highlight on primary card when value updates
  const flashAnim = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!isPrimary || isEmpty) return;
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animateRawValue]);

  const borderColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.line, C.accentMuted],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        isPrimary ? styles.cardPrimary : styles.cardDefault,
        dim && styles.cardDim,
        flex !== undefined && { flex },
        isPrimary && { borderColor },
      ]}
    >
      <Text style={[styles.label, isPrimary && styles.labelPrimary]}>{label}</Text>

      <View style={styles.valueRow}>
        {/* Animated value for primary cards when raw number is provided */}
        {isPrimary && animateRawValue != null && !isEmpty ? (
          <AnimatedNumber
            value={animateRawValue}
            formatter={animateFormatter}
            style={[styles.value, styles.valuePrimary]}
            numberOfLines={1}
          />
        ) : (
          <Text
            style={[
              styles.value,
              isPrimary ? styles.valuePrimary : styles.valueDefault,
              isEmpty && styles.valueEmpty,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={isPrimary}
          >
            {display}
          </Text>
        )}

        {unit != null && !isEmpty && (
          <Text style={[styles.unit, isPrimary && styles.unitPrimary]}>{unit}</Text>
        )}
      </View>

      {subtext != null && !isEmpty && (
        <Text style={styles.subtext} numberOfLines={1}>{subtext}</Text>
      )}
      {confidence != null && !isEmpty && <ConfidenceDots level={confidence} />}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.s2,
    borderRadius: R.md,
    margin: 4,
    minWidth: 80,
  },
  cardDefault: {
    flex: 1,
    padding: 12,
  },
  cardPrimary: {
    flex: 1,
    padding: 16,
    paddingBottom: 14,
    backgroundColor: C.s1,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardDim: { opacity: 0.28 },

  label: {
    color: C.sub,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  labelPrimary: {
    color: C.sub,
    fontSize: 11,
  },

  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },

  value: {
    fontVariant: ['tabular-nums' as const],
    fontWeight: '700',
  },
  valueDefault: {
    color: C.text,
    fontSize: 26,
  },
  valuePrimary: {
    color: C.text,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
  },
  valueEmpty: { color: C.muted },

  unit: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '500',
  },
  unitPrimary: {
    color: C.sub,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },

  subtext: { color: C.sub, fontSize: 10, marginTop: 4 },

  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotOn: { backgroundColor: C.accent },
  dotOff: { backgroundColor: C.muted },
  dotLabel: {
    color: C.sub,
    fontSize: 9,
    marginLeft: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
