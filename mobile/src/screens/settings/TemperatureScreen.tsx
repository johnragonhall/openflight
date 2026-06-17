import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUnitPreference } from '../../state/useUnitPreference';
import type { TemperatureUnit } from '../../utils/units';
import { PressableScale } from '../../components/PressableScale';
import { R } from '../../theme';
import { useThemeColors, type Palette } from '../../state/useThemeColors';
import { useFontScale } from '../../state/useFontScale';

const OPTIONS: { value: TemperatureUnit; label: string; detail: string }[] = [
  { value: 'fahrenheit', label: 'Fahrenheit', detail: '°F' },
  { value: 'celsius',    label: 'Celsius',    detail: '°C' },
];

export function TemperatureScreen() {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);
  const { temperatureUnit, setTemperatureUnit } = useUnitPreference();

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.group}>
          {OPTIONS.map((opt, i) => {
            const selected = opt.value === temperatureUnit;
            const isLast = i === OPTIONS.length - 1;
            return (
              <React.Fragment key={opt.value}>
                <PressableScale
                  style={[s.row, selected && s.rowSelected]}
                  onPress={() => setTemperatureUnit(opt.value)}
                  scale={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={`${opt.label} (${opt.detail})`}
                >
                  <View>
                    <Text style={[s.label, selected && s.labelSelected]}>{opt.label}</Text>
                    <Text style={s.detail}>{opt.detail}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark" size={20} color={C.accent} />}
                </PressableScale>
                {!isLast && <View style={s.separator} />}
              </React.Fragment>
            );
          })}
        </View>
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
    minHeight: 60,
  },
  rowSelected: { backgroundColor: C.accentSurface },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  label: { color: C.sub, fontSize: scale(16) },
  labelSelected: { color: C.text, fontWeight: '600' },
  detail: { color: C.muted, fontSize: scale(13), marginTop: 2 },
});
