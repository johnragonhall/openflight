import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccessibility } from '../../state/useAccessibility';
import { useThemeColors } from '../../state/useThemeColors';
import { useFontScale } from '../../state/useFontScale';
import { R } from '../../theme';
import type { AccessibilityPrefKey } from '../../state/accessibilitySettings';

export function AccessibilityScreen() {
  const { prefs, setPref } = useAccessibility();
  const C = useThemeColors();
  const { scale } = useFontScale();

  const toggle = (key: AccessibilityPrefKey) => setPref(key, !prefs[key]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.muted, fontSize: scale(11) }]}>MOTION</Text>
          <View style={[s.sectionBody, { backgroundColor: C.s1, borderColor: C.line }]}>
            <ToggleRow
              C={C}
              scale={scale}
              label="Reduce Motion"
              sublabel="Minimise animations throughout the app"
              value={prefs.reduceMotion}
              onToggle={() => toggle('reduceMotion')}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.muted, fontSize: scale(11) }]}>DISPLAY</Text>
          <View style={[s.sectionBody, { backgroundColor: C.s1, borderColor: C.line }]}>
            <ToggleRow
              C={C}
              scale={scale}
              label="High Contrast"
              sublabel="Increase contrast for text and UI elements"
              value={prefs.highContrast}
              onToggle={() => toggle('highContrast')}
              border
            />
            <ToggleRow
              C={C}
              scale={scale}
              label="Larger Text"
              sublabel="Increase base font size across the app"
              value={prefs.largeText}
              onToggle={() => toggle('largeText')}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: C.muted, fontSize: scale(11) }]}>COLOR</Text>
          <View style={[s.sectionBody, { backgroundColor: C.s1, borderColor: C.line }]}>
            <ToggleRow
              C={C}
              scale={scale}
              label="Color Blind Mode"
              sublabel="Blue/orange palette - safe for red-green color blindness (deuteranopia)"
              value={prefs.colorBlind}
              onToggle={() => toggle('colorBlind')}
            />
          </View>
        </View>

        <Text style={[s.footer, { color: C.muted, fontSize: scale(12) }]}>
          These preferences sync to the kiosk display when connected.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  C, scale, label, sublabel, value, onToggle, border,
}: {
  C: ReturnType<typeof useThemeColors>;
  scale: (n: number) => number;
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: () => void;
  border?: boolean;
}) {
  return (
    <View style={[s.toggleRow, border && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }]}>
      <View style={s.toggleLeft}>
        <Text style={[s.rowLabel, { color: C.text, fontSize: scale(16) }]}>{label}</Text>
        {sublabel && <Text style={[s.rowSublabel, { color: C.muted, fontSize: scale(12) }]}>{sublabel}</Text>}
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
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },

  section: { marginBottom: 28 },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 1.0,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionBody: {
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  rowLabel: { fontWeight: '500' },
  rowSublabel: { marginTop: 2 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  toggleLeft: { flex: 1, marginRight: 12 },

  footer: {
    textAlign: 'center',
    marginTop: 8,
  },
});
