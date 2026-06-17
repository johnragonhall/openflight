import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import type { Shot } from '../types/shot';
import type { SpeedUnit, DistanceUnit } from '../utils/units';
import {
  formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit, convertDistanceFromYards,
} from '../utils/units';
import { getRanges, inRange, hLaunchQuality, qualityColor, type Quality } from '../utils/shotQuality';
import { useUnitPreference } from '../state/useUnitPreference';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT, type TFunction, type TKey } from '../i18n/useT';
import { PressableScale } from './PressableScale';
import { R } from '../theme';

const SHOTS_PER_PAGE = 12;

// ── Column definitions (kiosk ShotList parity) ──────────────────────────────────

type ColGroup = 'distance' | 'speed' | 'launch' | 'club' | 'spin';

interface CellData { value: string; unit?: string; quality?: Quality | null }

interface ColDef {
  id: string;
  labelKey: TKey;
  group: ColGroup;
  defaultOn: boolean;
  render: (s: Shot, du: DistanceUnit, su: SpeedUnit, t: TFunction) => CellData;
}

const COLS: ColDef[] = [
  // Distance
  { id: 'carry', labelKey: 'estCarry', group: 'distance', defaultOn: true,
    render: (s, du) => ({ value: formatDistance(s.carry_spin_adjusted ?? s.estimated_carry_yards, du, 0), unit: getDistanceUnit(du) }) },
  { id: 'total', labelKey: 'colTotal', group: 'distance', defaultOn: false,
    render: (s, du) => { const v = s.total_distance_yards ?? null; return { value: v != null ? formatDistance(v, du, 0) : '-', unit: v != null ? getDistanceUnit(du) : undefined }; } },
  { id: 'roll', labelKey: 'colRoll', group: 'distance', defaultOn: false,
    render: (s, du) => { const tot = s.total_distance_yards; if (tot == null) return { value: '-' }; const v = Math.max(0, tot - (s.carry_spin_adjusted ?? s.estimated_carry_yards)); return { value: formatDistance(v, du, 0), unit: getDistanceUnit(du) }; } },
  { id: 'apex', labelKey: 'colApex', group: 'distance', defaultOn: false,
    render: (s, du) => { const v = s.apex_height_yards ?? null; return { value: v != null ? formatDistance(v, du, 0) : '-', unit: v != null ? getDistanceUnit(du) : undefined }; } },
  { id: 'deviation', labelKey: 'colDeviation', group: 'distance', defaultOn: false,
    render: (s, du) => { const v = s.carry_side_yards ?? null; if (v == null) return { value: '-' }; const conv = convertDistanceFromYards(Math.abs(v), du); return { value: (v >= 0 ? '+' : '−') + conv.toFixed(1), unit: getDistanceUnit(du), quality: Math.abs(v) <= 5 ? 'medium' : 'low' }; } },
  // Speed
  { id: 'ballSpeed', labelKey: 'ballSpeed', group: 'speed', defaultOn: true,
    render: (s, _d, su) => ({ value: formatSpeed(s.ball_speed_mph, su, 1), unit: getSpeedUnit(su) }) },
  { id: 'clubSpeed', labelKey: 'clubSpeed', group: 'speed', defaultOn: true,
    render: (s, _d, su) => { const v = s.club_speed_mph; return { value: v != null ? formatSpeed(v, su, 1) : '-', unit: v != null ? getSpeedUnit(su) : undefined }; } },
  { id: 'smash', labelKey: 'colSmash', group: 'speed', defaultOn: false,
    render: (s) => { const v = s.smash_factor; if (v == null) return { value: '-' }; const ideal = s.club === 'driver' ? { min: 1.40, max: 1.50 } : { min: 1.28, max: 1.42 }; return { value: v.toFixed(2), quality: inRange(v, ideal) }; } },
  // Launch
  { id: 'vLaunch', labelKey: 'vLaunch', group: 'launch', defaultOn: true,
    render: (s) => { const v = s.launch_angle_vertical; if (v == null) return { value: '-' }; return { value: v.toFixed(1) + '°', quality: inRange(v, getRanges(s.club).vLaunch) }; } },
  { id: 'hLaunch', labelKey: 'hLaunch', group: 'launch', defaultOn: false,
    render: (s) => { const v = s.launch_angle_horizontal; if (v == null) return { value: '-' }; return { value: (v >= 0 ? '+' : '') + v.toFixed(1) + '°', quality: hLaunchQuality(v, getRanges(s.club).hLaunch) }; } },
  { id: 'aoa', labelKey: 'clubAoA', group: 'launch', defaultOn: false,
    render: (s) => { const v = s.club_angle_deg; if (v == null) return { value: '-' }; return { value: (v >= 0 ? '+' : '') + v.toFixed(1) + '°', quality: inRange(v, getRanges(s.club).aoa) }; } },
  // Club
  { id: 'clubPath', labelKey: 'clubPath', group: 'club', defaultOn: false,
    render: (s) => { const v = s.club_path_deg; if (v == null) return { value: '-' }; return { value: (v >= 0 ? '+' : '') + v.toFixed(1) + '°', quality: inRange(v, { min: -3, max: 3 }) }; } },
  { id: 'facePath', labelKey: 'colFacePath', group: 'club', defaultOn: false,
    render: (s) => { const v = s.face_to_path_deg ?? null; if (v == null) return { value: '-' }; return { value: (v >= 0 ? '+' : '') + v.toFixed(1) + '°', quality: inRange(Math.abs(v), { min: 0, max: 2 }) }; } },
  // Spin
  { id: 'spinRate', labelKey: 'spinRate', group: 'spin', defaultOn: true,
    render: (s) => { const v = s.spin_rpm; if (v == null) return { value: '-' }; return { value: Math.round(v).toLocaleString('en-US'), unit: 'rpm', quality: inRange(v, getRanges(s.club).spin) }; } },
  { id: 'spinAxis', labelKey: 'spinAxis', group: 'spin', defaultOn: false,
    render: (s) => { const v = s.spin_axis_deg; if (v == null) return { value: '-' }; return { value: (v >= 0 ? '+' : '') + v.toFixed(1) + '°', quality: Math.abs(v) <= 2 ? 'medium' : 'low' }; } },
  { id: 'backSpin', labelKey: 'colBackSpin', group: 'spin', defaultOn: false,
    render: (s) => { if (s.spin_rpm == null || s.spin_axis_deg == null) return { value: '-' }; const v = Math.round(s.spin_rpm * Math.cos(s.spin_axis_deg * Math.PI / 180)); return { value: Math.abs(v).toLocaleString('en-US'), unit: 'rpm' }; } },
  { id: 'sideSpin', labelKey: 'colSideSpin', group: 'spin', defaultOn: false,
    render: (s) => { if (s.spin_rpm == null || s.spin_axis_deg == null) return { value: '-' }; const v = Math.round(s.spin_rpm * Math.sin(s.spin_axis_deg * Math.PI / 180)); return { value: (v >= 0 ? '+' : '') + Math.abs(v).toLocaleString('en-US'), unit: 'rpm' }; } },
  { id: 'shotShape', labelKey: 'colShotShape', group: 'spin', defaultOn: false,
    render: (s, _d, _su, t) => { const deg = s.spin_axis_deg; if (deg == null) return { value: '-' }; const label = deg < -4 ? t('strongDraw') : deg < -1 ? t('draw') : deg <= 1 ? t('straight') : deg <= 4 ? t('slightFade') : t('strongFade'); return { value: label, quality: Math.abs(deg) <= 2 ? 'medium' : 'low' }; } },
];

const DEFAULT_ON = new Set(COLS.filter((c) => c.defaultOn).map((c) => c.id));

const GROUPS: { id: ColGroup; labelKey: TKey }[] = [
  { id: 'distance', labelKey: 'grpDistance' },
  { id: 'speed', labelKey: 'grpSpeed' },
  { id: 'launch', labelKey: 'grpLaunch' },
  { id: 'club', labelKey: 'grpClub' },
  { id: 'spin', labelKey: 'grpSpin' },
];

const NUM_W = 44;
const CLUB_W = 58;
const COL_W = 70;

// ── Component ────────────────────────────────────────────────────────────────────

export function ShotsTable({ shots }: { shots: Shot[] }) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const { speedUnit, distanceUnit } = useUnitPreference();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);

  const [page, setPage] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(DEFAULT_ON));

  const activeCols = useMemo(() => COLS.filter((c) => enabled.has(c.id)), [enabled]);
  const totalPages = Math.max(1, Math.ceil(shots.length / SHOTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const startIndex = safePage * SHOTS_PER_PAGE;

  const pageShots = useMemo(() => {
    const reversed = [...shots].reverse();
    return reversed.slice(startIndex, startIndex + SHOTS_PER_PAGE);
  }, [shots, startIndex]);

  const toggle = useCallback((id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const reset = useCallback(() => setEnabled(new Set(DEFAULT_ON)), []);

  if (shots.length === 0) {
    return (
      <View style={s.empty}><Text style={s.emptyText}>{t('noShots')}</Text></View>
    );
  }

  return (
    <View style={s.container}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <Text style={s.count}>
          {shots.length} {shots.length === 1 ? t('shotSingular') : t('shotCount')}
        </Text>
        <PressableScale
          style={s.colBtn}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('columnsBtn')}
        >
          <Text style={s.colBtnText}>{t('columnsBtn')}</Text>
          <View style={s.colBadge}><Text style={s.colBadgeText}>{activeCols.length}</Text></View>
        </PressableScale>
      </View>

      {/* Table */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View accessibilityLabel={t('a11yShotList')}>
          {/* Header */}
          <View style={[s.row, s.headerRow]}>
            <Text style={[s.th, s.numCell]} accessibilityLabel={t('a11yShotNumber')}>#</Text>
            <Text style={[s.th, s.clubCell]}>{t('clubLabel')}</Text>
            {activeCols.map((c) => (
              <Text key={c.id} style={[s.th, s.dataCell]} numberOfLines={1}>{t(c.labelKey)}</Text>
            ))}
          </View>
          {/* Rows */}
          {pageShots.map((shot, rowIdx) => {
            const shotNumber = shots.length - startIndex - rowIdx;
            return (
              <View key={shot.id ?? `${shot.timestamp}-${rowIdx}`} style={s.row}>
                <Text style={[s.td, s.numCell, s.numText]}>#{shotNumber}</Text>
                <View style={[s.clubCell, s.clubChipWrap]}>
                  <View style={s.clubChip}><Text style={s.clubChipText}>{shot.club.toUpperCase()}</Text></View>
                </View>
                {activeCols.map((c) => {
                  const cell = c.render(shot, distanceUnit, speedUnit, t);
                  const showQuality = cell.quality != null && cell.value !== '-';
                  return (
                    <View key={c.id} style={s.dataCell}>
                      <Text
                        style={[s.td, showQuality ? { color: qualityColor(cell.quality, C) } : null]}
                        numberOfLines={1}
                      >
                        {cell.value}
                        {cell.unit && cell.unit !== '°' ? <Text style={s.unit}> {cell.unit}</Text> : null}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={s.pagination} accessibilityLabel={t('a11yShotListPagination')}>
          <PressableScale
            style={[s.pageBtn, safePage === 0 && s.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            accessibilityRole="button"
            accessibilityLabel={t('prev')}
          >
            <Text style={s.pageBtnText}>{t('prev')}</Text>
          </PressableScale>
          <Text style={s.pageInfo}>{t('page')} {safePage + 1} / {totalPages}</Text>
          <PressableScale
            style={[s.pageBtn, safePage === totalPages - 1 && s.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            accessibilityRole="button"
            accessibilityLabel={t('next')}
          >
            <Text style={s.pageBtnText}>{t('next')}</Text>
          </PressableScale>
        </View>
      )}

      {/* Column picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{t('columnsBtn')}</Text>
              <TouchableOpacity onPress={reset} accessibilityRole="button" accessibilityLabel={t('resetBtn')}>
                <Text style={s.sheetReset}>{t('resetBtn')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.sheetBody}>
              {GROUPS.map((g) => (
                <View key={g.id}>
                  <Text style={s.sheetGroup}>{t(g.labelKey)}</Text>
                  {COLS.filter((c) => c.group === g.id).map((c) => (
                    <View key={c.id} style={s.sheetRow}>
                      <Text style={s.sheetColName}>{t(c.labelKey)}</Text>
                      <Switch
                        value={enabled.has(c.id)}
                        onValueChange={() => toggle(c.id)}
                        trackColor={{ true: C.accentMuted, false: C.s3 }}
                        thumbColor={enabled.has(c.id) ? C.accent : C.muted}
                        accessibilityLabel={t(c.labelKey)}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <PressableScale
              style={s.sheetDone}
              onPress={() => setPickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('doneBtn')}
            >
              <Text style={s.sheetDoneText}>{t('doneBtn')}</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { paddingTop: 8, gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: C.sub, fontSize: scale(14) },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  count: { color: C.sub, fontSize: scale(12), fontWeight: '600' },
  colBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.s2, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 7,
    minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineMid,
  },
  colBtnText: { color: C.accent, fontSize: scale(12), fontWeight: '600' },
  colBadge: { backgroundColor: C.accentDim, borderRadius: R.pill, paddingHorizontal: 6, minWidth: 18, alignItems: 'center' },
  colBadgeText: { color: C.accent, fontSize: scale(10), fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  headerRow: { paddingBottom: 6, marginBottom: 2 },
  th: { color: C.muted, fontSize: scale(10), fontWeight: '700', textAlign: 'right' },
  td: { color: C.text, fontSize: scale(13), textAlign: 'right', fontVariant: ['tabular-nums' as const] },
  unit: { color: C.muted, fontSize: scale(9) },
  numCell: { width: NUM_W, paddingLeft: 16, textAlign: 'left' },
  numText: { color: C.muted, fontSize: scale(12) },
  clubCell: { width: CLUB_W },
  clubChipWrap: { alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 9 },
  clubChip: { backgroundColor: C.s3, borderRadius: R.xs, paddingHorizontal: 7, paddingVertical: 2 },
  clubChipText: { color: C.text, fontSize: scale(10), fontWeight: '700', letterSpacing: 0.5 },
  dataCell: { width: COL_W, paddingVertical: 9, paddingRight: 8, justifyContent: 'center' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4 },
  pageBtn: { backgroundColor: C.s2, borderRadius: R.sm, paddingHorizontal: 16, paddingVertical: 9, minHeight: 44, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineMid },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: C.accent, fontSize: scale(13), fontWeight: '600' },
  pageInfo: { color: C.sub, fontSize: scale(12) },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.s1, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '80%', paddingBottom: 24 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  sheetTitle: { color: C.text, fontSize: scale(17), fontWeight: '800' },
  sheetReset: { color: C.accent, fontSize: scale(14), fontWeight: '600' },
  sheetBody: { paddingHorizontal: 16 },
  sheetGroup: { color: C.muted, fontSize: scale(11), fontWeight: '700', letterSpacing: 1.0, marginTop: 16, marginBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, minHeight: 44 },
  sheetColName: { color: C.text, fontSize: scale(15) },
  sheetDone: { backgroundColor: C.accent, marginHorizontal: 16, marginTop: 16, borderRadius: R.lg, paddingVertical: 14, alignItems: 'center' },
  sheetDoneText: { color: C.bg, fontSize: scale(16), fontWeight: '800' },
});
