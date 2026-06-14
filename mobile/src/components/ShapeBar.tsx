import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Shot, ShotShape } from '../types/shot';
import { classifyShotShape, shotShapeColor } from '../utils/shotShape';
import { C, R } from '../theme';

interface Props {
  /** Pre-classified shots or raw shots (classified on the fly if shot_shape missing). */
  shapes: (ShotShape | null)[];
  height?: number;
}

const DRAW_FAMILY: ShotShape[] = ['draw', 'hook', 'pull-hook'];
const FADE_FAMILY: ShotShape[] = ['fade', 'slice', 'push-slice'];
const NEUTRAL_FAMILY: ShotShape[] = ['straight', 'push', 'pull'];

export function ShapeBar({ shapes, height = 8 }: Props) {
  const valid = shapes.filter((s): s is ShotShape => s != null);
  if (valid.length === 0) return <View style={[styles.empty, { height }]} />;

  const total = valid.length;
  const drawPct  = valid.filter((s) => DRAW_FAMILY.includes(s)).length / total;
  const fadePct  = valid.filter((s) => FADE_FAMILY.includes(s)).length / total;
  const strPct   = valid.filter((s) => NEUTRAL_FAMILY.includes(s)).length / total;

  return (
    <View style={[styles.bar, { height }]}>
      {drawPct > 0 && (
        <View style={[styles.seg, { flex: drawPct, backgroundColor: C.ok }]} />
      )}
      {strPct > 0 && (
        <View style={[styles.seg, { flex: strPct, backgroundColor: C.accent }]} />
      )}
      {fadePct > 0 && (
        <View style={[styles.seg, { flex: fadePct, backgroundColor: C.warn }]} />
      )}
    </View>
  );
}

/** Convenience helper: derive shapes from a Shot array */
export function shapesFromShots(shots: Shot[]): (ShotShape | null)[] {
  return shots.map((s) =>
    s.shot_shape ?? classifyShotShape(s.face_to_path_deg, s.launch_angle_horizontal)
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: R.xs,
    overflow: 'hidden',
    backgroundColor: C.s2,
  },
  seg: {
    minWidth: 2,
  },
  empty: {
    borderRadius: R.xs,
    backgroundColor: C.s2,
  },
});
