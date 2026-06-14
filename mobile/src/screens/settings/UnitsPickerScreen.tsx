import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUnitPreference } from '../../state/useUnitPreference';
import { UNIT_COMBOS } from '../../utils/units';
import type { SpeedUnit, DistanceUnit } from '../../utils/units';
import { PressableScale } from '../../components/PressableScale';
import { C, R } from '../../theme';

export function UnitsPickerScreen() {
  const { speedUnit, distanceUnit, setSpeedUnit, setDistanceUnit } = useUnitPreference();

  const select = (speed: SpeedUnit, distance: DistanceUnit) => {
    setSpeedUnit(speed);
    setDistanceUnit(distance);
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.group}>
          {UNIT_COMBOS.map((combo, i) => {
            const selected = combo.speed === speedUnit && combo.distance === distanceUnit;
            const isLast = i === UNIT_COMBOS.length - 1;
            return (
              <React.Fragment key={combo.label}>
                <PressableScale
                  style={[s.row, selected && s.rowSelected]}
                  onPress={() => select(combo.speed, combo.distance)}
                  scale={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={combo.label}
                >
                  <Text style={[s.label, selected && s.labelSelected]}>{combo.label}</Text>
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

const s = StyleSheet.create({
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
  label: { color: C.sub, fontSize: 16 },
  labelSelected: { color: C.text, fontWeight: '600' },
});
