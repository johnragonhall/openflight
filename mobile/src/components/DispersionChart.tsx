import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText, Ellipse } from 'react-native-svg';
import type { Shot } from '../types/shot';
import { useUnitPreference } from '../state/useUnitPreference';

interface Point { x: number; y: number; club: string; isMishit: boolean }

const CLUB_COLORS: Record<string, string> = {
  driver: '#22c55e', '3-wood': '#16a34a', '5-wood': '#15803d',
  hybrid: '#0ea5e9', default: '#f59e0b',
};

function clubColor(club: string): string {
  return CLUB_COLORS[club] ?? CLUB_COLORS.default;
}

interface Props {
  shots: Shot[];
  selectedClub?: string | null;
}

export function DispersionChart({ shots, selectedClub }: Props) {
  const { width } = useWindowDimensions();
  const { unitSystem } = useUnitPreference();
  const W = width - 32;
  const H = 220;
  const padX = 36;
  const padY = 20;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;

  const filtered = useMemo(
    () => selectedClub ? shots.filter((s) => s.club === selectedClub) : shots,
    [shots, selectedClub],
  );

  const points = useMemo<Point[]>(() => {
    return filtered.map((s) => {
      const carry = s.carry_spin_adjusted ?? s.estimated_carry_yards;
      const lateral = s.launch_angle_horizontal !== null
        ? carry * Math.tan(s.launch_angle_horizontal * Math.PI / 180)
        : 0;
      return { x: lateral, y: carry, club: s.club, isMishit: s.is_mishit ?? false };
    });
  }, [filtered]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { width: W, height: H }]}>
        <Text style={styles.emptyText}>No shots to display</Text>
      </View>
    );
  }

  const ys = points.map((p) => p.y);
  const xs = points.map((p) => p.x);
  const maxY = Math.max(...ys) * 1.15;
  const minY = Math.min(0, Math.min(...ys) * 0.9);
  const maxX = Math.max(20, Math.max(...xs.map(Math.abs)) * 1.3);
  const unit = unitSystem === 'metric' ? 'm' : 'yds';
  const scale = unitSystem === 'metric' ? 0.9144 : 1;

  const toSvgX = (val: number) => padX + ((val + maxX) / (maxX * 2)) * plotW;
  const toSvgY = (val: number) => padY + (1 - (val - minY) / (maxY - minY)) * plotH;

  const centerX = toSvgX(0);

  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const stdX = Math.sqrt(xs.map((v) => (v - meanX) ** 2).reduce((a, b) => a + b, 0) / xs.length);
  const stdY = Math.sqrt(ys.map((v) => (v - meanY) ** 2).reduce((a, b) => a + b, 0) / ys.length);

  const ellipseRx = (stdX * 1.65 / (maxX * 2)) * plotW;
  const ellipseRy = (stdY * 1.65 / (maxY - minY)) * plotH;

  const yTicks = [
    Math.round(minY + (maxY - minY) * 0.25),
    Math.round(minY + (maxY - minY) * 0.5),
    Math.round(minY + (maxY - minY) * 0.75),
    Math.round(maxY),
  ];

  return (
    <View>
      <Svg width={W} height={H}>
        {/* Center line */}
        <Line x1={centerX} y1={padY} x2={centerX} y2={H - padY} stroke="#1f2937" strokeWidth={1} strokeDasharray="4 3" />
        {/* Y ticks */}
        {yTicks.map((v) => (
          <G key={v}>
            <Line x1={padX} y1={toSvgY(v)} x2={W - padX} y2={toSvgY(v)} stroke="#1f2937" strokeWidth={0.5} />
            <SvgText x={padX - 4} y={toSvgY(v) + 4} fill="#6b7280" fontSize={9} textAnchor="end">
              {Math.round(v * scale)}{unit}
            </SvgText>
          </G>
        ))}
        {/* 80% ellipse */}
        {points.length > 2 && (
          <Ellipse
            cx={toSvgX(meanX)} cy={toSvgY(meanY)}
            rx={ellipseRx} ry={ellipseRy}
            fill="rgba(34,197,94,0.06)" stroke="#22c55e" strokeWidth={1} strokeDasharray="5 4"
          />
        )}
        {/* Points */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={toSvgX(p.x)} cy={toSvgY(p.y)}
            r={5} fill={clubColor(p.club)}
            opacity={p.isMishit ? 0.4 : 0.85}
            stroke={p.isMishit ? '#ef4444' : 'none'} strokeWidth={1.5}
          />
        ))}
        {/* Axis labels */}
        <SvgText x={W / 2} y={H - 2} fill="#6b7280" fontSize={9} textAnchor="middle">← left · right →</SvgText>
      </Svg>
      <Text style={styles.legend}>{points.length} shots · 80% ellipse · red ring = mishit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  emptyText: { color: '#6b7280', fontSize: 13 },
  legend: { color: '#4b5563', fontSize: 10, textAlign: 'center', marginTop: 2 },
});
