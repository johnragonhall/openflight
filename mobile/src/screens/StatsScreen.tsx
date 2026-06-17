import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnection } from '../state/ConnectionContext';
import { StatsView } from '../components/StatsView';
import { FittingRecommendations } from '../components/FittingRecommendations';
import { BagOverview } from '../components/BagOverview';
import { TrendsView } from '../components/TrendsView';
import { CoachingView } from '../components/CoachingView';
import { ShotsTable } from '../components/ShotsTable';
import { computeStats, getUniqueClubs } from '../types/shot';
import { PressableScale } from '../components/PressableScale';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT, type TKey } from '../i18n/useT';

type SubTab = 'overview' | 'clubs' | 'trends' | 'coaching' | 'shots';

const SEGMENTS: { key: SubTab; tkey: TKey }[] = [
  { key: 'overview', tkey: 'statsTabHome' },
  { key: 'clubs', tkey: 'statsTabClubs' },
  { key: 'trends', tkey: 'statsTabTrends' },
  { key: 'coaching', tkey: 'statsTabCoaching' },
  { key: 'shots', tkey: 'statsTabShots' },
];

export function StatsScreen() {
  const { shots, clearSession } = useConnection();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [mode, setMode] = useState<SubTab>('overview');

  const clubs = useMemo(() => getUniqueClubs(shots), [shots]);
  const filteredShots = useMemo(
    () => (selectedClub ? shots.filter((s) => s.club === selectedClub) : shots),
    [shots, selectedClub],
  );
  const stats = useMemo(() => computeStats(filteredShots), [filteredShots]);
  const fittingClub = selectedClub ?? (clubs.length === 1 ? clubs[0] ?? null : null);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabStats')}</Text>
        {mode === 'overview' && shots.length > 0 && (
          <View style={styles.headerCountPill}>
            <Text style={styles.headerCountText}>{shots.length} {t('shotCount')}</Text>
          </View>
        )}
      </View>

      {/* Sub-view tabs (kiosk parity: Overview / Clubs / Trends) */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {SEGMENTS.map((seg) => (
            <PressableScale
              key={seg.key}
              style={[styles.segBtn, mode === seg.key && styles.segBtnActive]}
              onPress={() => setMode(seg.key)}
              scale={0.97}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === seg.key }}
              accessibilityLabel={t(seg.tkey)}
            >
              <Text
                style={[styles.segBtnText, mode === seg.key && styles.segBtnTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t(seg.tkey)}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>

      {/* Content */}
      {mode === 'overview' ? (
        shots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('statsNoShotsSession')}</Text>
            <Text style={styles.emptySub}>{t('statsHitBalls')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <StatsView
              shots={shots}
              stats={stats}
              selectedClub={selectedClub}
              onSelectClub={setSelectedClub}
              onClearSession={clearSession}
            />
            {fittingClub && (
              <View style={styles.fittingWrap}>
                <FittingRecommendations club={fittingClub} stats={stats} />
              </View>
            )}
            {!fittingClub && clubs.length > 1 && (
              <Text style={styles.fittingHint}>
                {t('fittingHintSelectClub')}
              </Text>
            )}
          </ScrollView>
        )
      ) : mode === 'clubs' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <BagOverview />
        </ScrollView>
      ) : mode === 'trends' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TrendsView />
        </ScrollView>
      ) : mode === 'coaching' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <CoachingView shots={shots} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <ShotsTable shots={shots} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { color: C.text, fontSize: scale(22), fontWeight: '800', letterSpacing: -0.5 },
  headerCountPill: {
    backgroundColor: C.s3,
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerCountText: { color: C.sub, fontSize: scale(12), fontWeight: '600' },
  segmentWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  segment: {
    flexDirection: 'row',
    backgroundColor: C.s2,
    borderRadius: R.md,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    minHeight: 44, // HIG minimum touch target
    justifyContent: 'center',
    borderRadius: R.sm,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: C.accentDim },
  segBtnText: { color: C.muted, fontSize: scale(13), fontWeight: '600' },
  segBtnTextActive: { color: C.accent },
  scroll: { paddingBottom: 40 },
  fittingWrap: { paddingHorizontal: 16 },
  fittingHint: {
    color: C.muted, fontSize: scale(12), textAlign: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: C.text, fontSize: scale(18), fontWeight: '700' },
  emptySub: { color: C.sub, fontSize: scale(14), textAlign: 'center', marginTop: 6 },
});
