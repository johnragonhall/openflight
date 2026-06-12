import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnitPreference } from '../state/useUnitPreference';
import type { UnitSystem } from '../utils/units';

export const CAMERA_URL_KEY = 'camera_url';
export const DEFAULT_CAMERA_URL = 'http://openflight.local:8080/stream';

export function SettingsScreen() {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const [cameraUrl, setCameraUrl] = useState(DEFAULT_CAMERA_URL);

  useEffect(() => {
    AsyncStorage.getItem(CAMERA_URL_KEY).then((v) => { if (v) setCameraUrl(v); }).catch(() => {});
  }, []);

  const saveCameraUrl = (url: string) => {
    setCameraUrl(url);
    AsyncStorage.setItem(CAMERA_URL_KEY, url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <Section title="Units">
        <SegmentedControl
          options={[
            { label: 'Imperial (mph / yds)', value: 'imperial' },
            { label: 'Metric (km/h / m)', value: 'metric' },
          ]}
          selected={unitSystem}
          onSelect={(v) => setUnitSystem(v as UnitSystem)}
        />
      </Section>

      <Section title="Camera Stream">
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Pi Stream URL</Text>
        </View>
        <TextInput
          style={styles.urlInput}
          value={cameraUrl}
          onChangeText={saveCameraUrl}
          placeholder={DEFAULT_CAMERA_URL}
          placeholderTextColor="#4b5563"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </Section>

      <Section title="About">
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>BLE Service UUID</Text>
          <Text style={[styles.rowValue, styles.mono]}>4fafc201…</Text>
        </View>
      </Section>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SegmentedControl({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.segmentOption, opt.value === selected && styles.segmentSelected]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[styles.segmentText, opt.value === selected && styles.segmentTextSelected]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 20 },
  section: { marginBottom: 32 },
  sectionTitle: {
    color: '#6b7280', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  sectionBody: { backgroundColor: '#1a1a1a', borderRadius: 12, overflow: 'hidden' },
  segment: { flexDirection: 'column' },
  segmentOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#111' },
  segmentSelected: { backgroundColor: '#14532d' },
  segmentText: { color: '#9ca3af', fontSize: 15 },
  segmentTextSelected: { color: '#22c55e', fontWeight: '600' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#111',
  },
  rowLabel: { color: '#9ca3af', fontSize: 14 },
  rowValue: { color: '#6b7280', fontSize: 13 },
  mono: { fontFamily: 'monospace' },
  urlInput: {
    backgroundColor: '#111', color: '#e5e7eb', fontSize: 13,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#1f2937', marginHorizontal: 2, marginBottom: 8,
  },
});
