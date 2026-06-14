import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { ClubSessionPoint } from '../types/shot';
import { C } from '../theme';

interface Props {
  data: ClubSessionPoint[];
  width: number;
  height?: number;
}

const PAD = { top: 8, bottom: 20, left: 32, right: 8 };

export function TrendLineChart({ data, width, height = 100 }: Props) {
  const { points, minY, maxY, pathD } = useMemo(() => {
    if (data.length === 0) return { points: [], minY: 0, maxY: 0, pathD: '' };

    const carries = data.map((d) => d.avg_carry);
    const rawMin = Math.min(...carries);
    const rawMax = Math.max(...carries);
    // Add 10% padding to y range so the line isn't flush against edges
    const range = rawMax - rawMin || 10;
    const minY = Math.max(0, rawMin - range * 0.1);
    const maxY = rawMax + range * 0.1;

    const chartW = width - PAD.left - PAD.right;
    const chartH = height - PAD.top - PAD.bottom;

    const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const toY = (v: number) => PAD.top + chartH - ((v - minY) / (maxY - minY)) * chartH;

    const points = data.map((d, i) => ({ x: toX(i), y: toY(d.avg_carry), d }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return { points, minY, maxY, pathD };
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Not enough data</Text>
      </View>
    );
  }

  const yLabels = [minY, (minY + maxY) / 2, maxY].map((v) => Math.round(v));

  return (
    <Svg width={width} height={height}>
      {/* Y-axis labels */}
      {yLabels.map((v, i) => {
        const y = PAD.top + ((height - PAD.top - PAD.bottom) * (1 - i / 2));
        return (
          <SvgText key={v} x={PAD.left - 4} y={y + 4} textAnchor="end"
            fontSize={9} fill={C.muted}>{v}</SvgText>
        );
      })}
      {/* Grid lines */}
      {yLabels.map((_, i) => {
        const y = PAD.top + ((height - PAD.top - PAD.bottom) * (1 - i / 2));
        return (
          <Line key={i} x1={PAD.left} y1={y} x2={width - PAD.right} y2={y}
            stroke={C.line} strokeWidth={1} />
        );
      })}
      {/* Trend line */}
      <Path d={pathD} stroke={C.accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={C.accent} />
      ))}
      {/* X-axis: first + last session date */}
      {data.length > 0 && (
        <>
          <SvgText x={PAD.left} y={height - 4} textAnchor="start"
            fontSize={8} fill={C.muted}>{fmtDate(data[0].session_date)}</SvgText>
          <SvgText x={width - PAD.right} y={height - 4} textAnchor="end"
            fontSize={8} fill={C.muted}>{fmtDate(data[data.length - 1].session_date)}</SvgText>
        </>
      )}
    </Svg>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.muted, fontSize: 11 },
});
