import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, R } from '../theme';

const PLANNED = [
  'Course database with hole yardages and layouts',
  'Virtual round scoring (stroke, stableford, match play)',
  'Hole-by-hole dispersion analysis',
  'Handicap tracking',
  'GPS-linked hole auto-detection',
  'Share scorecard as PDF',
];

export function CourseScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Course Play</Text>
        <Text style={styles.badge}>Coming Soon</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.desc}>Virtual course play is planned for a future release.</Text>
        <Text style={styles.listLabel}>Planned features</Text>
        {PLANNED.map((f) => (
          <View key={f} style={styles.item}>
            <Text style={styles.bullet}>›</Text>
            <Text style={styles.itemText}>{f}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  title: { color: C.text, fontSize: 22, fontWeight: '800' },
  badge: {
    backgroundColor: C.s2, color: C.sub,
    fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: R.sm, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  body: { padding: 20, gap: 12 },
  desc: { color: C.sub, fontSize: 15, lineHeight: 22 },
  listLabel: {
    color: C.muted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8,
  },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { color: C.accent, fontSize: 16, lineHeight: 22 },
  itemText: { color: C.text, fontSize: 14, lineHeight: 22, flex: 1 },
});
