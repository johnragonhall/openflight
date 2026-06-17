import React, { useEffect, useMemo, useRef } from 'react';
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
import { ShotQualityRow } from './ShotQualityRow';
import { MetricCard } from './MetricCard';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT, type TFunction } from '../i18n/useT';

function getLaunchQuality(confidence: number | null): 'high' | 'medium' | 'low' | null {
  if (confidence === null) return null;
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

function spinAxisLabel(deg: number, t: TFunction): string {
  if (deg > 2) return t('slightFade');
  if (deg < -2) return t('slightDraw');
  return t('straight');
}

// Format a signed degree value with a leading '+' for positives (e.g. "+1.5", "-2.0").
function signedDegrees(value: number | null): string | null {
  if (value === null) return null;
  return (value >= 0 ? '+' : '') + value.toFixed(1);
}

export const ShotDisplay = React.memo(function ShotDisplay({ shot }: { shot: Shot }) {
  const { speedUnit, distanceUnit } = useUnitPreference();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);

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
    ? t('spinAdj')
    : shot.carry_range
      ? formatCarryRange(shot.carry_range, distanceUnit)
      : undefined;

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
    ? formatSpeed(shot.club_speed_mph, speedUnit, 1)
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
          label={t('ballSpeed')}
          value={formatSpeed(shot.ball_speed_mph, speedUnit, 1)}
          unit={getSpeedUnit(speedUnit)}
          size="primary"
          flex={1}
          animateRawValue={shot.ball_speed_mph}
          animateFormatter={(v) => formatSpeed(v, speedUnit, 1)}
        />
        <MetricCard
          label={t('estCarry')}
          value={formatDistance(carry, distanceUnit, 0)}
          unit={getDistanceUnit(distanceUnit)}
          subtext={carrySubtext}
          size="primary"
          flex={1}
          animateRawValue={carry}
          animateFormatter={(v) => formatDistance(v, distanceUnit, 0)}
        />
      </View>

      <View style={styles.secondaryGrid}>
        <MetricCard
          label={t('clubSpeed')}
          value={clubSpeed}
          unit={clubSpeed ? getSpeedUnit(speedUnit) : undefined}
          subtext={shot.smash_factor ? `${shot.smash_factor.toFixed(2)} ${t('smash')}` : undefined}
          dim={clubSpeed === null}
        />
        <MetricCard
          label={t('vLaunch')}
          value={launchAngle}
          unit={launchAngle ? '°' : undefined}
          subtext={shot.angle_source ?? undefined}
          confidence={launchAngle ? launchConf : null}
          dim={launchAngle === null}
        />
        <MetricCard
          label={t('spinRate')}
          value={spin}
          unit={spin ? 'rpm' : undefined}
          confidence={spin ? shot.spin_quality : null}
          dim={spin === null}
        />
        {shot.club_angle_deg !== null && (
          <MetricCard
            label={t('clubAoA')}
            value={shot.club_angle_deg.toFixed(1)}
            unit="°"
            subtext={t('radar')}
          />
        )}
        {clubPath !== null && (
          <MetricCard label={t('clubPath')} value={clubPath} unit="°" subtext={t('radar')} />
        )}
        {spinAxis !== null && shot.spin_axis_deg !== null && (
          <MetricCard
            label={t('spinAxis')}
            value={spinAxis}
            unit="°"
            subtext={spinAxisLabel(shot.spin_axis_deg, t)}
          />
        )}
        {hLaunch !== null && (
          <MetricCard
            label={t('hLaunch')}
            value={hLaunch}
            unit="°"
            subtext={shot.angle_source ?? undefined}
            confidence={launchConf}
          />
        )}
      </View>

      {/* Kiosk-parity Low/Perfect/High + Left/Perfect/Right quality chips */}
      <ShotQualityRow shot={shot} />
    </Animated.View>
  );
});

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
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
  club: { color: C.accent, fontSize: scale(12), fontWeight: '700', letterSpacing: 1 },
  timestamp: { color: C.sub, fontSize: scale(12) },
  primaryRow: { flexDirection: 'row', marginBottom: 2 },
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
