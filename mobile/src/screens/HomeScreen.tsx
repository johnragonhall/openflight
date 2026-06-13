import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ClubPicker } from '../components/ClubPicker';
import { ErrorBanner } from '../components/ErrorBanner';
import { PressableScale } from '../components/PressableScale';
import { RadarPulse } from '../components/RadarPulse';
import { ShotDisplay } from '../components/ShotDisplay';
import { ShotTracer2D } from '../components/ShotTracer2D';
import { ShotTracer3D } from '../components/ShotTracer3D';
import { useConnection } from '../state/ConnectionContext';
import { useUnitPreference } from '../state/useUnitPreference';
import type { Shot } from '../types/shot';
import type { RootStackParamList, MainTabParamList } from '../types/navigation';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';
import { exportSessionCSV } from '../utils/exportSession';
import { C, R } from '../theme';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Live'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type TracerView = '2d' | '3d';

// ── Pulsing connection dot ───────────────────────────────────────────────────
function PulsingDot({ active }: { active: boolean }) {
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { ringAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.6] });
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.7, 0.4, 0],
  });

  return (
    <View style={pulseStyles.wrap}>
      {active && (
        <Animated.View
          style={[
            pulseStyles.ring,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
      )}
      <View style={[pulseStyles.dot, { backgroundColor: active ? C.ok : C.sub }]} />
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  wrap: { width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.ok,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

// ── Shot list row with entry animation ──────────────────────────────────────
const ShotListRow = React.memo(function ShotListRow({ shot }: { shot: Shot }) {
  const { unitSystem } = useUnitPreference();
  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entryAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 2,
    }).start();
  }, []);

  const translateY = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  const carry = shot.carry_spin_adjusted ?? shot.estimated_carry_yards;
  return (
    <Animated.View style={{ opacity: entryAnim, transform: [{ translateY }] }}>
      <View style={styles.shotRow}>
        <View style={styles.shotRowLeft}>
          <View style={styles.shotRowClubPill}>
            <Text style={styles.shotRowClub}>{shot.club.toUpperCase()}</Text>
          </View>
          <Text style={styles.shotRowTime}>
            {new Date(shot.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.shotRowMetrics}>
          <View style={styles.shotRowMetric}>
            <Text style={styles.shotRowValue}>
              {formatSpeed(shot.ball_speed_mph, unitSystem, 0)}
            </Text>
            <Text style={styles.shotRowUnit}>{getSpeedUnit(unitSystem)}</Text>
          </View>
          <View style={styles.shotRowMetric}>
            <Text style={styles.shotRowValue}>
              {formatDistance(carry, unitSystem, 0)}
            </Text>
            <Text style={styles.shotRowUnit}>{getDistanceUnit(unitSystem)}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

// ── Main screen ──────────────────────────────────────────────────────────────
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

  const handleExport = React.useCallback(async () => {
    try { await exportSessionCSV(shots); }
    catch (e) { setExportError(e instanceof Error ? e.message : 'Export failed'); }
  }, [shots]);

  const activeError = exportError ?? errorMessage;
  const activeDismiss = exportError ? () => setExportError(null) : dismissError;

  const renderItem = React.useCallback(
    ({ item, index }: { item: Shot; index: number }) => {
      if (index === 0) return null;
      return <ShotListRow shot={item} />;
    },
    [],
  );

  const ListHeader = React.useCallback(() => {
    if (!latestShot) return null;
    return (
      <>
        <View style={styles.tracerWrap}>
          <View style={styles.tracerToggle}>
            {(['2d', '3d'] as TracerView[]).map((v) => (
              <PressableScale
                key={v}
                style={[styles.tracerBtn, tracerView === v && styles.tracerBtnActive]}
                onPress={() => setTracerView(v)}
                scale={0.94}
              >
                <Text
                  style={[
                    styles.tracerBtnText,
                    tracerView === v && styles.tracerBtnTextActive,
                  ]}
                >
                  {v.toUpperCase()}
                </Text>
              </PressableScale>
            ))}
          </View>
          {tracerView === '2d'
            ? <ShotTracer2D shot={latestShot} />
            : <ShotTracer3D shot={latestShot} />}
        </View>

        <ShotDisplay shot={latestShot} />

        <View style={styles.toolbarRow}>
          <PressableScale onPress={() => setClubPickerVisible(true)} style={styles.clubChip}>
            <Text style={styles.clubChipText}>{selectedClub}</Text>
            <Text style={styles.clubChipCaret}>▾</Text>
          </PressableScale>
          <View style={styles.toolbarRight}>
            {shots.length > 0 && (
              <PressableScale onPress={handleExport} style={styles.toolbarBtn}>
                <Text style={styles.toolbarBtnText}>CSV</Text>
              </PressableScale>
            )}
            <PressableScale onPress={clearSession} style={styles.toolbarBtn}>
              <Text style={styles.toolbarBtnText}>Clear</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.historyLabelRow}>
          <Text style={styles.historyLabel}>Session</Text>
          <View style={styles.historyCount}>
            <Text style={styles.historyCountText}>{shots.length}</Text>
          </View>
        </View>
      </>
    );
  }, [latestShot, tracerView, shots, selectedClub, handleExport, clearSession]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>OpenFlight</Text>
        <View style={styles.headerRight}>
          {mockMode && (
            <View style={styles.mockBadge}>
              <Text style={styles.mockBadgeText}>MOCK</Text>
            </View>
          )}
          {malformedCount > 3 && (
            <View style={styles.warnBadge}>
              <Text style={styles.warnBadgeText}>BLE !</Text>
            </View>
          )}
          <PressableScale
            style={[
              styles.statusBadge,
              connected ? styles.connectedBadge : styles.disconnectedBadge,
            ]}
            onPress={() => nav.navigate('Connection')}
          >
            <PulsingDot active={connected} />
            <Text
              style={[
                styles.statusText,
                connected ? styles.statusConnected : styles.statusDisconnected,
              ]}
            >
              {connected ? connectionLabel : 'Connect'}
            </Text>
          </PressableScale>
        </View>
      </View>

      {activeError && <ErrorBanner message={activeError} onDismiss={activeDismiss} />}

      {/* States */}
      {!connected ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Not connected</Text>
          <Text style={styles.emptySubtitle}>
            Link to your launch monitor to start tracking
          </Text>
          <PressableScale
            style={styles.connectButton}
            onPress={() => nav.navigate('Connection')}
          >
            <Text style={styles.connectButtonText}>Connect</Text>
          </PressableScale>
        </View>
      ) : latestShot === null ? (
        <View style={styles.emptyState}>
          <RadarPulse size={140} label="Waiting for shot" />
          <PressableScale
            onPress={() => setClubPickerVisible(true)}
            style={[styles.clubChip, styles.clubChipCentered]}
          >
            <Text style={styles.clubChipText}>{selectedClub}</Text>
            <Text style={styles.clubChipCaret}>▾</Text>
          </PressableScale>
        </View>
      ) : (
        <FlatList<Shot>
          data={shots}
          keyExtractor={(item) => item.id ?? item.timestamp}
          ListHeaderComponent={ListHeader}
          renderItem={renderItem}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { color: C.accent, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },

  mockBadge: {
    backgroundColor: '#3b0764',
    borderRadius: R.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mockBadgeText: { color: '#e879f9', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  warnBadge: {
    backgroundColor: C.warnDim,
    borderRadius: R.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  warnBadgeText: { color: C.warn, fontSize: 10, fontWeight: '700' },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
  },
  connectedBadge: {
    backgroundColor: C.okSurface,
    borderWidth: 1,
    borderColor: C.okMuted,
  },
  disconnectedBadge: {
    backgroundColor: C.s2,
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusConnected: { color: C.ok },
  statusDisconnected: { color: C.sub },

  tracerWrap: { position: 'relative' },
  tracerToggle: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: R.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  tracerBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  tracerBtnActive: { backgroundColor: C.accent },
  tracerBtnText: { color: C.sub, fontSize: 11, fontWeight: '700' },
  tracerBtnTextActive: { color: C.bg },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 40,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  emptySubtitle: { color: C.sub, fontSize: 15, textAlign: 'center' },
  connectButton: {
    marginTop: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: R.lg,
  },
  connectButtonText: { color: C.bg, fontWeight: '700', fontSize: 16 },

  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  toolbarRight: { flexDirection: 'row', gap: 8 },
  toolbarBtn: {
    backgroundColor: C.s2,
    borderRadius: R.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  toolbarBtnText: { color: C.accent, fontWeight: '600', fontSize: 13 },

  clubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.s2,
    borderRadius: R.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  clubChipCentered: { alignSelf: 'center' },
  clubChipText: {
    color: C.text,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  clubChipCaret: { color: C.sub, fontSize: 11 },

  historyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  historyLabel: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  historyCount: {
    backgroundColor: C.s3,
    borderRadius: R.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  historyCountText: { color: C.muted, fontSize: 10, fontWeight: '700' },

  listContent: { paddingBottom: 40 },

  shotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: C.s1,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  shotRowLeft: { gap: 4 },
  shotRowClubPill: {
    backgroundColor: C.s3,
    borderRadius: R.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  shotRowClub: { color: C.text, fontWeight: '700', fontSize: 11, letterSpacing: 0.8 },
  shotRowTime: { color: C.sub, fontSize: 11 },
  shotRowMetrics: { flexDirection: 'row', gap: 20 },
  shotRowMetric: { alignItems: 'flex-end' },
  shotRowValue: {
    color: C.text,
    fontWeight: '700',
    fontSize: 18,
    fontVariant: ['tabular-nums' as const],
  },
  shotRowUnit: { color: C.sub, fontSize: 10 },
});
