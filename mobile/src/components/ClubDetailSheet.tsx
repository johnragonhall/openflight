import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import type { ClubLifetimeStat, ClubSessionPoint } from '../types/shot';
import { getClubSessionTrend } from '../db/database';
import { ShapeBar } from './ShapeBar';
import { TrendLineChart } from './TrendLineChart';
import { C, R, Anim } from '../theme';

interface Props {
  stat: ClubLifetimeStat | null;
  /** Pre-computed shape distribution for this club's shots */
  shapeDrawPct: number;
  shapeStraightPct: number;
  shapeFadePct: number;
  onClose: () => void;
}

export function ClubDetailSheet({ stat, shapeDrawPct, shapeStraightPct, shapeFadePct, onClose }: Props) {
  const { width } = useWindowDimensions();
  const [trend, setTrend] = useState<ClubSessionPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Slide up on open
  useEffect(() => {
    if (!stat) return;
    let cancelled = false;
    setLoading(true);
    setTrend([]);
    getClubSessionTrend(stat.club)
      .then((data) => { if (!cancelled) setTrend(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    Animated.spring(slideAnim, {
      toValue: 1,
      speed: Anim.spring.speed,
      bounciness: Anim.spring.bounciness,
      useNativeDriver: true,
    }).start();
    return () => { cancelled = true; };
  }, [stat, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  if (!stat) return null;

  const carry = stat.avg_carry;
  const total = stat.avg_total;
  const consistencyPct = stat.std_dev_carry != null && carry > 0
    ? Math.max(0, Math.round(100 - (stat.std_dev_carry / carry) * 100))
    : null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      {/* Scrim */}
      <Pressable style={styles.scrim} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.clubName}>{formatClubName(stat.club)}</Text>
            <Text style={styles.shotCount}>{stat.shot_count} shots</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Key metrics row */}
          <View style={styles.metricsRow}>
            <MetricTile label="AVG CARRY" value={`${Math.round(carry)} yds`} large />
            {total != null && <MetricTile label="AVG TOTAL" value={`${Math.round(total)} yds`} large />}
            {consistencyPct != null && (
              <MetricTile label="CONSISTENCY" value={`${consistencyPct}%`} large accent />
            )}
          </View>

          {/* Carry range */}
          <View style={styles.metricsRow}>
            <MetricTile label="MIN CARRY" value={`${Math.round(stat.min_carry)}`} />
            <MetricTile label="MAX CARRY" value={`${Math.round(stat.max_carry)}`} />
            {stat.std_dev_carry != null && (
              <MetricTile label="SD CARRY" value={`±${Math.round(stat.std_dev_carry)} yds`} />
            )}
          </View>

          {/* Shape bar */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SHOT SHAPE</Text>
            <ShapeBar shapes={buildShapeArray(shapeDrawPct, shapeStraightPct, shapeFadePct, stat.shot_count)} height={12} />
            <View style={styles.shapeLegend}>
              <LegendDot color={C.ok} label={`Draw/Hook ${pct(shapeDrawPct)}`} />
              <LegendDot color={C.accent} label={`Straight ${pct(shapeStraightPct)}`} />
              <LegendDot color={C.warn} label={`Fade/Slice ${pct(shapeFadePct)}`} />
            </View>
          </View>

          {/* Trend chart */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AVG CARRY TREND</Text>
            {loading ? (
              <View style={[styles.chartPlaceholder, { width: width - 48 }]}>
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            ) : (
              <TrendLineChart data={trend} width={width - 48} height={120} />
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function MetricTile({ label, value, large, accent }: {
  label: string; value: string; large?: boolean; accent?: boolean;
}) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, large && styles.metricValueLarge, accent && { color: C.accent }]}>
        {value}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function buildShapeArray(drawPct: number, strPct: number, fadePct: number, total: number): ('draw' | 'straight' | 'fade')[] {
  const n = Math.min(total, 30);
  const draws   = Math.round(drawPct * n);
  const strs    = Math.round(strPct * n);
  const fades   = Math.round(fadePct * n);
  return [
    ...Array(draws).fill('draw' as const),
    ...Array(strs).fill('straight' as const),
    ...Array(fades).fill('fade' as const),
  ];
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function formatClubName(club: string): string {
  const map: Record<string, string> = {
    driver: 'Driver',
    '3-wood': '3 Wood', '5-wood': '5 Wood', '7-wood': '7 Wood',
    hybrid: 'Hybrid',
    '2-iron': '2i', '3-iron': '3i', '4-iron': '4i',
    '5-iron': '5i', '6-iron': '6i', '7-iron': '7i',
    '8-iron': '8i', '9-iron': '9i',
    'pitching-wedge': 'PW', 'gap-wedge': 'GW',
    'sand-wedge': 'SW', 'lob-wedge': 'LW',
  };
  return map[club] ?? club.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.s1,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.s3,
    borderRadius: R.pill,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  clubName: { color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  shotCount: { color: C.sub, fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: C.muted, fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 40 },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricTile: {
    flex: 1,
    backgroundColor: C.s2,
    borderRadius: R.md,
    padding: 12,
  },
  metricLabel: { color: C.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 },
  metricValue: { color: C.sub, fontSize: 15, fontWeight: '700' },
  metricValueLarge: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  section: { gap: 10 },
  sectionLabel: { color: C.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  shapeLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: R.pill },
  legendLabel: { color: C.sub, fontSize: 11 },
  chartPlaceholder: { height: 120, backgroundColor: C.s2, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.muted, fontSize: 12 },
});
