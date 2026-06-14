import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnitPreference } from '../state/useUnitPreference';
import type { UnitSystem } from '../utils/units';
import { PressableScale } from '../components/PressableScale';
import { C, R } from '../theme';
import { OPENFLIGHT_SERVICE_UUID } from '../hooks/useBLEConnection';

export const CAMERA_URL_KEY = 'camera_url';
export const DEFAULT_CAMERA_URL = 'http://openflight.local:8080/stream';

let cachedCameraUrl: string | null = null;
export const cameraUrlPromise: Promise<string> = AsyncStorage.getItem(CAMERA_URL_KEY)
  .then((v) => {
    cachedCameraUrl = v ?? DEFAULT_CAMERA_URL;
    return cachedCameraUrl;
  })
  .catch(() => {
    cachedCameraUrl = DEFAULT_CAMERA_URL;
    return cachedCameraUrl;
  });

export function SettingsScreen() {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const [cameraUrl, setCameraUrl] = useState(() => cachedCameraUrl ?? DEFAULT_CAMERA_URL);

  useEffect(() => {
    if (cachedCameraUrl !== null) return;
    cameraUrlPromise.then(setCameraUrl).catch(() => {});
  }, []);

  const saveCameraUrl = (url: string) => {
    setCameraUrl(url);
    AsyncStorage.setItem(CAMERA_URL_KEY, url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Units">
          <SegmentedControl
            options={[
              { label: 'Imperial', sublabel: 'mph / yds', value: 'imperial' },
              { label: 'Metric', sublabel: 'km/h / m', value: 'metric' },
            ]}
            selected={unitSystem}
            onSelect={(v) => setUnitSystem(v as UnitSystem)}
          />
        </Section>

        <Section title="Camera Stream">
          <View style={styles.labelRow}>
            <Text style={styles.rowLabel}>Pi Stream URL</Text>
          </View>
          <TextInput
            style={styles.urlInput}
            value={cameraUrl}
            onChangeText={saveCameraUrl}
            placeholder={DEFAULT_CAMERA_URL}
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Section>

        <Section title="About">
          <InfoRow label="App Version" value="1.0.0" />
          <InfoRow label="BLE Service UUID" value={OPENFLIGHT_SERVICE_UUID} mono />
        </Section>
      </ScrollView>
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function SegmentedControl({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; sublabel: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View>
      {options.map((opt, i) => {
        const isSelected = opt.value === selected;
        const isLast = i === options.length - 1;
        return (
          <PressableScale
            key={opt.value}
            style={[
              styles.segmentOption,
              isSelected && styles.segmentSelected,
              !isLast && styles.segmentBorder,
            ]}
            onPress={() => onSelect(opt.value)}
            scale={0.985}
          >
            <View style={styles.segmentLeft}>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <View>
                <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.segmentSublabel}>{opt.sublabel}</Text>
              </View>
            </View>
          </PressableScale>
        );
      })}
    </View>
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

  scroll: { padding: 16, paddingBottom: 40 },

  section: { marginBottom: 28 },
  sectionTitle: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },
  sectionBody: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
  },

  segmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  segmentBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  segmentSelected: { backgroundColor: C.accentSurface },
  segmentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: C.accent },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
  },
  segmentLabel: { color: C.sub, fontSize: 15 },
  segmentLabelSelected: { color: C.text, fontWeight: '600' },
  segmentSublabel: { color: C.muted, fontSize: 12, marginTop: 1 },

  labelRow: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  rowLabel: { color: C.sub, fontSize: 14 },

  urlInput: {
    color: C.text,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginBottom: 2,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowValue: { color: C.muted, fontSize: 13 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
});
