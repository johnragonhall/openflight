import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { getShotsForSession } from '../db/database';
import { ShotDisplay } from '../components/ShotDisplay';
import { exportSessionCSV } from '../utils/exportSession';
import { exportSessionPDF } from '../utils/exportPDF';
import type { Shot } from '../types/shot';
import type { RootStackParamList } from '../types/navigation';
import { useUnitPreference } from '../state/useUnitPreference';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';

type Route = RouteProp<RootStackParamList, 'SessionDetail'>;

export function SessionDetailScreen() {
  const route = useRoute<Route>();
  const nav = useNavigation();
  const { unitSystem } = useUnitPreference();
  const { sessionId, label } = route.params;

  const [shots, setShots] = useState<Shot[]>([]);
  const [selected, setSelected] = useState<Shot | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loaded = getShotsForSession(sessionId);
    setShots(loaded);
    if (loaded.length > 0) setSelected(loaded[loaded.length - 1]!);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{label}</Text>
          <Text style={styles.headerSub}>{shots.length} shots</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleExportCSV} style={styles.actionBtn} disabled={exporting}>
            <Text style={styles.actionText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportPDF} style={styles.actionBtn} disabled={exporting}>
            <Text style={styles.actionText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {selected && <ShotDisplay shot={selected} />}

      <FlatList<Shot>
        data={shots}
        keyExtractor={(s) => s.timestamp}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.listLabel}>All Shots</Text>}
        renderItem={({ item }) => {
          const isSelected = item.timestamp === selected?.timestamp;
          const carry = item.carry_spin_adjusted ?? item.estimated_carry_yards;
          return (
            <TouchableOpacity
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => setSelected(item)}
            >
              <View>
                <Text style={styles.rowClub}>{item.club.toUpperCase()}</Text>
                <Text style={styles.rowTime}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.rowMetrics}>
                <View style={styles.rowMetric}>
                  <Text style={styles.rowVal}>{formatSpeed(item.ball_speed_mph, unitSystem, 0)}</Text>
                  <Text style={styles.rowUnit}>{getSpeedUnit(unitSystem)}</Text>
                </View>
                <View style={styles.rowMetric}>
                  <Text style={styles.rowVal}>{formatDistance(carry, unitSystem, 0)}</Text>
                  <Text style={styles.rowUnit}>{getDistanceUnit(unitSystem)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  backBtn: { paddingRight: 10 },
  backText: { color: '#22c55e', fontSize: 18 },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerSub: { color: '#6b7280', fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { color: '#22c55e', fontWeight: '600', fontSize: 13 },
  list: { paddingBottom: 40 },
  listLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 10,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  rowSelected: { backgroundColor: '#0d2010' },
  rowClub: { color: '#fff', fontWeight: '600', fontSize: 14 },
  rowTime: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  rowMetrics: { flexDirection: 'row', gap: 20 },
  rowMetric: { alignItems: 'flex-end' },
  rowVal: { color: '#fff', fontWeight: '700', fontSize: 18, fontVariant: ['tabular-nums' as const] },
  rowUnit: { color: '#6b7280', fontSize: 11 },
});
