import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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
import { C, R } from '../theme';

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

// Format a signed degree value with a leading '+' for positives (e.g. "+1.5", "-2.0").
function signedDegrees(value: number | null): string | null {
  if (value === null) return null;
  return (value >= 0 ? '+' : '') + value.toFixed(1);
}

export const ShotDisplay = React.memo(function ShotDisplay({ shot }: { shot: Shot }) {
  const { unitSystem } = useUnitPreference();

  const entryAnim = useRef(new Animated.Value(0)).current;
  const prevIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentId = shot.id ?? shot.timestamp;
    if (prevIdRef.current !== currentId) {
      prevIdRef.current = currentId;
      entryAnim.setValue(0);
      Animated.spring(entryAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 2,
      }).start();
    }
  }, [shot.id, shot.timestamp, entryAnim]);

  const translateY = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const carry = shot.carry_spin_adjusted ?? shot.estimated_carry_yards;
  const carrySubtext = shot.carry_spin_adjusted
    ? 'spin-adjusted'
    : formatCarryRange(shot.carry_range, unitSystem);

  const launchConf = getLaunchQuality(shot.launch_angle_confidence);
  const launchAngle =
    shot.launch_angle_vertical !== null
      ? shot.launch_angle_vertical.toFixed(1)
      : null;
  const hLaunch = signedDegrees(shot.launch_angle_horizontal);
  const clubPath = signedDegrees(shot.club_path_deg);
  const spinAxis = signedDegrees(shot.spin_axis_deg);
  const spin = shot.spin_rpm !== null ? Math.round(shot.spin_rpm).toLocaleString() : null;
  const clubSpeed = shot.club_speed_mph !== null
    ? formatSpeed(shot.club_speed_mph, unitSystem, 1)
    : null;

  return (
    <Animated.View style={[styles.container, { opacity: entryAnim, transform: [{ translateY }] }]}>
      <View style={styles.headerRow}>
        <View style={styles.clubPill}>
          <Text style={styles.club}>{shot.club.toUpperCase()}</Text>
        </View>
        <Text style={styles.timestamp}>
          {new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      <View style={styles.primaryRow}>
        <MetricCard
          label="Ball Speed"
          value={formatSpeed(shot.ball_speed_mph, unitSystem, 1)}
          unit={getSpeedUnit(unitSystem)}
          size="primary"
          flex={1}
          animateRawValue={shot.ball_speed_mph}
          animateFormatter={(v) => formatSpeed(v, unitSystem, 1)}
        />
        <MetricCard
          label="Carry"
          value={formatDistance(carry, unitSystem, 0)}
          unit={getDistanceUnit(unitSystem)}
          subtext={carrySubtext}
          size="primary"
          flex={1}
          animateRawValue={carry}
          animateFormatter={(v) => formatDistance(v, unitSystem, 0)}
        />
      </View>

      <View style={styles.secondaryGrid}>
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
        {spinAxis !== null && shot.spin_axis_deg !== null && (
          <MetricCard
            label="Spin Axis"
            value={spinAxis}
            unit="°"
            subtext={spinAxisLabel(shot.spin_axis_deg)}
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
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: 8, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  clubPill: {
    backgroundColor: C.accentSurface,
    borderWidth: 1,
    borderColor: C.accentMuted,
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  club: { color: C.accentBright, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  timestamp: { color: C.sub, fontSize: 12 },
  primaryRow: { flexDirection: 'row', marginBottom: 2 },
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
