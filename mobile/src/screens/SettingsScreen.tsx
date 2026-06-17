import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUnitPreference } from '../state/useUnitPreference';
import { useConnection } from '../state/ConnectionContext';
import { UNIT_COMBOS, LANGUAGES } from '../utils/units';
import type { RootStackParamList } from '../types/navigation';
import { PressableScale } from '../components/PressableScale';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';
import { OPENFLIGHT_SERVICE_UUID } from '../hooks/useBLEConnection';
import {
  getCameraUrl, setCameraUrl as persistCameraUrl, DEFAULT_CAMERA_URL,
  getCameraEnabled, setCameraEnabled as persistCameraEnabled, DEFAULT_CAMERA_ENABLED,
} from '../state/cameraSettings';

const APP_VERSION = '1.0.0';

type Styles = ReturnType<typeof makeStyles>;

export function SettingsScreen() {
  const { speedUnit, distanceUnit, temperatureUnit, language } = useUnitPreference();
  const { connected, connectionLabel } = useConnection();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [cameraUrl, setCameraUrl] = useState(DEFAULT_CAMERA_URL);
  const [cameraEnabled, setCameraEnabled] = useState(DEFAULT_CAMERA_ENABLED);

  useEffect(() => {
    getCameraUrl().then(setCameraUrl).catch(() => {});
    getCameraEnabled().then(setCameraEnabled).catch(() => {});
  }, []);

  const toggleCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    persistCameraEnabled(next).catch(() => {});
  };

  const saveCameraUrl = (url: string) => {
    setCameraUrl(url);
    persistCameraUrl(url).catch(() => {});
  };

  const unitCombo = UNIT_COMBOS.find(c => c.speed === speedUnit && c.distance === distanceUnit);
  const unitLabel = unitCombo?.label ?? 'mph, yds';
  const tempLabel = temperatureUnit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius';
  const langEntry = LANGUAGES.find(l => l.code === language);
  const langLabel = langEntry?.label ?? 'English';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('settingsTitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Section s={s} title="Connection">
          <NavRow
            s={s}
            C={C}
            label="Radar"
            value={connected ? connectionLabel : t('disconnected')}
            valueColor={connected ? C.ok : C.muted}
            onPress={() => navigation.navigate('Connection')}
          />
        </Section>

        <Section s={s} title="App Settings">
          <NavRow
            s={s}
            C={C}
            label="My Bag"
            value="Clubs & Stats"
            onPress={() => navigation.navigate('BagMain')}
            border
          />
          <NavRow
            s={s}
            C={C}
            label={t('unitsLabel')}
            value={unitLabel}
            onPress={() => navigation.navigate('SettingsUnitsPicker')}
            border
          />
          <NavRow
            s={s}
            C={C}
            label="Temperature"
            value={tempLabel}
            onPress={() => navigation.navigate('SettingsTemperature')}
            border
          />
          <NavRow
            s={s}
            C={C}
            label={t('langLabel')}
            value={langLabel}
            onPress={() => navigation.navigate('SettingsLanguage')}
            border
          />
          <NavRow
            s={s}
            C={C}
            label="Accessibility"
            value="Motion, contrast, text"
            onPress={() => navigation.navigate('SettingsAccessibility')}
          />
        </Section>

        <Section s={s} title="Display">
          <ToggleRow
            s={s}
            C={C}
            label="Camera Tab"
            sublabel="Show live feed in Range screen"
            value={cameraEnabled}
            onToggle={toggleCamera}
          />
          {cameraEnabled && (
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>{t('cameraStreamUrl')}</Text>
              <TextInput
                style={s.urlInput}
                value={cameraUrl}
                onChangeText={saveCameraUrl}
                placeholder={DEFAULT_CAMERA_URL}
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          )}
        </Section>

        <Section s={s} title="About">
          <InfoRow s={s} label="App Version" value={APP_VERSION} />
          <InfoRow s={s} label="BLE Service" value={OPENFLIGHT_SERVICE_UUID} mono />
        </Section>

        <Text style={s.footer}>OpenFlight · DIY Golf Launch Monitor</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Section({ title, children, s }: { title: string; children: React.ReactNode; s: Styles }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function NavRow({
  label, value, valueColor, onPress, border, s, C,
}: {
  label: string;
  value?: string;
  valueColor?: string;
  onPress: () => void;
  border?: boolean;
  s: Styles;
  C: Palette;
}) {
  return (
    <PressableScale
      style={[s.navRow, border && s.rowBorder]}
      onPress={onPress}
      scale={0.985}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint="Double tap to change"
    >
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.navRight}>
        {value != null && (
          <Text style={[s.navValue, valueColor ? { color: valueColor } : undefined]}>
            {value}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={16} color={C.muted} />
      </View>
    </PressableScale>
  );
}

function ToggleRow({
  label, sublabel, value, onToggle, s, C,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: () => void;
  s: Styles;
  C: Palette;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleLeft}>
        <Text style={s.rowLabel}>{label}</Text>
        {sublabel && <Text style={s.rowSublabel}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: C.lineMid, true: C.accent }}
        thumbColor="#ffffff"
        ios_backgroundColor={C.lineMid}
        accessibilityLabel={label}
        accessibilityHint={sublabel}
      />
    </View>
  );
}

function InfoRow({ label, value, mono, s }: { label: string; value: string; mono?: boolean; s: Styles }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.mono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  headerTitle: {
    color: C.text,
    fontSize: scale(22),
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  section: { marginBottom: 28 },
  sectionTitle: {
    color: C.muted,
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: 1.0,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionBody: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 52,
  },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navValue: { color: C.sub, fontSize: scale(15) },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },

  rowLabel: { color: C.text, fontSize: scale(16), fontWeight: '500' },
  rowSublabel: { color: C.muted, fontSize: scale(12), marginTop: 2 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  toggleLeft: { flex: 1, marginRight: 12 },

  inputWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 10,
    paddingBottom: 14,
  },
  inputLabel: {
    color: C.sub,
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  urlInput: {
    color: C.text,
    fontSize: scale(14),
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    minHeight: 52,
  },
  infoValue: { color: C.muted, fontSize: scale(13), flex: 1, textAlign: 'right', paddingLeft: 16 },
  mono: { fontFamily: 'monospace', fontSize: scale(11) },

  footer: {
    textAlign: 'center',
    color: C.muted,
    fontSize: scale(12),
    marginTop: 8,
  },
});
