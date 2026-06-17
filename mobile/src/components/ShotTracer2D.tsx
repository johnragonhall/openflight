import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText,
} from 'react-native-svg';
import type { Shot } from '../types/shot';
import { computeApexHeight, computeTrajectoryPoints } from '../utils/ballistics';
import { useUnitPreference } from '../state/useUnitPreference';
import { C } from '../theme';

// Animated SVG path — strokeDashoffset drives the draw-on animation
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props { shot: Shot; height?: number }

export const ShotTracer2D = React.memo(function ShotTracer2D({ shot, height = 168 }: Props) {
  const { width } = useWindowDimensions();
  const { unitSystem } = useUnitPreference();

  const W = width;
  const H = height;
  const PAD_L = 38;
  const PAD_R = 14;
  const PAD_T = 18;
  const PAD_B = 26;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const carry = Math.max(
    shot.carry_spin_adjusted ?? shot.estimated_carry_yards,
    1,
  );
  const apex = Math.max(
    shot.apex_height_yards ??
      computeApexHeight(shot.ball_speed_mph, shot.launch_angle_vertical, shot.spin_rpm) ??
      carry * 0.12,
    1,
  );

  const pts = useMemo(() => computeTrajectoryPoints(carry, apex), [carry, apex]);

  // Coordinate helpers — inline so useMemo can capture them
  const toX = (x: number) => PAD_L + (x / carry) * plotW;
  const toY = (y: number) => PAD_T + (1 - y / (apex * 1.18)) * plotH;
  const groundY = toY(0);

  // Build path string + compute arc length in one pass
  const { d, pathLength } = useMemo(() => {
    let len = 0;
    const path = pts.reduce((acc, p, i) => {
      const sx = toX(p.x).toFixed(1);
      const sy = toY(p.y).toFixed(1);
      if (i > 0) {
        const prev = pts[i - 1];
        const dx = toX(p.x) - toX(prev.x);
        const dy = toY(p.y) - toY(prev.y);
        len += Math.sqrt(dx * dx + dy * dy);
      }
      return acc + (i === 0 ? `M${sx},${sy}` : ` L${sx},${sy}`);
    }, '');
    return { d: path, pathLength: len };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, carry, apex, plotW, plotH]);

  // dashAnim: pathLength → 0  (hidden → fully drawn)
  const dashAnim = useRef(new Animated.Value(pathLength + 8)).current;
  const pathLenRef = useRef(pathLength);
  pathLenRef.current = pathLength;

  const shotId = shot.id ?? shot.timestamp;

  useEffect(() => {
    dashAnim.setValue(pathLenRef.current + 8);
    Animated.timing(dashAnim, {
      toValue: 0,
      duration: 940,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotId]);

  // Yards in metric → meters; otherwise rounded yards. Suffix added when `withUnit`.
  const isMetric = unitSystem === 'metric';
  const formatYards = (yards: number, withUnit: boolean): string => {
    const value = (isMetric ? yards * 0.9144 : yards).toFixed(0);
    if (!withUnit) return value;
    return value + (isMetric ? 'm' : 'yds');
  };

  const distLabel = formatYards(carry, true);
  const apexLabel = formatYards(apex, true);

  const yTicks = [apex * 0.5, apex].map((v) => ({
    val: v,
    label: formatYards(v, false),
  }));

  const dashArrayStr = `${pathLength + 8} ${pathLength + 8}`;

  return (
    <View style={styles.container}>
      <Svg width={W} height={H}>
        <Defs>
          {/* Sky gradient: deep indigo → near-black green-tinted */}
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#050b1a" />
            <Stop offset="55%"  stopColor="#07101e" />
            <Stop offset="100%" stopColor="#081510" />
          </LinearGradient>
        </Defs>

        {/* Sky fill */}
        <Path d={`M0,0 H${W} V${H} H0 Z`} fill="url(#sky)" />

        {/* Subtle altitude grid lines */}
        {yTicks.map(({ val }) => (
          <Line
            key={val}
            x1={PAD_L} y1={toY(val)}
            x2={W - PAD_R} y2={toY(val)}
            stroke="#0e2218"
            strokeWidth={1}
            strokeDasharray="4 6"
          />
        ))}

        {/* Ground stripe */}
        <Path
          d={`M${PAD_L},${groundY} H${W - PAD_R}`}
          stroke="#1a4d2e"
          strokeWidth={1.5}
        />
        <Path
          d={`M${PAD_L},${groundY} H${W - PAD_R}`}
          stroke="rgba(34,197,94,0.18)"
          strokeWidth={0.8}
        />

        {/* Y-axis tick labels */}
        {yTicks.map(({ val, label }) => (
          <React.Fragment key={val}>
            <Line
              x1={PAD_L - 1} y1={toY(val)}
              x2={PAD_L + 5} y2={toY(val)}
              stroke="#1e4d36"
              strokeWidth={1}
            />
            <SvgText
              x={PAD_L - 4} y={toY(val) + 3.5}
              fill="#2d6648"
              fontSize={8}
              textAnchor="end"
              fontWeight="600"
            >{label}</SvgText>
          </React.Fragment>
        ))}

        {/* === Animated trajectory (3 glow layers + main line) === */}

        {/* Outer glow — widest, most transparent */}
        <AnimatedPath
          d={d}
          stroke="rgba(34,197,94,0.07)"
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dashArrayStr}
          strokeDashoffset={dashAnim}
        />
        {/* Mid glow */}
        <AnimatedPath
          d={d}
          stroke="rgba(34,197,94,0.16)"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dashArrayStr}
          strokeDashoffset={dashAnim}
        />
        {/* Main line */}
        <AnimatedPath
          d={d}
          stroke={C.accent}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dashArrayStr}
          strokeDashoffset={dashAnim}
        />

        {/* Apex marker */}
        <Circle
          cx={toX(carry / 2)}
          cy={toY(apex)}
          r={2.5}
          fill={C.accent}
          fillOpacity={0.7}
        />
        <SvgText
          x={toX(carry / 2)}
          y={toY(apex) - 7}
          fill={C.accentBright}
          fontSize={8.5}
          textAnchor="middle"
          fontWeight="700"
        >{apexLabel}</SvgText>

        {/* Tee marker */}
        <Circle cx={toX(0)} cy={groundY} r={2.5} fill="#334155" />
        <SvgText
          x={toX(0)}
          y={groundY + 14}
          fill="#475569"
          fontSize={8}
          textAnchor="middle"
        >tee</SvgText>

        {/* Landing marker */}
        <Circle cx={toX(carry)} cy={groundY} r={4.5} fill="#f59e0b" />
        <Circle cx={toX(carry)} cy={groundY} r={7} fill="rgba(245,158,11,0.15)" />
        <SvgText
          x={toX(carry)}
          y={groundY + 15}
          fill="#f59e0b"
          fontSize={9}
          textAnchor="middle"
          fontWeight="700"
        >{distLabel}</SvgText>

        {/* Club label — top-right corner */}
        <SvgText
          x={W - PAD_R}
          y={PAD_T + 9}
          fill="#1e4d36"
          fontSize={10}
          textAnchor="end"
          fontWeight="700"
          letterSpacing={0.8}
        >{shot.club.toUpperCase()}</SvgText>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { backgroundColor: C.canvas2d, overflow: 'hidden' },
});
