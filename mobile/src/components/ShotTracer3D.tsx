import React, { type JSX, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { Shot } from '../types/shot';
import { computeApexHeight, computeTrajectoryPoints } from '../utils/ballistics';
import { launchFromShot, simulateTrajectory } from '../utils/trajectory';
import { useUnitPreference } from '../state/useUnitPreference';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useThemeColors, type Palette } from '../state/useThemeColors';

// Animated SVG path - strokeDashoffset drives the draw-on sweep.
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Cinematic flight draw: ~1.2s with a strong ease-out so the trace leaves the
// tee fast and settles into the landing (matches the ball decelerating).
const TRACE_DURATION_MS = 1200;
const TRACE_EASING = Easing.bezier(0.23, 1, 0.32, 1);

interface Props { shot: Shot; height?: number }

// Camera parameters for perspective projection. Larger FOCAL + taller canvas
// make the flight occupy more of the screen.
const CAM_Y = 8;
const CAM_Z = -35;
const FOCAL = 72;

function project(
  wx: number, wy: number, wz: number, W: number, H: number,
): { px: number; py: number; scale: number } {
  const dz = wz - CAM_Z;
  const scale = FOCAL / Math.max(dz, 1);
  const px = W / 2 + wx * scale * (W / 90);
  const py = H * 0.65 - (wy - CAM_Y) * scale * (H / 55);
  return { px, py, scale };
}

export const ShotTracer3D = React.memo(function ShotTracer3D({ shot, height = 280 }: Props) {
  const { width } = useWindowDimensions();
  const { distanceUnit } = useUnitPreference();
  const C = useThemeColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const W = width;
  const H = height;

  // Real flight path from on-device physics (RK4 drag + Magnus). Falls back to a
  // parabola + linear lateral drift when there is no vertical launch angle.
  const launch = launchFromShot(shot);
  const traj = launch ? simulateTrajectory(launch) : null;

  let worldPts: { d: number; lat: number; h: number }[];
  let carry: number;
  let lateral: number;

  if (traj) {
    worldPts = traj.points.map((p) => ({ d: p.x, lat: p.y, h: p.z }));
    carry = Math.max(traj.carryYards, 1);
    lateral = traj.lateralYards;
  } else {
    carry = Math.max(shot.carry_spin_adjusted ?? shot.estimated_carry_yards, 1);
    const apex = Math.max(
      shot.apex_height_yards
        ?? computeApexHeight(shot.ball_speed_mph, shot.launch_angle_vertical, shot.spin_rpm)
        ?? carry * 0.12,
      1,
    );
    lateral = shot.launch_angle_horizontal !== null
      ? carry * Math.tan((shot.launch_angle_horizontal * Math.PI) / 180)
      : 0;
    const pts2d = computeTrajectoryPoints(carry, apex);
    worldPts = pts2d.map((p, i) => ({
      d: p.x,
      lat: lateral * (i / (pts2d.length - 1)),
      h: p.y,
    }));
  }

  // Guard against a non-finite carry (would make the ground-grid `for` loop
  // below run forever) and cap absurd values.
  carry = Number.isFinite(carry) ? Math.min(Math.max(carry, 1), 1000) : 1;

  // Scale world units to scene (1 unit ≈ 10 yards)
  const sc = 0.1;

  // Project: screen x = lateral, screen y = height, depth = downrange
  const screenPts = worldPts.map((p) => project(p.lat * sc, p.h * sc, p.d * sc, W, H));

  const pathD = screenPts.reduce(
    (acc, p, i) => acc + (i === 0 ? `M${p.px.toFixed(1)},${p.py.toFixed(1)}` : ` L${p.px.toFixed(1)},${p.py.toFixed(1)}`),
    '',
  );

  // Total on-screen length of the trace, for the strokeDashoffset draw-on sweep.
  let pathLength = 0;
  for (let i = 1; i < screenPts.length; i++) {
    const dx = screenPts[i]!.px - screenPts[i - 1]!.px;
    const dy = screenPts[i]!.py - screenPts[i - 1]!.py;
    pathLength += Math.hypot(dx, dy);
  }
  const dashSpan = pathLength + 8;

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

  // Apex marker at the true max-height sample (not assumed mid-flight).
  let apexIdx = 0;
  for (let i = 1; i < worldPts.length; i++) {
    if (worldPts[i]!.h > worldPts[apexIdx]!.h) apexIdx = i;
  }
  const apexW = worldPts[apexIdx]!;
  const lastW = worldPts[worldPts.length - 1]!;

  const groundY = project(0, 0, 0, W, H).py;
  const landing = project(lastW.lat * sc, 0, lastW.d * sc, W, H);
  const tee = project(0, 0, 0, W, H);
  const apexPt = project(apexW.lat * sc, apexW.h * sc, apexW.d * sc, W, H);

  const distLabel = distanceUnit === 'meters' ? `${(carry * 0.9144).toFixed(0)}m` : `${carry.toFixed(0)}yds`;

  // Draw-on sweep: dashSpan (hidden) → 0 (fully drawn).
  const dashAnim = useRef(new Animated.Value(dashSpan)).current;
  const dashSpanRef = useRef(dashSpan);
  dashSpanRef.current = dashSpan;
  const shotId = shot.id ?? shot.timestamp;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      dashAnim.setValue(0);
      return;
    }
    dashAnim.setValue(dashSpanRef.current);
    Animated.timing(dashAnim, {
      toValue: 0,
      duration: TRACE_DURATION_MS,
      easing: TRACE_EASING,
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotId, reduceMotion]);

  const dashArrayStr = `${dashSpan} ${dashSpan}`;

  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
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
        {worldPts.map((p, i) => {
          const g = project(p.lat * sc, 0, p.d * sc, W, H);
          return i % 3 === 0 ? (
            <Circle key={i} cx={g.px} cy={g.py} r={1.5} fill="rgba(0,0,0,0.3)" />
          ) : null;
        })}

        {/* Trajectory glow */}
        <AnimatedPath
          d={pathD}
          stroke="rgba(212,175,55,0.2)"
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dashArrayStr}
          strokeDashoffset={dashAnim}
        />
        {/* Trajectory */}
        <AnimatedPath
          d={pathD}
          stroke={C.accent}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dashArrayStr}
          strokeDashoffset={dashAnim}
        />

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

const makeStyles = (C: Palette) => StyleSheet.create({
  container: { backgroundColor: C.canvas3d },
});
