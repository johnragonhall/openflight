import React from 'react';
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

interface ClubPickerProps {
  visible: boolean;
  selectedClub: string;
  onSelect: (clubId: string) => void;
  onClose: () => void;
}

export function ClubPicker({ visible, selectedClub, onSelect, onClose }: ClubPickerProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Club</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.doneButton}>Done</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  title: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  doneButton: { color: '#22c55e', fontSize: 16, fontWeight: '600' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  group: { marginBottom: 24 },
  groupLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  clubRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clubButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 58,
    alignItems: 'center',
  },
  clubButtonSelected: { backgroundColor: '#22c55e' },
  clubLabel: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  clubLabelSelected: { color: '#0a0a0a' },
});
