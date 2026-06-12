import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getUniqueClubs, type SessionStats, type Shot } from '../types/shot';
import { useUnitPreference } from '../state/useUnitPreference';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';
import { PressableScale } from './PressableScale';
import { C, R } from '../theme';

interface StatsViewProps {
  shots: Shot[];
  stats: SessionStats;
  selectedClub: string | null;
  onSelectClub: (club: string | null) => void;
  onClearSession: () => void;
}

export const StatsView = React.memo(function StatsView({
  shots,
  stats,
  selectedClub,
  onSelectClub,
  onClearSession,
}: StatsViewProps) {
  const { unitSystem } = useUnitPreference();
  const speedUnit = getSpeedUnit(unitSystem);
  const distUnit = getDistanceUnit(unitSystem);

  const availableClubs = useMemo(() => getUniqueClubs(shots), [shots]);

  const clubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of shots) counts[s.club] = (counts[s.club] ?? 0) + 1;
    return counts;
  }, [shots]);

  if (shots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No shots yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        <PressableScale
          style={[styles.tab, selectedClub === null && styles.tabActive]}
          onPress={() => onSelectClub(null)}
          scale={0.94}
        >
          <Text style={[styles.tabText, selectedClub === null && styles.tabTextActive]}>
            All ({shots.length})
          </Text>
        </PressableScale>
        {availableClubs.map((club) => (
          <PressableScale
            key={club}
            style={[styles.tab, selectedClub === club && styles.tabActive]}
            onPress={() => onSelectClub(club)}
            scale={0.94}
          >
            <Text style={[styles.tabText, selectedClub === club && styles.tabTextActive]}>
              {club.toUpperCase()} ({clubCounts[club] ?? 0})
            </Text>
          </PressableScale>
        ))}
      </ScrollView>

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

      <PressableScale style={styles.clearBtn} onPress={onClearSession} scale={0.97}>
        <Text style={styles.clearBtnText}>Clear Session</Text>
      </PressableScale>
    </View>
  );
});

const StatCard = React.memo(function StatCard({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <View style={[styles.statCard, primary && styles.statCardPrimary]}>
      <Text style={[styles.statValue, primary && styles.statValuePrimary]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: C.sub, fontSize: 15 },

  tabs: { marginBottom: 16 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.s2,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  tabActive: { backgroundColor: C.accent, borderColor: C.accent },
  tabText: { color: C.sub, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: C.bg },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  statCard: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    padding: 16,
    margin: 4,
    flex: 1,
    minWidth: 130,
    borderWidth: 1,
    borderColor: C.line,
  },
  statCardPrimary: { backgroundColor: C.accentSurface, borderColor: C.accentMuted },
  statValue: {
    color: C.text,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums' as const],
  },
  statValuePrimary: { color: C.accent },
  statLabel: {
    color: C.sub,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  clearBtn: {
    marginTop: 24,
    backgroundColor: C.s2,
    borderRadius: R.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  clearBtnText: { color: C.sub, fontWeight: '600', fontSize: 15 },
});
