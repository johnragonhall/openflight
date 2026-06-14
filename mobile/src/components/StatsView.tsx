import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { type SessionStats, type Shot } from '../types/shot';
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

// ── Formatters ────────────────────────────────────────────────────────────────

type US = Parameters<typeof formatSpeed>[1];

const nd = (v: number | null | undefined, dp = 0): string =>
  v != null ? v.toFixed(dp) : '—';

const spd = (v: number | null | undefined, us: US): string =>
  v != null ? formatSpeed(v, us, 0) : '—';

const dst = (v: number | null | undefined, us: US): string =>
  v != null ? formatDistance(v, us, 0) : '—';

const deg1 = (v: number | null | undefined): string =>
  v != null ? `${v.toFixed(1)}°` : '—';

const deg1s = (v: number | null | undefined): string =>
  v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}` : '—';

const delta = (v: number, dp = 0): string =>
  `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;

// Directional: positive = R, negative = L
const dir = (v: number | null | undefined, us: US): string => {
  if (v == null) return '—';
  const abs = formatDistance(Math.abs(v), us, 0);
  return `${abs}${v >= 0 ? 'R' : 'L'}`;
};

const deltaColor = (v: number): string =>
  v > 0.5 ? '#4ade80' : v < -0.5 ? '#f87171' : C.sub;

// ── Column definitions ────────────────────────────────────────────────────────

const ROW_H = 30;
const HEADER_H = 24;

interface ColDef {
  key: string;
  label: string;
  w: number;
  fmt: (s: Shot, stats: SessionStats, us: US) => string;
  clr?: (s: Shot, stats: SessionStats) => string;
}

function buildCols(us: US): ColDef[] {
  return [
    {
      key: 'ball', label: 'BALL', w: 46,
      fmt: (s) => spd(s.ball_speed_mph, us),
      clr: () => C.text,
    },
    {
      key: 'dball', label: 'ΔBS', w: 34,
      fmt: (s, st) => delta(s.ball_speed_mph - st.avg_ball_speed, 0),
      clr: (s, st) => deltaColor(s.ball_speed_mph - st.avg_ball_speed),
    },
    {
      key: 'club', label: 'CLUB', w: 44,
      fmt: (s) => spd(s.club_speed_mph, us),
    },
    {
      key: 'sf', label: 'SF', w: 34,
      fmt: (s) => nd(s.smash_factor, 2),
    },
    {
      key: 'la', label: 'LA°', w: 36,
      fmt: (s) => deg1(s.launch_angle_vertical),
    },
    {
      key: 'aoa', label: 'AoA', w: 36,
      fmt: (s) => deg1s(s.club_angle_deg),
    },
    {
      key: 'path', label: 'PATH', w: 40,
      fmt: (s) => deg1s(s.club_path_deg),
    },
    {
      key: 'f2p', label: 'F2P', w: 36,
      fmt: (s) => deg1s(s.face_to_path_deg),
    },
    {
      key: 'spin', label: 'SPIN', w: 50,
      fmt: (s) => s.spin_rpm != null ? Math.round(s.spin_rpm).toString() : '—',
      clr: (s) =>
        s.spin_quality === 'high' ? C.accent
          : s.spin_quality === 'medium' ? C.sub
          : C.muted,
    },
    {
      key: 'dspin', label: 'ΔSR', w: 38,
      fmt: (s, st) =>
        st.avg_spin_rpm != null && s.spin_rpm != null
          ? delta(s.spin_rpm - st.avg_spin_rpm, 0)
          : '—',
      clr: (s, st) =>
        st.avg_spin_rpm != null && s.spin_rpm != null
          ? deltaColor(s.spin_rpm - st.avg_spin_rpm)
          : C.muted,
    },
    {
      key: 'axis', label: 'AXIS', w: 36,
      fmt: (s) => deg1s(s.spin_axis_deg),
    },
    {
      key: 'apex', label: 'APX', w: 38,
      fmt: (s) => dst(s.apex_height_yards, us),
    },
    {
      key: 'carry', label: 'CARRY', w: 50,
      fmt: (s) => dst(s.carry_spin_adjusted ?? s.estimated_carry_yards, us),
      clr: () => C.text,
    },
    {
      key: 'side', label: 'SIDE', w: 40,
      fmt: (s) => dir(s.carry_side_yards, us),
    },
    {
      key: 'total', label: 'TOT', w: 42,
      fmt: (s) => dst(s.total_distance_yards, us),
    },
    {
      key: 'curve', label: 'CRV', w: 38,
      fmt: (s) => dir(s.curve_yards, us),
    },
  ];
}

// ── Shot log table ────────────────────────────────────────────────────────────

const ShotLogTable = React.memo(function ShotLogTable({
  shots,
  stats,
  unitSystem,
}: {
  shots: Shot[];
  stats: SessionStats;
  unitSystem: US;
}) {
  const cols = useMemo(() => buildCols(unitSystem), [unitSystem]);
  const reversed = useMemo(() => [...shots].reverse(), [shots]);

  return (
    <View>
      <Text style={tbl.sectionLabel}>SHOT LOG</Text>
      <View style={tbl.tableWrap}>
        {/* Pinned # column */}
        <View style={tbl.pinCol}>
          <View style={[tbl.pinCell, { height: HEADER_H }]}>
            <Text style={tbl.headerTxt}>#</Text>
          </View>
          {reversed.map((_, i) => (
            <View
              key={i}
              style={[tbl.pinCell, { height: ROW_H }, i % 2 === 1 && tbl.rowAlt]}
            >
              <Text style={tbl.pinTxt}>{shots.length - i}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable metric columns */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tbl.scroll}>
          <View>
            {/* Header row */}
            <View style={[tbl.row, { height: HEADER_H }]}>
              {cols.map((col) => (
                <View key={col.key} style={[tbl.cell, { width: col.w }]}>
                  <Text style={tbl.headerTxt}>{col.label}</Text>
                </View>
              ))}
            </View>
            {/* Data rows */}
            {reversed.map((shot, i) => (
              <View
                key={i}
                style={[tbl.row, { height: ROW_H }, i % 2 === 1 && tbl.rowAlt]}
              >
                {cols.map((col) => {
                  const val = col.fmt(shot, stats, unitSystem);
                  const color = col.clr ? col.clr(shot, stats) : C.sub;
                  return (
                    <View key={col.key} style={[tbl.cell, { width: col.w }]}>
                      <Text
                        style={[tbl.cellTxt, { color }]}
                        numberOfLines={1}
                      >
                        {val}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

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

  const { availableClubs, clubCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const seen = new Set<string>();
    const clubs: string[] = [];
    for (const s of shots) {
      counts[s.club] = (counts[s.club] ?? 0) + 1;
      if (!seen.has(s.club)) { seen.add(s.club); clubs.push(s.club); }
    }
    return { availableClubs: clubs, clubCounts: counts };
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
      {/* Club filter tabs */}
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

      {/* Summary cards */}
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
        {stats.avg_club_speed !== null ? (
          <StatCard
            label={`Avg Club (${speedUnit})`}
            value={formatSpeed(stats.avg_club_speed, unitSystem, 1)}
          />
        ) : null}
        {stats.avg_smash_factor !== null ? (
          <StatCard label="Avg Smash" value={stats.avg_smash_factor.toFixed(2)} />
        ) : null}
        {stats.avg_launch_angle !== null ? (
          <StatCard label="Avg Launch" value={`${stats.avg_launch_angle.toFixed(1)}°`} />
        ) : null}
        {stats.avg_spin_rpm !== null ? (
          <StatCard label="Avg Spin" value={Math.round(stats.avg_spin_rpm).toString()} />
        ) : null}
      </View>

      {/* Shot log table */}
      <View style={styles.tableSection}>
        <ShotLogTable shots={shots} stats={stats} unitSystem={unitSystem} />
      </View>

      {/* Clear session */}
      <PressableScale style={styles.clearBtn} onPress={onClearSession} scale={0.97}>
        <Text style={styles.clearBtnText}>Clear Session</Text>
      </PressableScale>
    </View>
  );
});

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

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

  tableSection: { marginTop: 24 },

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

const tbl = StyleSheet.create({
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    marginBottom: 8,
  },
  tableWrap: {
    flexDirection: 'row',
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },

  // Pinned shot # column
  pinCol: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.line,
  },
  pinCell: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pinTxt: {
    color: C.muted,
    fontSize: 11,
    fontVariant: ['tabular-nums' as const],
  },

  // Scrollable area
  scroll: { flex: 1 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowAlt: { backgroundColor: C.s2 },

  // Cell
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },

  // Header
  headerTxt: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Data cell
  cellTxt: {
    fontSize: 11,
    fontVariant: ['tabular-nums' as const],
    fontWeight: '500',
    textAlign: 'center',
  },
});
