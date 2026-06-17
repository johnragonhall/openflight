import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAccessibilityPrefs,
  setAccessibilityPref,
  type AccessibilityPrefs,
} from '../../state/accessibilitySettings';
import { C, R } from '../../theme';

export function AccessibilityScreen() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>({
    reduceMotion: false,
    highContrast: false,
    largeText: false,
  });

  useEffect(() => {
    getAccessibilityPrefs().then(setPrefs).catch(() => {});
  }, []);

  const toggle = (key: keyof AccessibilityPrefs) => {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setAccessibilityPref(key, next).catch(() => {});
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>MOTION</Text>
          <View style={s.sectionBody}>
            <ToggleRow
              label="Reduce Motion"
              sublabel="Minimise animations throughout the app"
              value={prefs.reduceMotion}
              onToggle={() => toggle('reduceMotion')}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>DISPLAY</Text>
          <View style={s.sectionBody}>
            <ToggleRow
              label="High Contrast"
              sublabel="Increase contrast for text and UI elements"
              value={prefs.highContrast}
              onToggle={() => toggle('highContrast')}
              border
            />
            <ToggleRow
              label="Larger Text"
              sublabel="Increase base font size across the app"
              value={prefs.largeText}
              onToggle={() => toggle('largeText')}
            />
          </View>
        </View>

        <Text style={s.footer}>
          These preferences sync to the kiosk display when connected.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label, sublabel, value, onToggle, border,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: () => void;
  border?: boolean;
}) {
  return (
    <View style={[s.toggleRow, border && s.rowBorder]}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  section: { marginBottom: 28 },
  sectionTitle: {
    color: C.muted,
    fontSize: 11,
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

  rowLabel: { color: C.text, fontSize: 16, fontWeight: '500' },
  rowSublabel: { color: C.muted, fontSize: 12, marginTop: 2 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  toggleLeft: { flex: 1, marginRight: 12 },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },

  footer: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 12,
    marginTop: 8,
  },
});
