import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import type { ClubSessionPoint } from '../types/shot';
import { getLifetimeStatsByClub, getClubSessionTrend } from '../db/database';
import { sortByBagOrder } from '../utils/shotShape';
import { TrendLineChart } from './TrendLineChart';
import { PressableScale } from './PressableScale';
import { formatClubName } from './ClubDetailSheet';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

/**
 * All-time per-club carry trend across recent sessions (kiosk Trends parity).
 * Club pills select which club's carry trend to chart.
 */
export function TrendsView() {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const { width } = useWindowDimensions();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);

  const [clubs, setClubs] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [trend, setTrend] = useState<ClubSessionPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLifetimeStatsByClub()
      .then((rows) => {
        if (cancelled) return;
        const ordered = sortByBagOrder(rows.map((r) => r.club));
        setClubs(ordered);
        setSelected((prev) => prev ?? ordered[0] ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    getClubSessionTrend(selected)
      .then((pts) => { if (!cancelled) setTrend(pts); })
      .catch(() => { if (!cancelled) setTrend([]); });
    return () => { cancelled = true; };
  }, [selected]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;
  }
  if (clubs.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>{t('trendNoHistory')}</Text>
        <Text style={s.emptySub}>{t('trendNoHistorySub')}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.label}>{t('trendCarryByClub')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pills}
        contentContainerStyle={s.pillsContent}
      >
        {clubs.map((club) => {
          const active = club === selected;
          return (
            <PressableScale
              key={club}
              style={[s.pill, active && s.pillActive]}
              onPress={() => setSelected(club)}
              scale={0.94}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={formatClubName(club)}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{formatClubName(club)}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <View style={s.chartCard}>
        {trend.length >= 2 ? (
          <TrendLineChart data={trend} width={width - 64} height={170} />
        ) : (
          <Text style={s.chartEmpty}>
            {t('trendNeedSessions', { club: selected ? formatClubName(selected) : 'this club' })}
          </Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  label: {
    color: C.muted, fontSize: scale(11), fontWeight: '700', letterSpacing: 1.0,
  },
  pills: { flexGrow: 0 },
  pillsContent: { gap: 8, paddingRight: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill,
    backgroundColor: C.s2, borderWidth: 1, borderColor: C.lineMid,
  },
  pillActive: { backgroundColor: C.accent, borderColor: C.accent },
  pillText: { color: C.sub, fontWeight: '600', fontSize: scale(13) },
  pillTextActive: { color: C.bg },
  chartCard: {
    backgroundColor: C.s1, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line, padding: 16, alignItems: 'center', justifyContent: 'center',
    minHeight: 200,
  },
  chartEmpty: { color: C.muted, fontSize: scale(13), textAlign: 'center', lineHeight: 18 },
  emptyTitle: { color: C.text, fontSize: scale(16), fontWeight: '700', textAlign: 'center' },
  emptySub: { color: C.sub, fontSize: scale(13), textAlign: 'center', lineHeight: 18 },
});
