import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUnitPreference } from '../../state/useUnitPreference';
import { LANGUAGES } from '../../utils/units';
import type { SupportedLanguage } from '../../utils/units';
import { PressableScale } from '../../components/PressableScale';
import { R } from '../../theme';
import { useThemeColors, type Palette } from '../../state/useThemeColors';
import { useFontScale } from '../../state/useFontScale';

export function LanguageScreen() {
  const { language, setLanguage } = useUnitPreference();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.group}>
          {LANGUAGES.map((lang, i) => {
            const selected = lang.code === language;
            const isLast = i === LANGUAGES.length - 1;
            const sameLabel = lang.label === lang.native;
            const display = sameLabel ? lang.label : `${lang.label} (${lang.native})`;
            return (
              <React.Fragment key={lang.code}>
                <PressableScale
                  style={[s.row, selected && s.rowSelected]}
                  onPress={() => setLanguage(lang.code as SupportedLanguage)}
                  scale={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={display}
                >
                  <Text style={[s.label, selected && s.labelSelected]}>{display}</Text>
                  {selected && <Ionicons name="checkmark" size={scale(20)} color={C.accent} />}
                </PressableScale>
                {!isLast && <View style={s.separator} />}
              </React.Fragment>
            );
          })}
        </View>
        <Text style={s.note}>
          Language affects UI labels only. Radar data is always in the units you select.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  group: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 54,
  },
  rowSelected: { backgroundColor: C.accentSurface },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  label: { color: C.sub, fontSize: scale(16) },
  labelSelected: { color: C.text, fontWeight: '600' },
  note: {
    color: C.muted,
    fontSize: scale(12),
    marginTop: 12,
    marginHorizontal: 4,
    lineHeight: 17,
  },
});
