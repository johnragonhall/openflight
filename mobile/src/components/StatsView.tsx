import React, { useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { type SessionStats, type Shot } from '../types/shot';
import { useUnitPreference } from '../state/useUnitPreference';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';
import type { SpeedUnit, DistanceUnit } from '../utils/units';
import { PressableScale } from './PressableScale';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

interface StatsViewProps {
  shots: Shot[];
  stats: SessionStats;
  selectedClub: string | null;
  onSelectClub: (club: string | null) => void;
  onClearSession: () => void;
}

type Styles = ReturnType<typeof makeStyles>;
type Tbl = ReturnType<typeof makeTbl>;

// ── Formatters ────────────────────────────────────────────────────────────────

const nd = (v: number | null | undefined, dp = 0): string =>
  v != null ? v.toFixed(dp) : '-';

const spd = (v: number | null | undefined, su: SpeedUnit): string =>
  v != null ? formatSpeed(v, su, 0) : '-';

const dst = (v: number | null | undefined, du: DistanceUnit): string =>
  v != null ? formatDistance(v, du, 0) : '-';

const deg1 = (v: number | null | undefined): string =>
  v != null ? `${v.toFixed(1)}°` : '-';

const deg1s = (v: number | null | undefined): string =>
  v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}` : '-';

const delta = (v: number, dp = 0): string =>
  `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;

// Directional: positive = R, negative = L
const dir = (v: number | null | undefined, du: DistanceUnit): string => {
  if (v == null) return '-';
  const abs = formatDistance(Math.abs(v), du, 0);
  return `${abs}${v >= 0 ? 'R' : 'L'}`;
};

const deltaColor = (v: number, C: Palette): string =>
  v > 0.5 ? C.ok : v < -0.5 ? C.err : C.sub;

// ── Column definitions ────────────────────────────────────────────────────────

const ROW_H = 30;
const HEADER_H = 24;

interface ColDef {
  key: string;
  label: string;
  w: number;
  fmt: (s: Shot, stats: SessionStats) => string;
  clr?: (s: Shot, stats: SessionStats) => string;
}

function buildCols(su: SpeedUnit, du: DistanceUnit, C: Palette): ColDef[] {
  return [
    {
      key: 'ball', label: 'BALL', w: 46,
      fmt: (s) => spd(s.ball_speed_mph, su),
      clr: () => C.text,
    },
    {
      key: 'dball', label: 'ΔBS', w: 34,
      fmt: (s, st) => delta(s.ball_speed_mph - st.avg_ball_speed, 0),
      clr: (s, st) => deltaColor(s.ball_speed_mph - st.avg_ball_speed, C),
    },
    {
      key: 'club', label: 'CLUB', w: 44,
      fmt: (s) => spd(s.club_speed_mph, su),
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
      fmt: (s) => s.spin_rpm != null ? Math.round(s.spin_rpm).toString() : '-',
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
          : '-',
      clr: (s, st) =>
        st.avg_spin_rpm != null && s.spin_rpm != null
          ? deltaColor(s.spin_rpm - st.avg_spin_rpm, C)
          : C.muted,
    },
    {
      key: 'axis', label: 'AXIS', w: 36,
      fmt: (s) => deg1s(s.spin_axis_deg),
    },
    {
      key: 'apex', label: 'APX', w: 38,
      fmt: (s) => dst(s.apex_height_yards, du),
    },
    {
      key: 'carry', label: 'CARRY', w: 50,
      fmt: (s) => dst(s.carry_spin_adjusted ?? s.estimated_carry_yards, du),
      clr: () => C.text,
    },
    {
      key: 'side', label: 'SIDE', w: 40,
      fmt: (s) => dir(s.carry_side_yards, du),
    },
    {
      key: 'total', label: 'TOT', w: 42,
      fmt: (s) => dst(s.total_distance_yards, du),
    },
    {
      key: 'curve', label: 'CRV', w: 38,
      fmt: (s) => dir(s.curve_yards, du),
    },
  ];
}

// ── Shot log table ────────────────────────────────────────────────────────────

// Cap the table's on-screen height; longer sessions scroll internally and the
// rows beyond the viewport are virtualized away (only mounted on demand).
const MAX_VISIBLE_ROWS = 12;

const PinCell = React.memo(function PinCell({
  label,
  index,
  tbl,
}: {
  label: number;
  index: number;
  tbl: Tbl;
}) {
  return (
    <View style={[tbl.pinCell, { height: ROW_H }, index % 2 === 1 && tbl.rowAlt]}>
      <Text style={tbl.pinTxt}>{label}</Text>
    </View>
  );
});

const MetricRow = React.memo(function MetricRow({
  shot,
  stats,
  index,
  cols,
  C,
  tbl,
}: {
  shot: Shot;
  stats: SessionStats;
  index: number;
  cols: ColDef[];
  C: Palette;
  tbl: Tbl;
}) {
  return (
    <View style={[tbl.row, { height: ROW_H }, index % 2 === 1 && tbl.rowAlt]}>
      {cols.map((col) => {
        const val = col.fmt(shot, stats);
        const color = col.clr ? col.clr(shot, stats) : C.sub;
        return (
          <View key={col.key} style={[tbl.cell, { width: col.w }]}>
            <Text style={[tbl.cellTxt, { color }]} numberOfLines={1}>{val}</Text>
          </View>
        );
      })}
    </View>
  );
});

const ShotLogTable = React.memo(function ShotLogTable({
  shots,
  stats,
  speedUnit,
  distanceUnit,
  C,
  tbl,
}: {
  shots: Shot[];
  stats: SessionStats;
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  C: Palette;
  tbl: Tbl;
}) {
  const cols = useMemo(() => buildCols(speedUnit, distanceUnit, C), [speedUnit, distanceUnit, C]);
  const reversed = useMemo(() => [...shots].reverse(), [shots]);
  const total = reversed.length;
  const viewportH = Math.min(total, MAX_VISIBLE_ROWS) * ROW_H;

  // The pinned # column is a separate (non-scrollable) list kept vertically in
  // sync with the metric list, so both virtualize independently but align.
  const pinRef = useRef<FlatList<Shot>>(null);
  const onMetricScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      pinRef.current?.scrollToOffset({ offset: e.nativeEvent.contentOffset.y, animated: false });
    },
    [],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<Shot> | null | undefined, index: number) => ({
      length: ROW_H,
      offset: ROW_H * index,
      index,
    }),
    [],
  );
  const keyExtractor = useCallback((item: Shot, index: number) => `${item.timestamp}-${index}`, []);

  const renderPin = useCallback(
    ({ index }: { item: Shot; index: number }) => (
      <PinCell label={total - index} index={index} tbl={tbl} />
    ),
    [total, tbl],
  );
  const renderMetric = useCallback(
    ({ item, index }: { item: Shot; index: number }) => (
      <MetricRow shot={item} stats={stats} index={index} cols={cols} C={C} tbl={tbl} />
    ),
    [stats, cols, C, tbl],
  );

  return (
    <View>
      <Text style={tbl.sectionLabel}>SHOT LOG</Text>
      <View style={tbl.tableWrap}>
        {/* Pinned # column (vertical scroll driven by the metric list) */}
        <View style={tbl.pinCol}>
          <View style={[tbl.pinCell, { height: HEADER_H }]}>
            <Text style={tbl.headerTxt}>#</Text>
          </View>
          <FlatList
            ref={pinRef}
            data={reversed}
            keyExtractor={keyExtractor}
            renderItem={renderPin}
            getItemLayout={getItemLayout}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            style={{ height: viewportH }}
          />
        </View>

        {/* Scrollable metric columns - horizontal scroll wraps a vertical,
            virtualized list of rows. */}
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
            <FlatList
              data={reversed}
              keyExtractor={keyExtractor}
              renderItem={renderMetric}
              getItemLayout={getItemLayout}
              onScroll={onMetricScroll}
              scrollEventThrottle={16}
              initialNumToRender={MAX_VISIBLE_ROWS + 4}
              windowSize={11}
              removeClippedSubviews
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={{ height: viewportH }}
            />
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
  const { speedUnit, distanceUnit } = useUnitPreference();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const tbl = useMemo(() => makeTbl(C, scale), [C, scale]);
  const speedLabel = getSpeedUnit(speedUnit);
  const distLabel = getDistanceUnit(distanceUnit);

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
        <Text style={styles.emptyText}>{t('noShots')}</Text>
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
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedClub === null }}
          accessibilityLabel={`${t('all')}, ${shots.length} ${t('shotCount')}`}
        >
          <Text style={[styles.tabText, selectedClub === null && styles.tabTextActive]}>
            {t('all')} ({shots.length})
          </Text>
        </PressableScale>
        {availableClubs.map((club) => (
          <PressableScale
            key={club}
            style={[styles.tab, selectedClub === club && styles.tabActive]}
            onPress={() => onSelectClub(club)}
            scale={0.94}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedClub === club }}
            accessibilityLabel={`${club.toUpperCase()}, ${clubCounts[club] ?? 0} ${t('shotCount')}`}
          >
            <Text style={[styles.tabText, selectedClub === club && styles.tabTextActive]}>
              {club.toUpperCase()} ({clubCounts[club] ?? 0})
            </Text>
          </PressableScale>
        ))}
      </ScrollView>

      {/* Summary cards */}
      <View style={styles.grid}>
        <StatCard styles={styles} label={t('shots')} value={String(stats.shot_count)} />
        <StatCard
          styles={styles}
          label={`${t('avgBall')} (${speedLabel})`}
          value={formatSpeed(stats.avg_ball_speed, speedUnit, 1)}
          primary
        />
        <StatCard
          styles={styles}
          label={`${t('maxBall')} (${speedLabel})`}
          value={formatSpeed(stats.max_ball_speed, speedUnit, 1)}
        />
        <StatCard
          styles={styles}
          label={`${t('avgCarry')} (${distLabel})`}
          value={formatDistance(stats.avg_carry_est, distanceUnit, 0)}
          primary
        />
        {stats.avg_club_speed !== null ? (
          <StatCard
            styles={styles}
            label={`${t('avgClub')} (${speedLabel})`}
            value={formatSpeed(stats.avg_club_speed, speedUnit, 1)}
          />
        ) : null}
        {stats.avg_smash_factor !== null ? (
          <StatCard styles={styles} label={t('avgSmash')} value={stats.avg_smash_factor.toFixed(2)} />
        ) : null}
        {stats.avg_launch_angle !== null ? (
          <StatCard styles={styles} label={t('statAvgLaunch')} value={`${stats.avg_launch_angle.toFixed(1)}°`} />
        ) : null}
        {stats.avg_spin_rpm !== null ? (
          <StatCard styles={styles} label={t('statAvgSpin')} value={Math.round(stats.avg_spin_rpm).toString()} />
        ) : null}
      </View>

      {/* Shot log table */}
      <View style={styles.tableSection}>
        <ShotLogTable shots={shots} stats={stats} speedUnit={speedUnit} distanceUnit={distanceUnit} C={C} tbl={tbl} />
      </View>

      {/* Clear session */}
      <PressableScale style={styles.clearBtn} onPress={onClearSession} scale={0.97} accessibilityRole="button" accessibilityLabel={t('clearSession')}>
        <Text style={styles.clearBtnText}>{t('clearSession')}</Text>
      </PressableScale>
    </View>
  );
});

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = React.memo(function StatCard({
  label,
  value,
  primary,
  styles,
}: {
  label: string;
  value: string;
  primary?: boolean;
  styles: Styles;
}) {
  return (
    <View style={[styles.statCard, primary && styles.statCardPrimary]}>
      <Text style={[styles.statValue, primary && styles.statValuePrimary]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: C.sub, fontSize: scale(15) },

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
  tabText: { color: C.sub, fontWeight: '600', fontSize: scale(13) },
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
    fontSize: scale(28),
    fontWeight: '700',
    fontVariant: ['tabular-nums' as const],
  },
  statValuePrimary: { color: C.accent },
  statLabel: {
    color: C.sub,
    fontSize: scale(10),
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
  clearBtnText: { color: C.sub, fontWeight: '600', fontSize: scale(15) },
});

const makeTbl = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  sectionLabel: {
    color: C.muted,
    fontSize: scale(11),
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
    fontSize: scale(11),
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
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Data cell
  cellTxt: {
    fontSize: scale(11),
    fontVariant: ['tabular-nums' as const],
    fontWeight: '500',
    textAlign: 'center',
  },
});
