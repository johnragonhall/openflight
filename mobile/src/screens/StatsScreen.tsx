import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnection } from '../state/ConnectionContext';
import { StatsView } from '../components/StatsView';
import { FittingRecommendations } from '../components/FittingRecommendations';
import { computeStats, getUniqueClubs } from '../types/shot';
import { C, R } from '../theme';

export function StatsScreen() {
  const { shots, clearSession } = useConnection();
  const [selectedClub, setSelectedClub] = useState<string | null>(null);

  const clubs = useMemo(() => getUniqueClubs(shots), [shots]);

  const filteredShots = useMemo(
    () => (selectedClub ? shots.filter((s) => s.club === selectedClub) : shots),
    [shots, selectedClub],
  );

  const stats = useMemo(() => computeStats(filteredShots), [filteredShots]);

  const fittingClub = selectedClub ?? (clubs.length === 1 ? clubs[0] ?? null : null);

  if (shots.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Stats</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No shots yet</Text>
          <Text style={styles.emptySub}>Hit some balls to see stats</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stats</Text>
        <View style={styles.headerCountPill}>
          <Text style={styles.headerCountText}>{shots.length} shots</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatsView
          shots={shots}
          stats={stats}
          selectedClub={selectedClub}
          onSelectClub={setSelectedClub}
          onClearSession={clearSession}
        />
        {fittingClub && (
          <View style={styles.fittingWrap}>
            <FittingRecommendations club={fittingClub} stats={stats} />
          </View>
        )}
        {!fittingClub && clubs.length > 1 && (
          <Text style={styles.fittingHint}>Select a single club above to see fitting recommendations</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerCountPill: {
    backgroundColor: C.s3,
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerCountText: { color: C.sub, fontSize: 12, fontWeight: '600' },
  scroll: { paddingBottom: 40 },
  fittingWrap: { paddingHorizontal: 16 },
  fittingHint: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 6 },
});
