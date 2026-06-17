import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { ClubPicker } from '../components/ClubPicker';
import { ErrorBanner } from '../components/ErrorBanner';
import { PressableScale } from '../components/PressableScale';
import { RadarPulse } from '../components/RadarPulse';
import { ShotDisplay } from '../components/ShotDisplay';
import { ShotTracer2D } from '../components/ShotTracer2D';
import { ShotTracer3D } from '../components/ShotTracer3D';
import { ShotShapePill } from '../components/ShotShapePill';
import { useConnection } from '../state/ConnectionContext';
import { useUnitPreference } from '../state/useUnitPreference';
import type { Shot } from '../types/shot';
import type { RootStackParamList, MainTabParamList } from '../types/navigation';
import { formatDistance, formatSpeed, getDistanceUnit, getSpeedUnit } from '../utils/units';
import { exportSessionCSV } from '../utils/exportSession';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Live'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type TracerView = '2d' | '3d';

// ── Pulsing connection dot ───────────────────────────────────────────────────
function PulsingDot({ active, C }: { active: boolean; C: Palette }) {
  const ringAnim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (!active || reduceMotion) { ringAnim.setValue(0); return; }
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
  }, [active, reduceMotion, ringAnim]);

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
            { borderColor: C.ok, transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
      )}
      <View style={[pulseStyles.dot, { backgroundColor: active ? C.ok : C.accent }]} />
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  wrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ring: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

// ── Shot list row with entry animation ──────────────────────────────────────
const ShotListRow = React.memo(function ShotListRow({ shot }: { shot: Shot }) {
  const { speedUnit, distanceUnit } = useUnitPreference();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const reduceMotion = useReduceMotion();
  const entryAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(entryAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 2,
    }).start();
  }, [reduceMotion, entryAnim]);

  const translateY = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  const carry = shot.carry_spin_adjusted ?? shot.estimated_carry_yards;
  const time = new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rowLabel = `${shot.club.toUpperCase()}, ${formatSpeed(shot.ball_speed_mph, speedUnit, 0)} ${getSpeedUnit(speedUnit)} ball speed, ${formatDistance(carry, distanceUnit, 0)} ${getDistanceUnit(distanceUnit)} carry, ${time}`;
  return (
    <Animated.View style={{ opacity: entryAnim, transform: [{ translateY }] }}>
      <View style={styles.shotRow} accessible accessibilityLabel={rowLabel}>
        <View style={styles.shotRowLeft}>
          <View style={styles.shotRowPillRow}>
            <View style={styles.shotRowClubPill}>
              <Text style={styles.shotRowClub}>{shot.club.toUpperCase()}</Text>
            </View>
            <ShotShapePill shape={shot.shot_shape} />
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
              {formatSpeed(shot.ball_speed_mph, speedUnit, 0)}
            </Text>
            <Text style={styles.shotRowUnit}>{getSpeedUnit(speedUnit)}</Text>
          </View>
          <View style={styles.shotRowMetric}>
            <Text style={styles.shotRowValue}>
              {formatDistance(carry, distanceUnit, 0)}
            </Text>
            <Text style={styles.shotRowUnit}>{getDistanceUnit(distanceUnit)}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

// ── Main screen ──────────────────────────────────────────────────────────────
export function HomeScreen() {
  const nav = useNavigation<NavProp>();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
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
                accessibilityLabel={v === '2d' ? '2D tracer view' : '3D tracer view'}
                accessibilityState={{ selected: tracerView === v }}
                hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
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
          <PressableScale
            onPress={() => setClubPickerVisible(true)}
            style={styles.clubChip}
            accessibilityLabel={`Selected club: ${selectedClub}. Tap to change.`}
          >
            <Text style={styles.clubChipText}>{selectedClub}</Text>
            <Text style={styles.clubChipCaret} accessibilityElementsHidden>▾</Text>
          </PressableScale>
          <View style={styles.toolbarRight}>
            {shots.length > 0 && (
              <PressableScale
                onPress={handleExport}
                style={styles.toolbarBtn}
                accessibilityLabel={t('a11yExportCsv')}
              >
                <Text style={styles.toolbarBtnText}>CSV</Text>
              </PressableScale>
            )}
            <PressableScale
              onPress={clearSession}
              style={styles.toolbarBtn}
              accessibilityLabel={t('clearSession')}
            >
              <Text style={styles.toolbarBtnText}>{t('clearShort')}</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.historyLabelRow}>
          <Text style={styles.historyLabel}>{t('filterSession')}</Text>
          <View style={styles.historyCount}>
            <Text style={styles.historyCountText}>{shots.length}</Text>
          </View>
        </View>
      </>
    );
  }, [latestShot, tracerView, shots, selectedClub, handleExport, clearSession, styles, t]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/openflightlogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
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
            accessibilityLabel={
              connected
                ? `Connected via ${connectionLabel}. Tap to manage connection.`
                : 'Not connected. Tap to connect.'
            }
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <PulsingDot active={connected} C={C} />
            <Text
              style={[
                styles.statusText,
                connected ? styles.statusConnected : styles.statusDisconnected,
              ]}
              accessibilityElementsHidden
            >
              {connected ? connectionLabel : t('connectBtn')}
            </Text>
          </PressableScale>
        </View>
      </View>

      {activeError && <ErrorBanner message={activeError} onDismiss={activeDismiss} />}

      {/* States */}
      {!connected ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('notConnected')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('notConnectedSub')}
          </Text>
          <PressableScale
            style={styles.connectButton}
            onPress={() => nav.navigate('Connection')}
          >
            <Text style={styles.connectButtonText}>{t('connectBtn')}</Text>
          </PressableScale>
        </View>
      ) : latestShot === null ? (
        <View style={styles.emptyState}>
          <RadarPulse size={140} label={t('readyTitle')} />
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
          keyExtractor={(item, index) => item.id ?? `${item.timestamp}-${index}`}
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

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
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
  logo: { width: 120, height: 36 },

  mockBadge: {
    backgroundColor: C.mockSurface,
    borderRadius: R.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mockBadgeText: { color: C.mockText, fontSize: scale(10), fontWeight: '700', letterSpacing: 0.8 },
  warnBadge: {
    backgroundColor: C.warnDim,
    borderRadius: R.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  warnBadgeText: { color: C.warn, fontSize: scale(10), fontWeight: '700' },

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
    backgroundColor: C.accentSurface,
    borderWidth: 1,
    borderColor: C.accentMuted,
  },
  statusText: { fontSize: scale(12), fontWeight: '700' },
  statusConnected: { color: C.ok },
  statusDisconnected: { color: C.accent },

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
  tracerBtnText: { color: C.sub, fontSize: scale(11), fontWeight: '700' },
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
    fontSize: scale(22),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  emptySubtitle: { color: C.sub, fontSize: scale(15), textAlign: 'center' },
  connectButton: {
    marginTop: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: R.lg,
  },
  connectButtonText: { color: C.bg, fontWeight: '700', fontSize: scale(16) },

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
  toolbarBtnText: { color: C.accent, fontWeight: '600', fontSize: scale(13) },

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
    fontSize: scale(13),
    textTransform: 'uppercase',
  },
  clubChipCaret: { color: C.sub, fontSize: scale(11) },

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
    fontSize: scale(11),
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
  historyCountText: { color: C.muted, fontSize: scale(10), fontWeight: '700' },

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
  shotRowPillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shotRowClubPill: {
    backgroundColor: C.s3,
    borderRadius: R.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  shotRowClub: { color: C.text, fontWeight: '700', fontSize: scale(11), letterSpacing: 0.8 },
  shotRowTime: { color: C.sub, fontSize: scale(11) },
  shotRowMetrics: { flexDirection: 'row', gap: 20 },
  shotRowMetric: { alignItems: 'flex-end' },
  shotRowValue: {
    color: C.text,
    fontWeight: '700',
    fontSize: scale(18),
    fontVariant: ['tabular-nums' as const],
  },
  shotRowUnit: { color: C.sub, fontSize: scale(10) },
});
