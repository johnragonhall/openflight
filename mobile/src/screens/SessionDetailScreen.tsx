import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { getShotsForSession } from '../db/database';
import { ShotDisplay } from '../components/ShotDisplay';
import { PressableScale } from '../components/PressableScale';
import { exportSessionCSV } from '../utils/exportSession';
import { exportSessionPDF } from '../utils/exportPDF';
import type { Shot } from '../types/shot';
import type { RootStackParamList } from '../types/navigation';
import { useUnitPreference } from '../state/useUnitPreference';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

type Route = RouteProp<RootStackParamList, 'SessionDetail'>;

export function SessionDetailScreen() {
  const route = useRoute<Route>();
  const nav = useNavigation();
  const { speedUnit, distanceUnit } = useUnitPreference();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const { sessionId, label } = route.params;

  const [shots, setShots] = useState<Shot[]>([]);
  const [selected, setSelected] = useState<Shot | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getShotsForSession(sessionId)
      .then((loaded) => {
        setShots(loaded);
        if (loaded.length > 0) setSelected(loaded[loaded.length - 1] ?? null);
      })
      .catch(() => { /* DB read failure - show empty state */ });
  }, [sessionId]);

  const handleExportCSV = async () => {
    setExporting(true);
    try { await exportSessionCSV(shots); } catch { /* ignore */ }
    setExporting(false);
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try { await exportSessionPDF(shots); } catch { /* ignore */ }
    setExporting(false);
  };

  const renderItem = useCallback(({ item }: { item: Shot }) => {
    const isSelected = item.timestamp === selected?.timestamp;
    const carry = item.carry_spin_adjusted ?? item.estimated_carry_yards;
    return (
      <PressableScale
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => setSelected(item)}
        scale={0.985}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${item.club.toUpperCase()}, ${formatSpeed(item.ball_speed_mph, speedUnit, 0)} ${getSpeedUnit(speedUnit)} ball speed, ${formatDistance(carry, distanceUnit, 0)} ${getDistanceUnit(distanceUnit)} carry`}
      >
        <View style={styles.rowLeft}>
          <View style={styles.rowClubPill}>
            <Text style={styles.rowClub}>{item.club.toUpperCase()}</Text>
          </View>
          <Text style={styles.rowTime}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.rowMetrics}>
          <View style={styles.rowMetric}>
            <Text style={styles.rowVal}>{formatSpeed(item.ball_speed_mph, speedUnit, 0)}</Text>
            <Text style={styles.rowUnit}>{getSpeedUnit(speedUnit)}</Text>
          </View>
          <View style={styles.rowMetric}>
            <Text style={styles.rowVal}>{formatDistance(carry, distanceUnit, 0)}</Text>
            <Text style={styles.rowUnit}>{getDistanceUnit(distanceUnit)}</Text>
          </View>
        </View>
      </PressableScale>
    );
  }, [selected?.timestamp, speedUnit, distanceUnit, styles]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <PressableScale onPress={() => nav.goBack()} style={styles.backBtn} scale={0.9} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Text style={styles.backText}>‹ {t('back')}</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{label}</Text>
          <Text style={styles.headerSub}>{shots.length} {t('shotCount')}</Text>
        </View>
        <View style={styles.headerActions}>
          <PressableScale
            onPress={handleExportCSV}
            style={[styles.actionBtn, exporting && styles.actionBtnDisabled]}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={t('a11yExportCsv')}
          >
            <Text style={styles.actionText}>CSV</Text>
          </PressableScale>
          <PressableScale
            onPress={handleExportPDF}
            style={[styles.actionBtn, exporting && styles.actionBtnDisabled]}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={t('a11yExportPdf')}
          >
            <Text style={styles.actionText}>PDF</Text>
          </PressableScale>
        </View>
      </View>

      {selected && <ShotDisplay shot={selected} />}

      <FlatList<Shot>
        data={shots}
        keyExtractor={(s) => s.id ?? s.timestamp}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.listLabel}>{t('allShots')}</Text>}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  backBtn: { paddingRight: 10 },
  backText: { color: C.accent, fontSize: scale(18) },
  headerCenter: { flex: 1 },
  headerTitle: { color: C.text, fontSize: scale(15), fontWeight: '700' },
  headerSub: { color: C.sub, fontSize: scale(12) },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    backgroundColor: C.s2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionText: { color: C.accent, fontWeight: '600', fontSize: scale(13) },
  list: { padding: 12, gap: 4, paddingBottom: 40 },
  listLabel: {
    color: C.sub,
    fontSize: scale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.s1,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  rowSelected: { backgroundColor: C.accentSurface, borderColor: C.accentMuted },
  rowLeft: { gap: 4 },
  rowClubPill: {
    backgroundColor: C.s3,
    borderRadius: R.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  rowClub: { color: C.text, fontWeight: '700', fontSize: scale(11), letterSpacing: 0.8 },
  rowTime: { color: C.sub, fontSize: scale(11) },
  rowMetrics: { flexDirection: 'row', gap: 20 },
  rowMetric: { alignItems: 'flex-end' },
  rowVal: { color: C.text, fontWeight: '700', fontSize: scale(18), fontVariant: ['tabular-nums' as const] },
  rowUnit: { color: C.sub, fontSize: scale(10) },
});
