import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ClubPicker } from '../components/ClubPicker';
import { ErrorBanner } from '../components/ErrorBanner';
import { ShotDisplay } from '../components/ShotDisplay';
import { ShotTracer2D } from '../components/ShotTracer2D';
import { ShotTracer3D } from '../components/ShotTracer3D';
import { useConnection } from '../state/ConnectionContext';
import { useUnitPreference } from '../state/useUnitPreference';
import type { Shot } from '../types/shot';
import type { RootStackParamList, MainTabParamList } from '../types/navigation';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';
import { exportSessionCSV } from '../utils/exportSession';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Live'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type TracerView = '2d' | '3d';

export function HomeScreen() {
  const nav = useNavigation<NavProp>();
  const {
    connected, connectionLabel, mockMode, shots, latestShot,
    selectedClub, errorMessage, malformedCount,
    setClub, clearSession, dismissError,
  } = useConnection();

  const [clubPickerVisible, setClubPickerVisible] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [tracerView, setTracerView] = useState<TracerView>('2d');

  const handleExport = async () => {
    try { await exportSessionCSV(shots); }
    catch (e) { setExportError(e instanceof Error ? e.message : 'Export failed'); }
  };

  const activeError = exportError ?? errorMessage;
  const activeDismiss = exportError ? () => setExportError(null) : dismissError;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>OpenFlight</Text>
        <View style={styles.headerRight}>
          {mockMode && <Text style={styles.mockBadge}>MOCK</Text>}
          {malformedCount > 3 && <Text style={styles.warnBadge}>BLE⚠</Text>}
          <TouchableOpacity
            style={[styles.statusBadge, connected ? styles.connectedBadge : styles.disconnectedBadge]}
            onPress={() => nav.navigate('Connection')}
          >
            <View style={[styles.dot, connected ? styles.dotConnected : styles.dotDisconnected]} />
            <Text style={[styles.statusText, connected ? styles.statusConnected : styles.statusDisconnected]}>
              {connected ? connectionLabel : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeError && <ErrorBanner message={activeError} onDismiss={activeDismiss} />}

      {!connected ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Not connected</Text>
          <Text style={styles.emptySubtitle}>Tap Connect to link to your launch monitor</Text>
          <TouchableOpacity style={styles.connectButton} onPress={() => nav.navigate('Connection')}>
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      ) : latestShot === null ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Waiting for shots…</Text>
          <TouchableOpacity onPress={() => setClubPickerVisible(true)} style={styles.clubChip}>
            <Text style={styles.clubChipText}>{selectedClub}</Text>
            <Text style={styles.clubChipCaret}>▾</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<Shot>
          data={shots}
          keyExtractor={(item) => item.timestamp}
          ListHeaderComponent={
            <>
              <View style={styles.tracerWrap}>
                <View style={styles.tracerToggle}>
                  {(['2d', '3d'] as TracerView[]).map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.tracerBtn, tracerView === v && styles.tracerBtnActive]}
                      onPress={() => setTracerView(v)}
                    >
                      <Text style={[styles.tracerBtnText, tracerView === v && styles.tracerBtnTextActive]}>
                        {v.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {tracerView === '2d'
                  ? <ShotTracer2D shot={latestShot} />
                  : <ShotTracer3D shot={latestShot} />}
              </View>

              <ShotDisplay shot={latestShot} />

              <View style={styles.toolbarRow}>
                <TouchableOpacity onPress={() => setClubPickerVisible(true)} style={styles.clubChip}>
                  <Text style={styles.clubChipText}>{selectedClub}</Text>
                  <Text style={styles.clubChipCaret}>▾</Text>
                </TouchableOpacity>
                <View style={styles.toolbarRight}>
                  {shots.length > 0 && (
                    <TouchableOpacity onPress={handleExport} style={styles.toolbarBtn}>
                      <Text style={styles.toolbarBtnText}>CSV</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={clearSession} style={styles.toolbarBtn}>
                    <Text style={styles.toolbarBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.historyLabel}>Session ({shots.length})</Text>
            </>
          }
          renderItem={({ item, index }) => {
            if (index === 0) return null;
            return <ShotListRow shot={item} />;
          }}
          contentContainerStyle={styles.listContent}
        />
      )}

      <ClubPicker
        visible={clubPickerVisible}
        selectedClub={selectedClub}
        onSelect={setClub}
        onClose={() => setClubPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

function ShotListRow({ shot }: { shot: Shot }) {
  const { unitSystem } = useUnitPreference();
  const carry = shot.carry_spin_adjusted ?? shot.estimated_carry_yards;
  return (
    <View style={styles.shotRow}>
      <View>
        <Text style={styles.shotRowClub}>{shot.club.toUpperCase()}</Text>
        <Text style={styles.shotRowTime}>
          {new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View style={styles.shotRowMetrics}>
        <View style={styles.shotRowMetric}>
          <Text style={styles.shotRowValue}>{formatSpeed(shot.ball_speed_mph, unitSystem, 0)}</Text>
          <Text style={styles.shotRowUnit}>{getSpeedUnit(unitSystem)}</Text>
        </View>
        <View style={styles.shotRowMetric}>
          <Text style={styles.shotRowValue}>{formatDistance(carry, unitSystem, 0)}</Text>
          <Text style={styles.shotRowUnit}>{getDistanceUnit(unitSystem)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { color: '#22c55e', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  mockBadge: {
    backgroundColor: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, letterSpacing: 1,
  },
  warnBadge: {
    backgroundColor: '#78350f', color: '#fbbf24', fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  connectedBadge: { backgroundColor: '#14532d' },
  disconnectedBadge: { backgroundColor: '#1f2937' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotConnected: { backgroundColor: '#22c55e' },
  dotDisconnected: { backgroundColor: '#6b7280' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusConnected: { color: '#22c55e' },
  statusDisconnected: { color: '#9ca3af' },
  tracerWrap: { position: 'relative' },
  tracerToggle: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8, overflow: 'hidden',
  },
  tracerBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  tracerBtnActive: { backgroundColor: '#22c55e' },
  tracerBtnText: { color: '#9ca3af', fontSize: 11, fontWeight: '700' },
  tracerBtnTextActive: { color: '#0a0a0a' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  emptySubtitle: { color: '#6b7280', fontSize: 15, textAlign: 'center' },
  connectButton: {
    marginTop: 16, backgroundColor: '#22c55e',
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10,
  },
  connectButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 16 },
  toolbarRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  toolbarRight: { flexDirection: 'row', gap: 8 },
  toolbarBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  toolbarBtnText: { color: '#22c55e', fontWeight: '600', fontSize: 13 },
  clubChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  clubChipText: { color: '#fff', fontWeight: '700', fontSize: 14, textTransform: 'uppercase' },
  clubChipCaret: { color: '#6b7280', fontSize: 12 },
  historyLabel: {
    color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  listContent: { paddingBottom: 40 },
  shotRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  shotRowClub: { color: '#fff', fontWeight: '600', fontSize: 14 },
  shotRowTime: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  shotRowMetrics: { flexDirection: 'row', gap: 20 },
  shotRowMetric: { alignItems: 'flex-end' },
  shotRowValue: { color: '#fff', fontWeight: '700', fontSize: 18, fontVariant: ['tabular-nums' as const] },
  shotRowUnit: { color: '#6b7280', fontSize: 11 },
});
