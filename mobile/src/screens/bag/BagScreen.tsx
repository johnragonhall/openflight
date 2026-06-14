import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator, Animated, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { getBagClubsWithStats, getSpareClubs } from '../../db/bagDatabase';
import type { ClubWithStats } from '../../types/bag';
import { getClubDisplayName, getTypeLabel } from '../../types/bag';
import { ClubIcon } from '../../components/ClubIcon';
import { PressableScale } from '../../components/PressableScale';
import { C, R } from '../../theme';

export function BagScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [clubs, setClubs] = useState<ClubWithStats[]>([]);
  const [spareCount, setSpareCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [withStats, spares] = await Promise.all([
        getBagClubsWithStats(),
        getSpareClubs(),
      ]);
      setClubs(withStats);
      setSpareCount(spares.length);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('BagAddClub')}
          style={s.addBtn}
          accessibilityLabel="Add club"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={24} color={C.accent} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (clubs.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <EmptyState onAdd={() => navigation.navigate('BagAddClub')} />
      </SafeAreaView>
    );
  }

  const totalShots = clubs.reduce((sum, c) => sum + c.shot_count, 0);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <SummaryTile label="Clubs" value={String(clubs.length)} />
          <View style={s.summaryDivider} />
          <SummaryTile label="Total Shots" value={String(totalShots)} />
          {spareCount > 0 && (
            <>
              <View style={s.summaryDivider} />
              <SummaryTile label="Spare" value={String(spareCount)} muted />
            </>
          )}
        </View>

        {/* Club list */}
        <View style={s.listSection}>
          <Text style={s.sectionLabel}>IN BAG</Text>
          <View style={s.clubList}>
            {clubs.map((club, index) => (
              <ClubRow
                key={club.id}
                club={club}
                index={index}
                isLast={index === clubs.length - 1}
                onPress={() => navigation.navigate('BagClubDetail', { clubId: club.id })}
              />
            ))}
          </View>
        </View>

        {/* Spare clubs nav */}
        {spareCount > 0 && (
          <View style={s.spareSection}>
            <PressableScale
              style={s.spareRow}
              onPress={() => navigation.navigate('BagSpareClubs')}
              scale={0.985}
              accessibilityLabel={`Spare clubs, ${spareCount} clubs`}
            >
              <View style={s.spareLeft}>
                <Ionicons name="archive-outline" size={18} color={C.muted} style={s.spareIcon} />
                <Text style={s.spareLabel}>Spare Clubs</Text>
              </View>
              <View style={s.spareRight}>
                <Text style={s.spareCount}>{spareCount}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </View>
            </PressableScale>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Club row with timeline ─────────────────────────────────────────────────────

function ClubRow({
  club, index, isLast, onPress,
}: {
  club: ClubWithStats;
  index: number;
  isLast: boolean;
  onPress: () => void;
}) {
  const carry = club.avg_carry != null ? Math.round(club.avg_carry) : null;
  const display = getClubDisplayName(club);
  const abbrev = getTypeLabel(club.category, club.type_key);

  return (
    <View style={s.rowWrap}>
      {/* Timeline spine */}
      <View style={s.timelineCol}>
        <View style={s.dot} />
        {!isLast && <View style={s.spine} />}
      </View>

      {/* Club icon */}
      <View style={s.iconWrap}>
        <ClubIcon category={club.category} size={22} color={C.accent} />
      </View>

      {/* Content */}
      <PressableScale
        style={s.rowContent}
        onPress={onPress}
        scale={0.985}
        accessibilityLabel={`${abbrev} ${display}${carry != null ? `, ${carry} yards average` : ''}${club.shot_count > 0 ? `, ${club.shot_count} shots` : ''}`}
      >
        <View style={s.rowInner}>
          <View style={s.rowLeft}>
            <Text style={s.abbrevBadge}>{abbrev}</Text>
            <View style={s.rowLabels}>
              <Text style={s.clubName} numberOfLines={1}>{display}</Text>
              {club.brand ? (
                <Text style={s.clubBrand} numberOfLines={1}>{club.brand}</Text>
              ) : null}
              {club.shot_count > 0 && (
                <Text style={s.shotCount}>{club.shot_count} shots</Text>
              )}
            </View>
          </View>
          <View style={s.rowRight}>
            {carry != null ? (
              <>
                <Text style={s.carryValue}>{carry}</Text>
                <Text style={s.carryUnit}>yds</Text>
              </>
            ) : (
              <Text style={s.noData}>—</Text>
            )}
            <Ionicons name="chevron-forward" size={14} color={C.muted} style={s.chevron} />
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

// ── Summary tile ──────────────────────────────────────────────────────────────

function SummaryTile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={s.summaryTile}>
      <Text style={[s.summaryValue, muted && s.summaryValueMuted]}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <ClubIcon category="driver" size={52} color={C.accentMuted} />
      </View>
      <Text style={s.emptyTitle}>Your bag is empty</Text>
      <Text style={s.emptySub}>
        Add your clubs to track carry distance and consistency for each stick.
      </Text>
      <TouchableOpacity
        style={s.emptyBtn}
        onPress={onAdd}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Add your first club to the bag"
      >
        <Ionicons name="add" size={18} color={C.bg} />
        <Text style={s.emptyBtnText}>Add First Club</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 72;
const DOT_SIZE = 10;
const TIMELINE_LEFT = 16;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 24 },

  addBtn: { paddingRight: 4 },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  summaryTile: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryValueMuted: { color: C.sub },
  summaryLabel: { color: C.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
    marginVertical: 4,
  },

  // Section
  listSection: { gap: 10 },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    marginLeft: TIMELINE_LEFT + DOT_SIZE + 8,
  },
  clubList: { gap: 0 },

  // Row
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: ROW_HEIGHT,
  },
  timelineCol: {
    width: TIMELINE_LEFT + DOT_SIZE,
    alignItems: 'center',
    paddingTop: (ROW_HEIGHT - DOT_SIZE) / 2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: C.accentDim,
  },
  spine: {
    width: 1,
    flex: 1,
    backgroundColor: C.line,
    marginTop: 4,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    paddingTop: (ROW_HEIGHT - 33) / 2,
    marginRight: 8,
  },
  rowContent: {
    flex: 1,
    minHeight: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  rowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 4,
    gap: 8,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  abbrevBadge: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: C.accentDim,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.xs,
    overflow: 'hidden',
    minWidth: 30,
    textAlign: 'center',
  },
  rowLabels: { flex: 1, gap: 1 },
  clubName: { color: C.text, fontSize: 15, fontWeight: '600' },
  clubBrand: { color: C.sub, fontSize: 12 },
  shotCount: { color: C.muted, fontSize: 11 },
  rowRight: { alignItems: 'flex-end', gap: 1 },
  carryValue: { color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  carryUnit: { color: C.muted, fontSize: 10 },
  noData: { color: C.muted, fontSize: 18 },
  chevron: { marginTop: 2 },

  // Spare section
  spareSection: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },
  spareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 52,
  },
  spareLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spareIcon: { opacity: 0.7 },
  spareLabel: { color: C.text, fontSize: 16, fontWeight: '500' },
  spareRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spareCount: {
    color: C.muted,
    fontSize: 14,
    backgroundColor: C.s2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: R.pill,
    overflow: 'hidden',
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.s1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptySub: {
    color: C.sub,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: R.lg,
    marginTop: 8,
  },
  emptyBtnText: { color: C.bg, fontSize: 15, fontWeight: '700' },
});
