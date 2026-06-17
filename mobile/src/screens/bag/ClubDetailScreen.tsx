import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import {
  getClubById, getShotHistoryForClub, moveClubToSpare, deleteClub,
} from '../../db/bagDatabase';
import { deleteShot } from '../../db/database';
import type { ShotHistoryRow } from '../../db/bagDatabase';
import type { Club } from '../../types/bag';
import { getClubDisplayName, getTypeLabel } from '../../types/bag';
import { ClubIcon } from '../../components/ClubIcon';
import { R } from '../../theme';
import { useThemeColors, type Palette } from '../../state/useThemeColors';
import { useFontScale } from '../../state/useFontScale';
import { useT } from '../../i18n/useT';

type Props = NativeStackScreenProps<RootStackParamList, 'BagClubDetail'>;
type SubStyles = ReturnType<typeof makeSs>;

export function ClubDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);
  const ss = useMemo(() => makeSs(C, scale), [C, scale]);
  const { params } = useRoute<Props['route']>();
  const { clubId } = params;

  const [club, setClub] = useState<Club | null>(null);
  const [shots, setShots] = useState<ShotHistoryRow[]>([]);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      getClubById(clubId),
      getClubById(clubId).then(async (cl) => {
        if (!cl) return [];
        return getShotHistoryForClub(cl.type_key, 50);
      }),
    ]);
    setClub(c);
    setShots(s);
  }, [clubId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    if (!club) return;
    navigation.setOptions({ title: getTypeLabel(club.category, club.type_key) });
  }, [navigation, club]);

  const handleMoveToSpare = () => {
    Alert.alert(
      t('alertMoveSpareTitle'),
      t('alertMoveSpareBody', { club: getClubDisplayName(club!) }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('alertMoveSpareConfirm'),
          onPress: async () => {
            await moveClubToSpare(clubId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t('alertDeleteClubTitle'),
      t('alertDeleteClubBody', { club: getClubDisplayName(club!) }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('alertDeleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            await deleteClub(clubId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleDeleteShot = (shotId: string) => {
    Alert.alert(t('alertDeleteShotTitle'), t('alertDeleteShotBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('alertDeleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          await deleteShot(shotId);
          setShots(prev => prev.filter(s => s.id !== shotId));
        },
      },
    ]);
  };

  if (!club) return null;

  const validCarries = shots
    .map(s => s.carry_spin_adjusted ?? s.estimated_carry_yards)
    .filter(Boolean) as number[];

  const avgCarry = validCarries.length > 0
    ? Math.round(validCarries.reduce((a, b) => a + b, 0) / validCarries.length)
    : null;

  const maxCarry = validCarries.length > 0 ? Math.round(Math.max(...validCarries)) : null;
  const minCarry = validCarries.length > 0 ? Math.round(Math.min(...validCarries)) : null;

  let consistency: number | null = null;
  if (validCarries.length > 1 && avgCarry) {
    const variance = validCarries.reduce((s, v) => s + (v - avgCarry) ** 2, 0) / validCarries.length;
    const stdDev = Math.sqrt(variance);
    consistency = Math.max(0, Math.round(100 - (stdDev / avgCarry) * 100));
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Hero card */}
        <View style={s.heroCard}>
          <View style={s.heroIcon}>
            <ClubIcon category={club.category} size={44} color={C.accent} />
          </View>
          <View style={s.heroInfo}>
            <View style={s.heroTop}>
              <Text style={s.heroAbbrev}>{getTypeLabel(club.category, club.type_key)}</Text>
              {club.brand ? <Text style={s.heroBrand}>{club.brand}</Text> : null}
            </View>
            <Text style={s.heroName}>{getClubDisplayName(club)}</Text>
            <Text style={s.heroShotCount}>{shots.length} shots</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatTile label="AVG CARRY" value={avgCarry != null ? `${avgCarry}` : '-'} unit="yds" large ss={ss} C={C} />
          <StatTile label="BEST" value={maxCarry != null ? `${maxCarry}` : '-'} unit="yds" ss={ss} C={C} />
          <StatTile label="FLOOR" value={minCarry != null ? `${minCarry}` : '-'} unit="yds" ss={ss} C={C} />
          {consistency != null && (
            <StatTile label="CONSIST." value={`${consistency}%`} accent ss={ss} C={C} />
          )}
        </View>

        {/* Shot history */}
        {shots.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.sectionLabel}>SHOT HISTORY</Text>
            <View style={s.historyList}>
              {shots.map((shot, i) => (
                <ShotRow
                  key={shot.id}
                  shot={shot}
                  isLast={i === shots.length - 1}
                  onDelete={() => handleDeleteShot(shot.id)}
                  ss={ss}
                  C={C}
                />
              ))}
            </View>
          </View>
        )}

        {shots.length === 0 && (
          <View style={s.noShots}>
            <Text style={s.noShotsText}>No shots yet for this club type.</Text>
            <Text style={s.noShotsSub}>Hit shots with this club selected to see history here.</Text>
          </View>
        )}

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.spareBtn}
            onPress={handleMoveToSpare}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('a11yMoveToSpare')}
          >
            <Ionicons name="archive-outline" size={16} color={C.sub} />
            <Text style={s.spareBtnText}>{t('moveToSpareClubs')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={handleDelete}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${club ? getClubDisplayName(club) : 'club'}`}
          >
            <Ionicons name="trash-outline" size={16} color={C.errText} />
            <Text style={s.deleteBtnText}>{t('deleteClubBtn')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({
  label, value, unit, large, accent, ss, C,
}: {
  label: string; value: string; unit?: string; large?: boolean; accent?: boolean; ss: SubStyles; C: Palette;
}) {
  return (
    <View style={ss.tile}>
      <Text style={ss.tileLabel}>{label}</Text>
      <View style={ss.tileValueRow}>
        <Text style={[ss.tileValue, large && ss.tileValueLg, accent && { color: C.accent }]}>
          {value}
        </Text>
        {unit && <Text style={ss.tileUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

function ShotRow({
  shot, isLast, onDelete, ss, C,
}: {
  shot: ShotHistoryRow;
  isLast: boolean;
  onDelete: () => void;
  ss: SubStyles;
  C: Palette;
}) {
  const carry = shot.carry_spin_adjusted ?? shot.estimated_carry_yards;
  const date = new Date(shot.recorded_at);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[ss.shotRow, !isLast && ss.shotRowBorder]}>
      <View style={ss.shotLeft}>
        <Text style={ss.shotDate}>{dateStr}</Text>
        <Text style={ss.shotTime}>{timeStr}</Text>
      </View>
      <View style={ss.shotCenter}>
        {shot.ball_speed_mph != null && (
          <Text style={ss.shotStat}>{Math.round(shot.ball_speed_mph)} mph</Text>
        )}
      </View>
      <View style={ss.shotRight}>
        <Text style={ss.shotCarry}>{Math.round(carry)}</Text>
        <Text style={ss.shotCarryUnit}>yds</Text>
      </View>
      <TouchableOpacity
        onPress={onDelete}
        style={ss.deleteBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`Delete shot from ${dateStr} at ${timeStr}, ${Math.round(carry)} yards`}
      >
        <Ionicons name="trash-outline" size={14} color={C.muted} />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 20 },

  heroCard: {
    flexDirection: 'row',
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 16,
    gap: 14,
    alignItems: 'center',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: R.md,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1, gap: 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroAbbrev: {
    color: C.accent,
    fontSize: scale(11),
    fontWeight: '800',
    backgroundColor: C.accentDim,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.xs,
    overflow: 'hidden',
  },
  heroBrand: { color: C.muted, fontSize: scale(12) },
  heroName: { color: C.text, fontSize: scale(20), fontWeight: '800', letterSpacing: -0.5 },
  heroShotCount: { color: C.sub, fontSize: scale(12) },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  historySection: { gap: 10 },
  sectionLabel: { color: C.muted, fontSize: scale(11), fontWeight: '700', letterSpacing: 1.0, marginLeft: 4 },
  historyList: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },

  noShots: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  noShotsText: { color: C.sub, fontSize: scale(14), fontWeight: '600', textAlign: 'center' },
  noShotsSub: { color: C.muted, fontSize: scale(12), textAlign: 'center', lineHeight: 17 },

  actions: { gap: 10 },
  spareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingVertical: 14,
  },
  spareBtnText: { color: C.sub, fontSize: scale(15), fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.errDim,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.3)',
    paddingVertical: 14,
  },
  deleteBtnText: { color: C.errText, fontSize: scale(15), fontWeight: '600' },
});

const makeSs = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 12,
    gap: 4,
  },
  tileLabel: { color: C.muted, fontSize: scale(9), fontWeight: '700', letterSpacing: 0.8 },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  tileValue: { color: C.sub, fontSize: scale(16), fontWeight: '700' },
  tileValueLg: { color: C.text, fontSize: scale(22), fontWeight: '800', letterSpacing: -0.5 },
  tileUnit: { color: C.muted, fontSize: scale(10) },

  shotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  shotRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  shotLeft: { width: 68, gap: 2 },
  shotDate: { color: C.sub, fontSize: scale(12), fontWeight: '500' },
  shotTime: { color: C.muted, fontSize: scale(10) },
  shotCenter: { flex: 1 },
  shotStat: { color: C.sub, fontSize: scale(12) },
  shotRight: { flexDirection: 'row', alignItems: 'baseline', gap: 2, width: 60, justifyContent: 'flex-end' },
  shotCarry: { color: C.text, fontSize: scale(15), fontWeight: '700' },
  shotCarryUnit: { color: C.muted, fontSize: scale(10) },
  deleteBtn: { paddingLeft: 4 },
});
