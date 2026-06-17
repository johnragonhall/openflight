import React, { useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CLUBS_BY_TYPE } from '../data/clubs';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

interface ClubPickerProps {
  visible: boolean;
  selectedClub: string;
  onSelect: (clubId: string) => void;
  onClose: () => void;
}

export function ClubPicker({ visible, selectedClub, onSelect, onClose }: ClubPickerProps) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('selectClubTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('a11yCloseClubSelect')}>
            <Text style={styles.doneButton}>{t('doneBtn')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {Object.entries(CLUBS_BY_TYPE).map(([group, clubs]) => (
            <View key={group} style={styles.group}>
              <Text style={styles.groupLabel}>{group}</Text>
              <View style={styles.clubRow}>
                {clubs.map((club) => (
                  <TouchableOpacity
                    key={club.id}
                    style={[
                      styles.clubButton,
                      club.id === selectedClub && styles.clubButtonSelected,
                    ]}
                    onPress={() => {
                      onSelect(club.id);
                      onClose();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: club.id === selectedClub }}
                    accessibilityLabel={club.label}
                  >
                    <Text
                      style={[
                        styles.clubLabel,
                        club.id === selectedClub && styles.clubLabelSelected,
                      ]}
                    >
                      {club.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  title: { color: C.text, fontSize: scale(18), fontWeight: '700' },
  doneButton: { color: C.accent, fontSize: scale(16), fontWeight: '600' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  group: { marginBottom: 24 },
  groupLabel: {
    color: C.muted,
    fontSize: scale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  clubRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clubButton: {
    backgroundColor: C.s2,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 58,
    alignItems: 'center',
  },
  clubButtonSelected: { backgroundColor: C.accent },
  clubLabel: { color: C.text, fontWeight: '700', fontSize: scale(15) },
  clubLabelSelected: { color: C.bg },
});
