import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, StyleSheet, Text, View } from 'react-native';
import type { ClubLifetimeStat } from '../types/shot';
import { getLifetimeStatsByClub } from '../db/database';
import { sortByBagOrder } from '../utils/shotShape';
import { ShapeBar } from './ShapeBar';
import { ClubDetailSheet, formatClubName } from './ClubDetailSheet';
import { PressableScale } from './PressableScale';
import { C, R } from '../theme';

/**
 * All-time bag overview. Fetches lifetime stats from SQLite and renders
 * a sorted FlatList. Tapping a row opens ClubDetailSheet.
 */
export function BagOverview() {
  const [stats, setStats] = useState<ClubLifetimeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClubLifetimeStat | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLifetimeStatsByClub()
      .then((rows) => {
        if (cancelled) return;
        const sorted = sortByBagOrder(rows.map((r) => r.club))
          .map((club) => rows.find((r) => r.club === club)!)
          .filter(Boolean);
        setStats(sorted);
      })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleClose = useCallback(() => setSelected(null), []);

  if (loading) return <BagSkeleton />;
  if (error) return <BagError message={error} />;
  if (stats.length === 0) return <BagEmpty />;

  return (
    <>
      <FlatList
        data={stats}
        keyExtractor={(item) => item.club}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <ClubRow stat={item} index={index} onPress={() => setSelected(item)} />
        )}
        scrollEnabled={false}
      />
      <ClubDetailSheet
        stat={selected}
        shapeDrawPct={0}
        shapeStraightPct={1}
        shapeFadePct={0}
        onClose={handleClose}
      />
    </>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps { stat: ClubLifetimeStat; index: number; onPress: () => void }

function ClubRow({ stat, index, onPress }: RowProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      delay: index * 35,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  const carry = Math.round(stat.avg_carry);
  const total = stat.avg_total != null ? Math.round(stat.avg_total) : null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <PressableScale onPress={onPress}>
        <View style={styles.row}>
          {/* Left: club pill + shot count */}
          <View style={styles.rowLeft}>
            <View style={styles.clubPill}>
              <Text style={styles.clubPillText}>{formatClubName(stat.club)}</Text>
            </View>
            <Text style={styles.shotCount}>{stat.shot_count} shots</Text>
          </View>

          {/* Center: carry stats */}
          <View style={styles.rowCenter}>
            <Text style={styles.carryValue}>{carry}</Text>
            <Text style={styles.carryUnit}>yds carry</Text>
            {total != null && (
              <Text style={styles.totalValue}>{total} total</Text>
            )}
          </View>

          {/* Right: shape bar + range */}
          <View style={styles.rowRight}>
            <ShapeBar shapes={[]} height={6} />
            <Text style={styles.rangeText}>
              {Math.round(stat.min_carry)}–{Math.round(stat.max_carry)} yds
            </Text>
          </View>

          <Text style={styles.chevron}>›</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function BagSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.row, styles.skeleton]} />
      ))}
    </View>
  );
}

function BagEmpty() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>No shots recorded yet</Text>
      <Text style={styles.emptySub}>Hit balls during a session to build your bag overview</Text>
    </View>
  );
}

function BagError({ message }: { message: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={[styles.emptyTitle, { color: C.err }]}>Failed to load bag data</Text>
      <Text style={styles.emptySub}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  skeleton: { height: 68, opacity: 0.4 },
  rowLeft: { width: 72, gap: 4 },
  clubPill: {
    backgroundColor: C.accentDim,
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  clubPillText: { color: C.accent, fontSize: 11, fontWeight: '700' },
  shotCount: { color: C.muted, fontSize: 10 },
  rowCenter: { flex: 1, gap: 2 },
  carryValue: { color: C.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  carryUnit: { color: C.muted, fontSize: 10 },
  totalValue: { color: C.sub, fontSize: 11 },
  rowRight: { width: 80, gap: 4 },
  rangeText: { color: C.muted, fontSize: 9 },
  chevron: { color: C.muted, fontSize: 18 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
