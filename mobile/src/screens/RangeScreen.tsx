import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConnection } from '../state/ConnectionContext';
import { DispersionChart } from '../components/DispersionChart';
import { CameraStream } from '../components/CameraStream';
import { getUniqueClubs } from '../types/shot';
import {
  type GpsCoords, requestLocationPermission, getCurrentCoords, distanceYards,
} from '../utils/gps';
import { useUnitPreference } from '../state/useUnitPreference';
import { CAMERA_URL_KEY, DEFAULT_CAMERA_URL } from './SettingsScreen';

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
    } catch { /* ignore */ }
    setLoading(false);
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
        <View style={gpsStyles.hint}>
          <Text style={gpsStyles.hintText}>Walk to the pin, then tap "Set Pin"</Text>
        </View>
      )}
      <TouchableOpacity
        style={gpsStyles.setBtn}
        onPress={handleSetPin}
        disabled={loading || permGranted !== true}
      >
        {loading
          ? <ActivityIndicator color="#0a0a0a" />
          : <Text style={gpsStyles.setBtnText}>{pinCoords ? 'Reset Pin' : 'Set Pin Here'}</Text>}
      </TouchableOpacity>
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
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#6b7280', fontSize: 13, marginTop: 6, textAlign: 'center' },
  distanceCard: {
    backgroundColor: '#0d2010', borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#14532d',
  },
  distLabel: { color: '#4ade80', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  distValue: { color: '#22c55e', fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums' as const], marginTop: 4 },
  hint: { alignItems: 'center' },
  hintText: { color: '#6b7280', fontSize: 14 },
  setBtn: {
    backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  setBtnText: { color: '#0a0a0a', fontSize: 16, fontWeight: '700' },
  coords: { color: '#374151', fontSize: 11, textAlign: 'center' },
});

// ── Targets Tab ──────────────────────────────────────────────────────────
function TargetsTab() {
  const { shots } = useConnection();
  const { unitSystem } = useUnitPreference();
  const targets = [50, 75, 100, 125, 150, 175, 200, 225, 250];
  const [target, setTarget] = useState(150);
  const radius = 10;

  const filtered = useMemo(() => {
    return shots.map((s) => {
      const carry = (s.carry_spin_adjusted ?? s.estimated_carry_yards) *
        (unitSystem === 'metric' ? 0.9144 : 1);
      const t = target * (unitSystem === 'metric' ? 0.9144 : 1);
      return Math.abs(carry - t) <= radius;
    });
  }, [shots, target, unitSystem, radius]);

  const inCount = filtered.filter(Boolean).length;
  const unit = unitSystem === 'metric' ? 'm' : 'yds';

  return (
    <ScrollView contentContainerStyle={tgtStyles.container}>
      <Text style={tgtStyles.label}>Target Distance</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tgtStyles.chips}>
        {targets.map((t) => (
          <TouchableOpacity
            key={t}
            style={[tgtStyles.chip, target === t && tgtStyles.chipActive]}
            onPress={() => setTarget(t)}
          >
            <Text style={[tgtStyles.chipText, target === t && tgtStyles.chipTextActive]}>
              {unitSystem === 'metric' ? `${(t * 0.9144).toFixed(0)}${unit}` : `${t}${unit}`}
            </Text>
          </TouchableOpacity>
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
  label: { color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { marginBottom: 8 },
  chip: {
    backgroundColor: '#1a1a1a', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9, marginRight: 8,
  },
  chipActive: { backgroundColor: '#22c55e' },
  chipText: { color: '#9ca3af', fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: '#0a0a0a' },
  resultCard: {
    backgroundColor: '#111', borderRadius: 14, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: '#1f2937',
  },
  resultLabel: { color: '#6b7280', fontSize: 13 },
  resultValue: { color: '#22c55e', fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums' as const] },
  resultPct: { color: '#9ca3af', fontSize: 14, marginTop: 4 },
});

// ── Camera Tab ───────────────────────────────────────────────────────────
function CameraTab() {
  const [url, setUrl] = useState(DEFAULT_CAMERA_URL);
  useEffect(() => {
    AsyncStorage.getItem(CAMERA_URL_KEY).then((v) => { if (v) setUrl(v); }).catch(() => {});
  }, []);
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 10 }}>{url}</Text>
      <CameraStream streamUrl={url} height={280} />
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────
export function RangeScreen() {
  const { shots } = useConnection();
  const [activeTab, setActiveTab] = useState<Tab>('dispersion');
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const clubs = useMemo(() => getUniqueClubs(shots), [shots]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dispersion', label: 'Dispersion' },
    { key: 'targets', label: 'Targets' },
    { key: 'gps', label: 'GPS' },
    { key: 'camera', label: 'Camera' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Range</Text>
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'dispersion' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {clubs.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clubChips}>
              <TouchableOpacity
                style={[styles.clubChip, !selectedClub && styles.clubChipActive]}
                onPress={() => setSelectedClub(null)}
              >
                <Text style={[styles.clubChipText, !selectedClub && styles.clubChipTextActive]}>All</Text>
              </TouchableOpacity>
              {clubs.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.clubChip, selectedClub === c && styles.clubChipActive]}
                  onPress={() => setSelectedClub(c)}
                >
                  <Text style={[styles.clubChipText, selectedClub === c && styles.clubChipTextActive]}>
                    {c.toUpperCase()}
                  </Text>
                </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#111',
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#22c55e' },
  tabText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#22c55e' },
  scroll: { paddingVertical: 12, paddingBottom: 40 },
  clubChips: { paddingHorizontal: 16, marginBottom: 8 },
  clubChip: {
    backgroundColor: '#1a1a1a', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
  },
  clubChipActive: { backgroundColor: '#22c55e' },
  clubChipText: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
  clubChipTextActive: { color: '#0a0a0a' },
  chartWrap: { paddingHorizontal: 16 },
});
