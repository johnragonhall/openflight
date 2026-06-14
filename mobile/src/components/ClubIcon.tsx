import React from 'react';
import Svg, { Path, Line, Rect, Circle, G } from 'react-native-svg';
import type { ClubCategory } from '../types/bag';

interface Props {
  category: ClubCategory;
  size?: number;
  color?: string;
}

/**
 * Stylised golf club silhouette icon (face-on profile view).
 * Each category renders a distinct head shape — Driver has the largest
 * crown, irons/wedges render a thin blade with score lines,
 * putter is a flat mallet.
 */
export function ClubIcon({ category, size = 40, color = '#d4af37' }: Props) {
  const h = Math.round(size * 1.5);
  return (
    <Svg width={size} height={h} viewBox="0 0 40 60">
      <ClubShape category={category} color={color} />
    </Svg>
  );
}

function ClubShape({ category, color }: { category: ClubCategory; color: string }) {
  const shaftColor = color;
  const headFill = color;
  const highlight = 'rgba(255,255,255,0.18)';
  const scoreColor = 'rgba(0,0,0,0.28)';

  switch (category) {
    case 'driver':
      return (
        <G>
          {/* Shaft — angled slightly */}
          <Line
            x1={22} y1={3} x2={20} y2={22}
            stroke={shaftColor} strokeWidth={1.6} strokeLinecap="round"
          />
          {/* Hosel nub */}
          <Line
            x1={20} y1={22} x2={18} y2={27}
            stroke={shaftColor} strokeWidth={2.4} strokeLinecap="round"
          />
          {/* Large crowned head */}
          <Path
            d="M14 27 Q4 27 3 38 Q2 51 20 55 Q38 51 37 38 Q36 27 26 27 Z"
            fill={headFill}
          />
          {/* Crown highlight arc */}
          <Path
            d="M6 34 Q20 25 34 34"
            stroke={highlight} strokeWidth={1} fill="none"
          />
        </G>
      );

    case 'wood':
      return (
        <G>
          <Line
            x1={22} y1={3} x2={20} y2={24}
            stroke={shaftColor} strokeWidth={1.6} strokeLinecap="round"
          />
          <Line
            x1={20} y1={24} x2={18} y2={28}
            stroke={shaftColor} strokeWidth={2.2} strokeLinecap="round"
          />
          {/* Slightly smaller head than driver */}
          <Path
            d="M15 28 Q6 28 5 38 Q4 50 20 53 Q36 50 35 38 Q34 28 25 28 Z"
            fill={headFill}
          />
          <Path
            d="M8 34 Q20 27 32 34"
            stroke={highlight} strokeWidth={1} fill="none"
          />
        </G>
      );

    case 'hybrid':
      return (
        <G>
          <Line
            x1={22} y1={3} x2={20} y2={26}
            stroke={shaftColor} strokeWidth={1.6} strokeLinecap="round"
          />
          <Line
            x1={20} y1={26} x2={18} y2={30}
            stroke={shaftColor} strokeWidth={2} strokeLinecap="round"
          />
          {/* Compact head — between wood and iron */}
          <Path
            d="M15 30 Q7 30 6 39 Q5 49 20 52 Q35 49 34 39 Q33 30 25 30 Z"
            fill={headFill}
          />
          <Path
            d="M9 36 Q20 29 31 36"
            stroke={highlight} strokeWidth={0.9} fill="none"
          />
        </G>
      );

    case 'iron':
      return (
        <G>
          {/* Angled shaft toward heel */}
          <Line
            x1={27} y1={3} x2={24} y2={35}
            stroke={shaftColor} strokeWidth={1.6} strokeLinecap="round"
          />
          {/* Thin angled blade — wider at toe, narrow at heel top */}
          <Path
            d="M6 37 L28 34 L28 48 L6 51 Z"
            fill={headFill}
          />
          {/* Score lines on face */}
          <Line x1={8} y1={39} x2={26} y2={36.5} stroke={scoreColor} strokeWidth={0.7} />
          <Line x1={8} y1={41.5} x2={26} y2={39} stroke={scoreColor} strokeWidth={0.7} />
          <Line x1={8} y1={44} x2={26} y2={41.5} stroke={scoreColor} strokeWidth={0.7} />
          <Line x1={8} y1={46.5} x2={26} y2={44} stroke={scoreColor} strokeWidth={0.7} />
          {/* Leading edge highlight */}
          <Path
            d="M6 37 L28 34"
            stroke={highlight} strokeWidth={0.8} fill="none"
          />
        </G>
      );

    case 'wedge':
      return (
        <G>
          <Line
            x1={25} y1={3} x2={22} y2={35}
            stroke={shaftColor} strokeWidth={1.6} strokeLinecap="round"
          />
          {/* Wider sole / more bounce than iron */}
          <Path
            d="M4 37 L26 33 L26 53 L4 56 Z"
            fill={headFill}
          />
          {/* Score lines */}
          <Line x1={6} y1={39} x2={24} y2={35.8} stroke={scoreColor} strokeWidth={0.7} />
          <Line x1={6} y1={41.8} x2={24} y2={38.6} stroke={scoreColor} strokeWidth={0.7} />
          <Line x1={6} y1={44.6} x2={24} y2={41.4} stroke={scoreColor} strokeWidth={0.7} />
          <Line x1={6} y1={47.4} x2={24} y2={44.2} stroke={scoreColor} strokeWidth={0.7} />
          <Line x1={6} y1={50.2} x2={24} y2={47} stroke={scoreColor} strokeWidth={0.7} />
          <Path
            d="M4 37 L26 33"
            stroke={highlight} strokeWidth={0.8} fill="none"
          />
        </G>
      );

    case 'putter':
      return (
        <G>
          {/* Near-vertical shaft */}
          <Line
            x1={19} y1={3} x2={21} y2={36}
            stroke={shaftColor} strokeWidth={1.6} strokeLinecap="round"
          />
          {/* Mallet head */}
          <Rect x={3} y={36} width={34} height={15} rx={2.5} fill={headFill} />
          {/* Top-line cavity */}
          <Path
            d="M5 43 L35 43"
            stroke={scoreColor} strokeWidth={0.9} fill="none"
          />
          {/* Alignment sight dot */}
          <Circle cx={20} cy={50} r={2} fill={scoreColor} />
          {/* Face highlight */}
          <Path
            d="M3 38 L37 38"
            stroke={highlight} strokeWidth={0.8} fill="none"
          />
        </G>
      );
  }
}
