import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { Shot } from '../types/shot';
import { computeApexHeight, computeTrajectoryPoints } from '../utils/ballistics';
import { useUnitPreference } from '../state/useUnitPreference';

interface Props { shot: Shot; height?: number }

export const ShotTracer2D = React.memo(function ShotTracer2D({ shot, height = 140 }: Props) {
  const { width } = useWindowDimensions();
  const { unitSystem } = useUnitPreference();
  const W = width;
  const H = height;
  const padL = 32;
  const padR = 12;
  const padT = 12;
  const padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const carry = Math.max(shot.carry_spin_adjusted ?? shot.estimated_carry_yards, 1);
  const apex = Math.max(
    shot.apex_height_yards ?? computeApexHeight(shot.ball_speed_mph, shot.launch_angle_vertical, shot.spin_rpm) ?? carry * 0.12,
    1,
  );
  const pts = computeTrajectoryPoints(carry, apex);

  const toSvgX = (x: number) => padL + (x / carry) * plotW;
  const toSvgY = (y: number) => padT + (1 - y / (apex * 1.18)) * plotH;

  const groundY = toSvgY(0);

  const d = pts.reduce((acc, p, i) => {
    const sx = toSvgX(p.x);
    const sy = toSvgY(p.y);
    return acc + (i === 0 ? `M${sx},${sy}` : ` L${sx},${sy}`);
  }, '');

  const distLabel = unitSystem === 'metric'
    ? `${(carry * 0.9144).toFixed(0)}m`
    : `${carry.toFixed(0)}yds`;
  const apexLabel = unitSystem === 'metric'
    ? `${(apex * 0.9144).toFixed(0)}m`
    : `${apex.toFixed(0)}yds`;

  const yTicks = [apex * 0.5, apex].map((v) => ({ val: v, label: unitSystem === 'metric' ? `${(v * 0.9144).toFixed(0)}m` : `${v.toFixed(0)}` }));

  return (
    <View style={styles.container}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="sky2d" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0c1445" />
            <Stop offset="100%" stopColor="#111827" />
          </LinearGradient>
        </Defs>
        {/* Sky */}
        <Path d={`M0,0 H${W} V${groundY} H0 Z`} fill="url(#sky2d)" />
        {/* Ground */}
        <Path d={`M${padL},${groundY} H${W - padR}`} stroke="#15803d" strokeWidth={2} />

        {/* Y axis ticks */}
        {yTicks.map(({ val, label }) => (
          <React.Fragment key={val}>
            <Line x1={padL} y1={toSvgY(val)} x2={padL + 4} y2={toSvgY(val)} stroke="#374151" strokeWidth={1} />
            <SvgText x={padL - 3} y={toSvgY(val) + 3} fill="#6b7280" fontSize={8} textAnchor="end">{label}</SvgText>
          </React.Fragment>
        ))}

        {/* Trajectory shadow */}
        <Path d={d} stroke="rgba(34,197,94,0.15)" strokeWidth={6} fill="none" />
        {/* Trajectory */}
        <Path d={d} stroke="#22c55e" strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {/* Apex dot */}
        <Circle cx={toSvgX(carry / 2)} cy={toSvgY(apex)} r={3} fill="#22c55e" />
        <SvgText x={toSvgX(carry / 2)} y={toSvgY(apex) - 6} fill="#22c55e" fontSize={9} textAnchor="middle">{apexLabel}</SvgText>

        {/* Landing dot */}
        <Circle cx={toSvgX(carry)} cy={groundY} r={4} fill="#f59e0b" />
        <SvgText x={toSvgX(carry)} y={groundY + 13} fill="#f59e0b" fontSize={9} textAnchor="middle">{distLabel}</SvgText>

        {/* Tee marker */}
        <Circle cx={toSvgX(0)} cy={groundY} r={3} fill="#9ca3af" />
        <SvgText x={toSvgX(0)} y={groundY + 13} fill="#9ca3af" fontSize={8} textAnchor="middle">tee</SvgText>

        {/* Club label */}
        <SvgText x={W - padR} y={padT + 10} fill="#6b7280" fontSize={9} textAnchor="end">{shot.club.toUpperCase()}</SvgText>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { backgroundColor: '#0c1445' },
});
