import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { getBagClubs, getBagClubsWithStats, getSpareClubs } from '../../db/bagDatabase';
import type { ClubWithStats } from '../../types/bag';
import { logger } from '../../utils/logger';
import { getClubDisplayName, getTypeLabel } from '../../types/bag';
import { ClubIcon } from '../../components/ClubIcon';
import { PressableScale } from '../../components/PressableScale';
import { R } from '../../theme';
import { useThemeColors, type Palette } from '../../state/useThemeColors';
import { useFontScale } from '../../state/useFontScale';
import { useT } from '../../i18n/useT';

type Styles = ReturnType<typeof makeStyles>;

export function BagScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);
  const [clubs, setClubs] = useState<ClubWithStats[]>([]);
  const [spareCount, setSpareCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Load the club list resiliently: a failure in the lifetime-stats join must
    // never blank the bag. Fall back to the raw club list (no stats) so a newly
    // added club always shows.
    try {
      const withStats = await getBagClubsWithStats();
      setClubs(withStats);
    } catch (err) {
      logger.error('Bag stats load failed; showing clubs without stats:', err);
      try {
        const bag = await getBagClubs();
        setClubs(bag.map((c) => ({
          ...c, avg_carry: null, avg_total: null, shot_count: 0, last_shot_at: null,
        })));
      } catch (err2) {
        logger.error('Bag club list load failed:', err2);
      }
    }
    try {
      const spares = await getSpareClubs();
      setSpareCount(spares.length);
    } catch (err) {
      logger.error('Spare clubs load failed:', err);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('BagAddClub')}
          style={s.addBtn}
          accessibilityLabel={t('a11yAddClub')}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={24} color={C.accent} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, s, C, t]);

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
        <EmptyState onAdd={() => navigation.navigate('BagAddClub')} s={s} C={C} />
      </SafeAreaView>
    );
  }

  const totalShots = clubs.reduce((sum, c) => sum + c.shot_count, 0);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <SummaryTile label="Clubs" value={String(clubs.length)} s={s} />
          <View style={s.summaryDivider} />
          <SummaryTile label="Total Shots" value={String(totalShots)} s={s} />
          {spareCount > 0 && (
            <>
              <View style={s.summaryDivider} />
              <SummaryTile label="Spare" value={String(spareCount)} muted s={s} />
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
                s={s}
                C={C}
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
              accessibilityLabel={`${t('spareClubsTitle')}, ${spareCount}`}
            >
              <View style={s.spareLeft}>
                <Ionicons name="archive-outline" size={18} color={C.muted} style={s.spareIcon} />
                <Text style={s.spareLabel}>{t('spareClubsTitle')}</Text>
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
  club, index, isLast, onPress, s, C,
}: {
  club: ClubWithStats;
  index: number;
  isLast: boolean;
  onPress: () => void;
  s: Styles;
  C: Palette;
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
              <Text style={s.noData}>-</Text>
            )}
            <Ionicons name="chevron-forward" size={14} color={C.muted} style={s.chevron} />
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

// ── Summary tile ──────────────────────────────────────────────────────────────

function SummaryTile({ label, value, muted, s }: { label: string; value: string; muted?: boolean; s: Styles }) {
  return (
    <View style={s.summaryTile}>
      <Text style={[s.summaryValue, muted && s.summaryValueMuted]}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd, s, C }: { onAdd: () => void; s: Styles; C: Palette }) {
  const t = useT();
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <ClubIcon category="driver" size={52} color={C.accentMuted} />
      </View>
      <Text style={s.emptyTitle}>{t('bagEmptyTitle')}</Text>
      <Text style={s.emptySub}>
        {t('bagEmptySub')}
      </Text>
      <TouchableOpacity
        style={s.emptyBtn}
        onPress={onAdd}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('a11yAddFirstClub')}
      >
        <Ionicons name="add" size={18} color={C.bg} />
        <Text style={s.emptyBtnText}>{t('bagAddFirst')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 72;
const DOT_SIZE = 10;
const TIMELINE_LEFT = 16;

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
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
  summaryValue: { color: C.text, fontSize: scale(22), fontWeight: '800', letterSpacing: -0.5 },
  summaryValueMuted: { color: C.sub },
  summaryLabel: { color: C.muted, fontSize: scale(10), fontWeight: '600', letterSpacing: 0.6 },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
    marginVertical: 4,
  },

  // Section
  listSection: { gap: 10 },
  sectionLabel: {
    color: C.muted,
    fontSize: scale(11),
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
    fontSize: scale(11),
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
  clubName: { color: C.text, fontSize: scale(15), fontWeight: '600' },
  clubBrand: { color: C.sub, fontSize: scale(12) },
  shotCount: { color: C.muted, fontSize: scale(11) },
  rowRight: { alignItems: 'flex-end', gap: 1 },
  carryValue: { color: C.text, fontSize: scale(18), fontWeight: '800', letterSpacing: -0.5 },
  carryUnit: { color: C.muted, fontSize: scale(10) },
  noData: { color: C.muted, fontSize: scale(18) },
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
  spareLabel: { color: C.text, fontSize: scale(16), fontWeight: '500' },
  spareRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spareCount: {
    color: C.muted,
    fontSize: scale(14),
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
  emptyTitle: { color: C.text, fontSize: scale(20), fontWeight: '800', textAlign: 'center' },
  emptySub: {
    color: C.sub,
    fontSize: scale(14),
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
  emptyBtnText: { color: C.bg, fontSize: scale(15), fontWeight: '700' },
});
