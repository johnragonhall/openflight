import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { getSpareClubsWithStats, moveClubToBag, deleteClub } from '../../db/bagDatabase';
import type { ClubWithStats } from '../../types/bag';
import { getClubDisplayName, getTypeLabel } from '../../types/bag';
import { ClubIcon } from '../../components/ClubIcon';
import { PressableScale } from '../../components/PressableScale';
import { R } from '../../theme';
import { useThemeColors, type Palette } from '../../state/useThemeColors';
import { useFontScale } from '../../state/useFontScale';
import { useT } from '../../i18n/useT';

type Styles = ReturnType<typeof makeStyles>;

export function SpareClubsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);
  const [clubs, setClubs] = useState<ClubWithStats[]>([]);

  const load = useCallback(async () => {
    const data = await getSpareClubsWithStats();
    setClubs(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAddToBag = async (club: ClubWithStats) => {
    await moveClubToBag(club.id);
    setClubs(prev => prev.filter(c => c.id !== club.id));
  };

  const handleDelete = (club: ClubWithStats) => {
    Alert.alert(
      t('alertDeleteClubTitle'),
      t('alertSpareDeleteBody', { club: getClubDisplayName(club) }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('alertDeleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            await deleteClub(club.id);
            setClubs(prev => prev.filter(c => c.id !== club.id));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {clubs.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="archive-outline" size={48} color={C.s3} />
          <Text style={s.emptyTitle}>{t('noSpareClubs')}</Text>
          <Text style={s.emptySub}>
            {t('noSpareClubsSub')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.intro}>
            Spare clubs are not in your active bag. Move them back when needed.
          </Text>
          <View style={s.list}>
            {clubs.map((club, i) => (
              <SpareRow
                key={club.id}
                club={club}
                isLast={i === clubs.length - 1}
                onView={() => navigation.navigate('BagClubDetail', { clubId: club.id })}
                onAddToBag={() => handleAddToBag(club)}
                onDelete={() => handleDelete(club)}
                s={s}
                C={C}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SpareRow({
  club, isLast, onView, onAddToBag, onDelete, s, C,
}: {
  club: ClubWithStats;
  isLast: boolean;
  onView: () => void;
  onAddToBag: () => void;
  onDelete: () => void;
  s: Styles;
  C: Palette;
}) {
  const abbrev = getTypeLabel(club.category, club.type_key);
  const display = getClubDisplayName(club);
  const carry = club.avg_carry != null ? Math.round(club.avg_carry) : null;

  return (
    <PressableScale
      style={[s.row, !isLast && s.rowBorder]}
      onPress={onView}
      scale={0.985}
      accessibilityLabel={`${abbrev} ${display}${carry != null ? `, ${carry} yards average` : ''}${club.shot_count > 0 ? `, ${club.shot_count} shots` : ''}`}
    >
      {/* Icon */}
      <View style={s.rowIcon}>
        <ClubIcon category={club.category} size={20} color={C.sub} />
      </View>

      {/* Labels */}
      <View style={s.rowInfo}>
        <View style={s.rowTop}>
          <Text style={s.abbrev}>{abbrev}</Text>
          {carry != null && (
            <Text style={s.carry}>{carry} yds</Text>
          )}
        </View>
        <Text style={s.name} numberOfLines={1}>{display}</Text>
        {club.shot_count > 0 && (
          <Text style={s.count}>{club.shot_count} shots</Text>
        )}
      </View>

      {/* Actions */}
      <View style={s.rowActions}>
        <TouchableOpacity
          onPress={onAddToBag}
          style={s.addBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`Add ${display} to active bag`}
        >
          <Ionicons name="add-circle-outline" size={22} color={C.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={s.trashBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`Delete ${display}`}
        >
          <Ionicons name="trash-outline" size={18} color={C.muted} />
        </TouchableOpacity>
      </View>
    </PressableScale>
  );
}

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 16 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { color: C.text, fontSize: scale(18), fontWeight: '700' },
  emptySub: { color: C.sub, fontSize: scale(13), textAlign: 'center', lineHeight: 18 },

  intro: { color: C.muted, fontSize: scale(12), lineHeight: 17 },

  list: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    minHeight: 68,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },

  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: C.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowInfo: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  abbrev: {
    color: C.sub,
    fontSize: scale(11),
    fontWeight: '800',
    backgroundColor: C.s2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
    overflow: 'hidden',
  },
  carry: { color: C.muted, fontSize: scale(11) },
  name: { color: C.text, fontSize: scale(14), fontWeight: '600' },
  count: { color: C.muted, fontSize: scale(11) },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { padding: 2 },
  trashBtn: { padding: 2 },
});
