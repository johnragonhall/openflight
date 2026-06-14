import React, { type JSX } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import type { Shot } from '../types/shot';
import { computeApexHeight, computeTrajectoryPoints } from '../utils/ballistics';
import { useUnitPreference } from '../state/useUnitPreference';
import { C } from '../theme';

interface Props { shot: Shot; height?: number }

// Camera parameters for perspective projection
const CAM_Y = 8;
const CAM_Z = -35;
const FOCAL = 55;

function project(
  wx: number, wy: number, wz: number, W: number, H: number,
): { px: number; py: number; scale: number } {
  const dz = wz - CAM_Z;
  const scale = FOCAL / Math.max(dz, 1);
  const px = W / 2 + wx * scale * (W / 90);
  const py = H * 0.65 - (wy - CAM_Y) * scale * (H / 55);
  return { px, py, scale };
}

export const ShotTracer3D = React.memo(function ShotTracer3D({ shot, height = 200 }: Props) {
  const { width } = useWindowDimensions();
  const { unitSystem } = useUnitPreference();
  const W = width;
  const H = height;

  const carry = Math.max(shot.carry_spin_adjusted ?? shot.estimated_carry_yards, 1);
  const apex = Math.max(
    shot.apex_height_yards
      ?? computeApexHeight(shot.ball_speed_mph, shot.launch_angle_vertical, shot.spin_rpm)
      ?? carry * 0.12,
    1,
  );
  const lateral = shot.launch_angle_horizontal !== null
    ? carry * Math.tan(shot.launch_angle_horizontal * Math.PI / 180)
    : 0;

  // Scale world units to scene (1 unit ≈ 10 yards)
  const sc = 0.1;
  const pts2d = computeTrajectoryPoints(carry, apex);

  // Project 3D trajectory: x = lateral deviation, y = height, z = carry distance
  const screenPts = pts2d.map((p, i) => {
    const t = i / (pts2d.length - 1);
    const wx = lateral * sc * t;
    const wy = p.y * sc;
    const wz = p.x * sc;
    return project(wx, wy, wz, W, H);
  });

  const pathD = screenPts.reduce(
    (acc, p, i) => acc + (i === 0 ? `M${p.px.toFixed(1)},${p.py.toFixed(1)}` : ` L${p.px.toFixed(1)},${p.py.toFixed(1)}`),
    '',
  );

  // Ground grid lines (Z = 0 plane)
  const gridLines: JSX.Element[] = [];
  for (let gz = 0; gz <= carry * sc; gz += 1.5) {
    const left = project(-4, 0, gz, W, H);
    const right = project(4, 0, gz, W, H);
    gridLines.push(
      <Line key={`hz${gz}`} x1={left.px} y1={left.py} x2={right.px} y2={right.py} stroke="#1a3a1a" strokeWidth={0.5} />,
    );
  }
  for (let gx = -3; gx <= 3; gx += 1.5) {
    const near = project(gx, 0, 0, W, H);
    const far = project(gx, 0, carry * sc, W, H);
    gridLines.push(
      <Line key={`vx${gx}`} x1={near.px} y1={near.py} x2={far.px} y2={far.py} stroke="#1a3a1a" strokeWidth={0.5} />,
    );
  }

  const groundY = project(0, 0, 0, W, H).py;
  const landing = project(lateral * sc, 0, carry * sc, W, H);
  const tee = project(0, 0, 0, W, H);
  const apexPt = project(lateral * sc * 0.5, apex * sc, carry * sc * 0.5, W, H);

  const distLabel = unitSystem === 'metric' ? `${(carry * 0.9144).toFixed(0)}m` : `${carry.toFixed(0)}yds`;

  return (
    <View style={styles.container}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="sky3d" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#060d25" />
            <Stop offset="60%" stopColor="#0c1a35" />
            <Stop offset="100%" stopColor="#0d2218" />
          </LinearGradient>
          <LinearGradient id="ground3d" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#1a1810" />
            <Stop offset="100%" stopColor="#0e0c08" />
          </LinearGradient>
        </Defs>
        {/* Sky */}
        <Path d={`M0,0 H${W} V${groundY} H0 Z`} fill="url(#sky3d)" />
        {/* Ground */}
        <Path d={`M0,${groundY} H${W} V${H} H0 Z`} fill="url(#ground3d)" />

        {/* Grid */}
        {gridLines}

        {/* Shadow on ground */}
        {screenPts.map((p, i) => {
          const g = project(
            lateral * sc * (i / (screenPts.length - 1)),
            0,
            pts2d[i]!.x * sc,
            W, H,
          );
          return i % 3 === 0 ? (
            <Circle key={i} cx={g.px} cy={g.py} r={1.5} fill="rgba(0,0,0,0.3)" />
          ) : null;
        })}

        {/* Trajectory glow */}
        <Path d={pathD} stroke="rgba(212,175,55,0.2)" strokeWidth={8} fill="none" />
        {/* Trajectory */}
        <Path d={pathD} stroke={C.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {/* Tee */}
        <Circle cx={tee.px} cy={tee.py} r={4} fill="#9ca3af" />

        {/* Apex */}
        <Circle cx={apexPt.px} cy={apexPt.py} r={3} fill={C.accent} />

        {/* Landing */}
        <Circle cx={landing.px} cy={landing.py} r={5} fill="#f59e0b" />
        <SvgText x={landing.px} y={landing.py - 8} fill="#f59e0b" fontSize={10} textAnchor="middle" fontWeight="bold">
          {distLabel}
        </SvgText>

        {/* Club label */}
        <SvgText x={W - 10} y={16} fill="#4b5563" fontSize={10} textAnchor="end">{shot.club.toUpperCase()} · 3D</SvgText>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { backgroundColor: C.canvas3d },
});
