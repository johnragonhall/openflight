import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { computeStats, getUniqueClubs, type Shot } from '../types/shot';
import { useUnitPreference } from '../state/useUnitPreference';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';

interface StatsViewProps {
  shots: Shot[];
  onClearSession: () => void;
}

export function StatsView({ shots, onClearSession }: StatsViewProps) {
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const { unitSystem } = useUnitPreference();
  const speedUnit = getSpeedUnit(unitSystem);
  const distUnit = getDistanceUnit(unitSystem);

  const availableClubs = useMemo(() => getUniqueClubs(shots), [shots]);

  const clubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of shots) counts[s.club] = (counts[s.club] ?? 0) + 1;
    return counts;
  }, [shots]);

  const filtered = useMemo(
    () => (selectedClub === null ? shots : shots.filter((s) => s.club === selectedClub)),
    [shots, selectedClub]
  );

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  if (shots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No shots yet</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Club filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedClub === null && styles.tabActive]}
          onPress={() => setSelectedClub(null)}
        >
          <Text style={[styles.tabText, selectedClub === null && styles.tabTextActive]}>
            All ({shots.length})
          </Text>
        </TouchableOpacity>
        {availableClubs.map((club) => (
          <TouchableOpacity
            key={club}
            style={[styles.tab, selectedClub === club && styles.tabActive]}
            onPress={() => setSelectedClub(club)}
          >
            <Text style={[styles.tabText, selectedClub === club && styles.tabTextActive]}>
              {club.toUpperCase()} ({clubCounts[club] ?? 0})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats grid */}
      <View style={styles.grid}>
        <StatCard label="Shots" value={String(stats.shot_count)} />
        <StatCard
          label={`Avg Ball (${speedUnit})`}
          value={formatSpeed(stats.avg_ball_speed, unitSystem, 1)}
          primary
        />
        <StatCard
          label={`Max Ball (${speedUnit})`}
          value={formatSpeed(stats.max_ball_speed, unitSystem, 1)}
        />
        <StatCard
          label={`Avg Carry (${distUnit})`}
          value={formatDistance(stats.avg_carry_est, unitSystem, 0)}
          primary
        />
        {stats.avg_club_speed !== null && (
          <StatCard
            label={`Avg Club (${speedUnit})`}
            value={formatSpeed(stats.avg_club_speed, unitSystem, 1)}
          />
        )}
        {stats.avg_smash_factor !== null && (
          <StatCard label="Avg Smash" value={stats.avg_smash_factor.toFixed(2)} />
        )}
      </View>

      <TouchableOpacity style={styles.clearBtn} onPress={onClearSession}>
        <Text style={styles.clearBtnText}>Clear Session</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatCard({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <View style={[styles.statCard, primary && styles.statCardPrimary]}>
      <Text style={[styles.statValue, primary && styles.statValuePrimary]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#6b7280', fontSize: 15 },
  tabs: { marginBottom: 16 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#1a1a1a', marginRight: 8,
  },
  tabActive: { backgroundColor: '#22c55e' },
  tabText: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#0a0a0a' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  statCard: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    margin: 4, flex: 1, minWidth: 130,
  },
  statCardPrimary: { backgroundColor: '#14532d' },
  statValue: { color: '#ffffff', fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums' as const] },
  statValuePrimary: { color: '#22c55e' },
  statLabel: { color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },
  clearBtn: {
    marginTop: 24, backgroundColor: '#1f2937', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  clearBtnText: { color: '#9ca3af', fontWeight: '600', fontSize: 15 },
});
