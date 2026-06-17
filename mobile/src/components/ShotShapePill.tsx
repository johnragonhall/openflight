import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ShotShape } from '../types/shot';
import { shotShapeColor } from '../utils/shotShape';
import { R } from '../theme';
import { useThemeColors } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';

interface Props {
  shape: ShotShape | null | undefined;
}

const LABEL: Record<ShotShape, string> = {
  straight: 'STR',
  draw:     'DRW',
  fade:     'FDE',
  hook:     'HK',
  slice:    'SLC',
  push:     'PSH',
  pull:     'PLL',
  'push-slice': 'P.SLC',
  'pull-hook':  'P.HK',
};

const FULL_LABEL: Record<ShotShape, string> = {
  straight:     'Straight',
  draw:         'Draw',
  fade:         'Fade',
  hook:         'Hook',
  slice:        'Slice',
  push:         'Push',
  pull:         'Pull',
  'push-slice': 'Push slice',
  'pull-hook':  'Pull hook',
};

export function ShotShapePill({ shape }: Props) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  if (!shape) return null;
  const color = shotShapeColor(shape, C);
  return (
    <View
      style={[styles.pill, { borderColor: color + '55', backgroundColor: color + '18' }]}
      accessibilityLabel={FULL_LABEL[shape]}
    >
      <Text style={[styles.label, { color }]}>{LABEL[shape]}</Text>
    </View>
  );
}

const makeStyles = (scale: (n: number) => number) => StyleSheet.create({
  pill: {
    borderRadius: R.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  label: {
    fontSize: scale(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
