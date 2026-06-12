import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Shot } from '../types/shot';
import { useUnitPreference } from '../state/useUnitPreference';
import {
  formatCarryRange,
  formatDistance,
  formatSpeed,
  getDistanceUnit,
  getSpeedUnit,
} from '../utils/units';
import { MetricCard } from './MetricCard';

function getLaunchQuality(confidence: number | null): 'high' | 'medium' | 'low' | null {
  if (confidence === null) return null;
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

function spinAxisLabel(deg: number): string {
  if (deg > 2) return 'fade';
  if (deg < -2) return 'draw';
  return 'straight';
}

export function ShotDisplay({ shot }: { shot: Shot }) {
  const { unitSystem } = useUnitPreference();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const carry = shot.carry_spin_adjusted ?? shot.estimated_carry_yards;
  const carrySubtext = shot.carry_spin_adjusted
    ? 'spin-adjusted'
    : formatCarryRange(shot.carry_range, unitSystem);

  const launchConf = getLaunchQuality(shot.launch_angle_confidence);
  const launchAngle =
    shot.launch_angle_vertical !== null
      ? shot.launch_angle_vertical.toFixed(1)
      : null;
  const hLaunch =
    shot.launch_angle_horizontal !== null
      ? (shot.launch_angle_horizontal >= 0 ? '+' : '') + shot.launch_angle_horizontal.toFixed(1)
      : null;
  const clubPath =
    shot.club_path_deg !== null
      ? (shot.club_path_deg >= 0 ? '+' : '') + shot.club_path_deg.toFixed(1)
      : null;
  const spinAxis =
    shot.spin_axis_deg !== null
      ? (shot.spin_axis_deg >= 0 ? '+' : '') + shot.spin_axis_deg.toFixed(1)
      : null;
  const spin = shot.spin_rpm !== null ? Math.round(shot.spin_rpm).toLocaleString() : null;
  const clubSpeed = shot.club_speed_mph !== null
    ? formatSpeed(shot.club_speed_mph, unitSystem, 1)
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.club}>{shot.club.toUpperCase()}</Text>
        <Text style={styles.timestamp}>
          {new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Primary — ball speed + carry always full width */}
      <View style={styles.primaryRow}>
        <MetricCard
          label="Ball Speed"
          value={formatSpeed(shot.ball_speed_mph, unitSystem, 1)}
          unit={getSpeedUnit(unitSystem)}
        />
        <MetricCard
          label="Carry"
          value={formatDistance(carry, unitSystem, 0)}
          unit={getDistanceUnit(unitSystem)}
          subtext={carrySubtext}
        />
      </View>

      {/* Secondary — wrap into 2-col grid, conditional cards appear when data present */}
      <View style={[styles.secondaryGrid, isLandscape && styles.secondaryGridLandscape]}>
        <MetricCard
          label="Club Speed"
          value={clubSpeed}
          unit={clubSpeed ? getSpeedUnit(unitSystem) : undefined}
          subtext={shot.smash_factor ? `${shot.smash_factor.toFixed(2)} smash` : undefined}
          dim={clubSpeed === null}
        />
        <MetricCard
          label="V. Launch"
          value={launchAngle}
          unit={launchAngle ? '°' : undefined}
          subtext={shot.angle_source ?? undefined}
          confidence={launchAngle ? launchConf : null}
          dim={launchAngle === null}
        />
        <MetricCard
          label="Spin"
          value={spin}
          unit={spin ? 'rpm' : undefined}
          confidence={spin ? shot.spin_quality : null}
          dim={spin === null}
        />
        {shot.club_angle_deg !== null && (
          <MetricCard
            label="Club AoA"
            value={shot.club_angle_deg.toFixed(1)}
            unit="°"
            subtext="radar"
          />
        )}
        {clubPath !== null && (
          <MetricCard label="Club Path" value={clubPath} unit="°" subtext="radar" />
        )}
        {spinAxis !== null && (
          <MetricCard
            label="Spin Axis"
            value={spinAxis}
            unit="°"
            subtext={spinAxisLabel(shot.spin_axis_deg!)}
          />
        )}
        {hLaunch !== null && (
          <MetricCard
            label="H. Launch"
            value={hLaunch}
            unit="°"
            subtext={shot.angle_source ?? undefined}
            confidence={launchConf}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 8, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  club: { color: '#22c55e', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  timestamp: { color: '#6b7280', fontSize: 12 },
  primaryRow: { flexDirection: 'row' },
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  secondaryGridLandscape: { flexDirection: 'row', flexWrap: 'wrap' },
});
