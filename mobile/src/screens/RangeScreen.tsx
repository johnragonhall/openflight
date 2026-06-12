import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnection } from '../state/ConnectionContext';
import { DispersionChart } from '../components/DispersionChart';
import { CameraStream } from '../components/CameraStream';
import { getUniqueClubs } from '../types/shot';
import {
  type GpsCoords, requestLocationPermission, getCurrentCoords, distanceYards,
} from '../utils/gps';
import { useUnitPreference } from '../state/useUnitPreference';
import { cameraUrlPromise, DEFAULT_CAMERA_URL } from './SettingsScreen';
import { PressableScale } from '../components/PressableScale';
import { C, R } from '../theme';

type Tab = 'dispersion' | 'targets' | 'gps' | 'camera';

// ── GPS Tab ─────────────────────────────────────────────────────────────
function GPSTab() {
  const { unitSystem } = useUnitPreference();
  const [pinCoords, setPinCoords] = useState<GpsCoords | null>(null);
  const [currentCoords, setCurrentCoords] = useState<GpsCoords | null>(null);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    requestLocationPermission().then(setPermGranted);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const startTracking = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const refresh = async () => {
      try {
        const c = await getCurrentCoords();
        setCurrentCoords(c);
      } catch { /* GPS unavailable */ }
    };
    refresh();
    intervalRef.current = setInterval(refresh, 3000);
  }, []);

  useEffect(() => {
    if (permGranted) startTracking();
  }, [permGranted, startTracking]);

  const handleSetPin = async () => {
    setLoading(true);
    try {
      const c = await getCurrentCoords();
      setPinCoords(c);
      setCurrentCoords(c);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const yardage = pinCoords && currentCoords
    ? distanceYards(currentCoords, pinCoords)
    : null;

  const displayDist = yardage !== null
    ? unitSystem === 'metric'
      ? `${(yardage * 0.9144).toFixed(0)} m`
      : `${yardage.toFixed(0)} yds`
    : null;

  if (permGranted === false) {
    return (
      <View style={gpsStyles.empty}>
        <Text style={gpsStyles.emptyText}>Location permission required</Text>
        <Text style={gpsStyles.emptySub}>Enable in device settings to use GPS yardage</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={gpsStyles.container}>
      {yardage !== null && (
        <View style={gpsStyles.distanceCard}>
          <Text style={gpsStyles.distLabel}>Distance to Pin</Text>
          <Text style={gpsStyles.distValue}>{displayDist}</Text>
        </View>
      )}
      {!pinCoords && (
        <Text style={gpsStyles.hint}>Walk to the pin, then tap Set Pin</Text>
      )}
      <PressableScale
        style={[gpsStyles.setBtn, (loading || permGranted !== true) && gpsStyles.setBtnDisabled]}
        onPress={handleSetPin}
        disabled={loading || permGranted !== true}
      >
        {loading
          ? <ActivityIndicator color={C.bg} />
          : <Text style={gpsStyles.setBtnText}>{pinCoords ? 'Reset Pin' : 'Set Pin Here'}</Text>}
      </PressableScale>
      {currentCoords && (
        <Text style={gpsStyles.coords}>
          {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}
        </Text>
      )}
    </ScrollView>
  );
}

const gpsStyles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600' },
  emptySub: { color: C.sub, fontSize: 13, marginTop: 6, textAlign: 'center' },
  distanceCard: {
    backgroundColor: C.accentSurface,
    borderRadius: R.lg,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.accentMuted,
  },
  distLabel: { color: C.accentBright, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  distValue: {
    color: C.accent,
    fontSize: 60,
    fontWeight: '800',
    fontVariant: ['tabular-nums' as const],
    marginTop: 4,
    letterSpacing: -2,
  },
  hint: { color: C.sub, fontSize: 14, textAlign: 'center' },
  setBtn: {
    backgroundColor: C.accent,
    borderRadius: R.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  setBtnDisabled: { opacity: 0.4 },
  setBtnText: { color: C.bg, fontSize: 16, fontWeight: '700' },
  coords: { color: C.muted, fontSize: 11, textAlign: 'center' },
});

const TARGETS = [50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 400, 450];
const TARGET_RADIUS_YDS = 10;

// ── Targets Tab ──────────────────────────────────────────────────────────
function TargetsTab() {
  const { shots } = useConnection();
  const { unitSystem } = useUnitPreference();
  const [target, setTarget] = useState(150);
  const radius = TARGET_RADIUS_YDS;

  const inCount = useMemo(() => {
    const convFactor = unitSystem === 'metric' ? 0.9144 : 1;
    const t = target * convFactor;
    let count = 0;
    for (const s of shots) {
      const carry = (s.carry_spin_adjusted ?? s.estimated_carry_yards) * convFactor;
      if (Math.abs(carry - t) <= radius) count++;
    }
    return count;
  }, [shots, target, unitSystem]);
  const unit = unitSystem === 'metric' ? 'm' : 'yds';

  return (
    <ScrollView contentContainerStyle={tgtStyles.container}>
      <Text style={tgtStyles.label}>Target Distance</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tgtStyles.chips}>
        {TARGETS.map((t) => (
          <PressableScale
            key={t}
            style={[tgtStyles.chip, target === t && tgtStyles.chipActive]}
            onPress={() => setTarget(t)}
            scale={0.94}
          >
            <Text style={[tgtStyles.chipText, target === t && tgtStyles.chipTextActive]}>
              {unitSystem === 'metric' ? `${(t * 0.9144).toFixed(0)}${unit}` : `${t}${unit}`}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
      <View style={tgtStyles.resultCard}>
        <Text style={tgtStyles.resultLabel}>Within ±{radius}{unit} of target</Text>
        <Text style={tgtStyles.resultValue}>{inCount} / {shots.length}</Text>
        {shots.length > 0 && (
          <Text style={tgtStyles.resultPct}>
            {((inCount / shots.length) * 100).toFixed(0)}% accuracy
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const tgtStyles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  label: { color: C.sub, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  chips: { marginBottom: 4 },
  chip: {
    backgroundColor: C.s2,
    borderRadius: R.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.sub, fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: C.bg },
  resultCard: {
    backgroundColor: C.s1,
    borderRadius: R.lg,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  resultLabel: { color: C.sub, fontSize: 13 },
  resultValue: {
    color: C.accent,
    fontSize: 52,
    fontWeight: '800',
    fontVariant: ['tabular-nums' as const],
    letterSpacing: -1,
  },
  resultPct: { color: C.sub, fontSize: 14, marginTop: 4 },
});

// ── Camera Tab ───────────────────────────────────────────────────────────
function CameraTab() {
  const [url, setUrl] = useState(DEFAULT_CAMERA_URL);
  useEffect(() => {
    cameraUrlPromise.then(setUrl).catch(() => {});
  }, []);
  return (
    <View style={camStyles.container}>
      <Text style={camStyles.url} numberOfLines={1}>{url}</Text>
      <CameraStream streamUrl={url} height={280} />
    </View>
  );
}

const camStyles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  url: { color: C.muted, fontSize: 11, marginBottom: 10 },
});

const TABS: { key: Tab; label: string }[] = [
  { key: 'dispersion', label: 'Dispersion' },
  { key: 'targets', label: 'Targets' },
  { key: 'gps', label: 'GPS' },
  { key: 'camera', label: 'Camera' },
];

// ── Main ─────────────────────────────────────────────────────────────────
export function RangeScreen() {
  const { shots } = useConnection();
  const [activeTab, setActiveTab] = useState<Tab>('dispersion');
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const clubs = useMemo(() => getUniqueClubs(shots), [shots]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Range</Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <PressableScale
            key={t.key}
            style={styles.tabWrap}
            onPress={() => setActiveTab(t.key)}
            scale={0.94}
          >
            <View style={[styles.tab, activeTab === t.key && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </View>
          </PressableScale>
        ))}
      </View>

      {activeTab === 'dispersion' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {clubs.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clubChips}>
              <PressableScale
                style={[styles.clubChip, !selectedClub && styles.clubChipActive]}
                onPress={() => setSelectedClub(null)}
                scale={0.94}
              >
                <Text style={[styles.clubChipText, !selectedClub && styles.clubChipTextActive]}>All</Text>
              </PressableScale>
              {clubs.map((c) => (
                <PressableScale
                  key={c}
                  style={[styles.clubChip, selectedClub === c && styles.clubChipActive]}
                  onPress={() => setSelectedClub(c)}
                  scale={0.94}
                >
                  <Text style={[styles.clubChipText, selectedClub === c && styles.clubChipTextActive]}>
                    {c.toUpperCase()}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          )}
          <View style={styles.chartWrap}>
            <DispersionChart shots={shots} selectedClub={selectedClub} />
          </View>
        </ScrollView>
      )}
      {activeTab === 'targets' && <TargetsTab />}
      {activeTab === 'gps' && <GPSTab />}
      {activeTab === 'camera' && <CameraTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.s0,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 2,
  },
  tabWrap: { flex: 1 },
  tab: {
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  tabActive: {
    backgroundColor: C.s2,
    borderColor: C.lineMid,
  },
  tabText: { color: C.muted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: C.text },

  scroll: { paddingVertical: 12, paddingBottom: 40 },
  clubChips: { paddingHorizontal: 16, marginBottom: 10 },
  clubChip: {
    backgroundColor: C.s2,
    borderRadius: R.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.lineMid,
  },
  clubChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  clubChipText: { color: C.sub, fontWeight: '600', fontSize: 13 },
  clubChipTextActive: { color: C.bg },
  chartWrap: { paddingHorizontal: 16 },
});
