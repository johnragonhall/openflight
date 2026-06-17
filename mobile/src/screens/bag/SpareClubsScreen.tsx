import React, { useCallback, useState } from 'react';
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
import { C, R } from '../../theme';

export function SpareClubsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      'Delete Club?',
      `Permanently delete ${getClubDisplayName(club)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
          <Text style={s.emptyTitle}>No spare clubs</Text>
          <Text style={s.emptySub}>
            Clubs you remove from your active bag will appear here.
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
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SpareRow({
  club, isLast, onView, onAddToBag, onDelete,
}: {
  club: ClubWithStats;
  isLast: boolean;
  onView: () => void;
  onAddToBag: () => void;
  onDelete: () => void;
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 16 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  intro: { color: C.muted, fontSize: 12, lineHeight: 17 },

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
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: C.s2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
    overflow: 'hidden',
  },
  carry: { color: C.muted, fontSize: 11 },
  name: { color: C.text, fontSize: 14, fontWeight: '600' },
  count: { color: C.muted, fontSize: 11 },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { padding: 2 },
  trashBtn: { padding: 2 },
});
