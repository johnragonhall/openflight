import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import type { Shot } from '../types/shot';
import {
  computeStrikeQuality,
  buildDistanceProfiles,
  generateInsights,
  buildRootCause,
  suggestDrills,
  type StrikeQuality,
  type InsightPriority,
} from '../utils/analysis';
import { useUnitPreference } from '../state/useUnitPreference';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT, type TFunction } from '../i18n/useT';
import { R } from '../theme';

/**
 * Coaching analytics (kiosk StatsAnalysis parity), rendered HIG-native for phones:
 * Strike-Quality gauge, prioritised insights, a know-your-distances table, the
 * root-cause chain, and practice drills. All numbers come from the ported
 * `utils/analysis.ts` engine so the phone and kiosk agree.
 */
export function CoachingView({ shots }: { shots: Shot[] }) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const { distanceUnit } = useUnitPreference();
  const t = useT();
  const s = useMemo(() => makeStyles(C, scale), [C, scale]);

  const sq = useMemo(() => computeStrikeQuality(shots), [shots]);
  const profiles = useMemo(() => buildDistanceProfiles(shots, distanceUnit), [shots, distanceUnit]);
  const insights = useMemo(() => generateInsights(shots, distanceUnit, t), [shots, distanceUnit, t]);
  const rootCause = useMemo(() => buildRootCause(shots, t), [shots, t]);
  const drills = useMemo(() => suggestDrills(shots, t), [shots, t]);

  if (shots.length < 3) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>{t('analysisMinShots')}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {sq && <StrikeQualityCard sq={sq} C={C} s={s} t={t} />}

      {/* Insights */}
      <View style={s.card} accessible accessibilityLabel={t('insightsTitle')}>
        <Text style={s.cardTitle}>{t('insightsTitle')}</Text>
        {insights.length === 0 ? (
          <Text style={s.emptyNote}>{t('noInsights')}</Text>
        ) : (
          insights.slice(0, 3).map((ins) => (
            <View key={ins.id} style={s.insight}>
              <View style={[s.insightDot, { backgroundColor: priorityColor(ins.priority, C) }]} />
              <View style={s.insightBody}>
                <View style={s.insightMeta}>
                  <Text style={[s.insightPriority, { color: priorityColor(ins.priority, C) }]}>
                    {priorityLabel(ins.priority, t)}
                  </Text>
                  <Text style={s.insightCategory}>{t(ins.category as Parameters<TFunction>[0])}</Text>
                  {ins.opportunity ? <Text style={s.insightOpp}>{ins.opportunity}</Text> : null}
                </View>
                <Text style={s.insightHeadline}>{ins.headline}</Text>
                <Text style={s.insightDetail}>{ins.detail}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Know Your Distances */}
      {profiles.length >= 2 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('knowYourDistances')}</Text>
          <View style={s.dtHeader}>
            <Text style={[s.dtCell, s.dtClub, s.dtHeaderText]}>{t('clubLabel')}</Text>
            <Text style={[s.dtCell, s.dtHeaderText]}>{t('colAvg')}</Text>
            <Text style={[s.dtCell, s.dtHeaderText]}>±</Text>
            <Text style={[s.dtCell, s.dtHeaderText]}>{t('colReliable')}</Text>
            <Text style={[s.dtCell, s.dtHeaderText]}>{t('colCount')}</Text>
          </View>
          {profiles.map((p) => (
            <View
              key={p.club}
              style={s.dtRow}
              accessible
              accessibilityLabel={`${p.club.toUpperCase()}, ${t('colAvg')} ${p.avg}, ± ${p.sd}, ${t('colReliable')} ${p.reliable}, ${p.count} ${t('shotCount')}`}
            >
              <Text style={[s.dtCell, s.dtClub, s.dtClubText]}>{p.club.toUpperCase()}</Text>
              <Text style={[s.dtCell, s.dtPrimary]}>{p.avg}</Text>
              <Text style={s.dtCell}>±{p.sd}</Text>
              <Text style={s.dtCell}>{p.reliable}</Text>
              <Text style={s.dtCell}>{p.count}</Text>
            </View>
          ))}
          <Text style={s.dtNote}>
            {t('distanceTableNote')} {distanceUnit === 'meters' ? 'm' : 'yds'}
          </Text>
        </View>
      )}

      {/* Root cause chain */}
      {rootCause && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('rootCauseChain')}</Text>
          <View style={s.chain}>
            {rootCause.chain.map((node, i) => (
              <View key={i} style={s.causeNode}>
                <View style={s.causeMarkerCol}>
                  <View style={s.causeMarker} />
                  {i < rootCause.chain.length - 1 && <View style={s.causeConnector} />}
                </View>
                <View style={s.causeText}>
                  <Text style={s.causeLabel}>{node.label}</Text>
                  {node.sub ? <Text style={s.causeSub}>{node.sub}</Text> : null}
                </View>
              </View>
            ))}
          </View>
          <View style={s.causeFix}>
            <Text style={s.causeFixLabel}>{t('causeFix')}</Text>
            <Text style={s.causeFixText}>{rootCause.fix}</Text>
          </View>
        </View>
      )}

      {/* Practice drills */}
      {drills.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('practiceDrills')}</Text>
          {drills.map((drill) => (
            <View key={drill.number} style={s.drill} accessible accessibilityLabel={`${drill.title}. ${drill.description}`}>
              <View style={s.drillNum}>
                <Text style={s.drillNumText}>{drill.number}</Text>
              </View>
              <View style={s.drillBody}>
                <Text style={s.drillTitle}>{drill.title}</Text>
                <Text style={s.drillDesc}>{drill.description}</Text>
                <Text style={s.drillThought}>{drill.keyThought}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Strike-Quality gauge card ───────────────────────────────────────────────────

const GCX = 50, GCY = 52, GR = 38, START_DEG = 145, SWEEP = 250;

function polarToXY(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: GCX + GR * Math.cos(rad), y: GCY + GR * Math.sin(rad) };
}
function arcD(startDeg: number, endDeg: number): string {
  const a = polarToXY(startDeg);
  const b = polarToXY(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${GR} ${GR} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function StrikeQualityCard({
  sq, C, s, t,
}: { sq: StrikeQuality; C: Palette; s: Styles; t: TFunction }) {
  const color = scoreColor(sq.label, C);
  const fillEnd = START_DEG + (sq.score / 100) * SWEEP;
  const label =
    sq.label === 'Elite' ? t('scoreLabelElite') :
    sq.label === 'Solid' ? t('scoreLabelSolid') :
    sq.label === 'Developing' ? t('scoreLabelDeveloping') :
    t('scoreLabelOpportunity');

  return (
    <View style={s.card} accessible accessibilityLabel={`${t('strikeQuality')}: ${sq.score} / 100, ${label}`}>
      <Text style={s.cardTitle}>{t('strikeQuality')}</Text>
      <View style={s.gaugeWrap}>
        <Svg viewBox="0 0 100 80" width={140} height={112}>
          <Path d={arcD(START_DEG, START_DEG + SWEEP)} fill="none" stroke={C.s3} strokeWidth={7} strokeLinecap="round" />
          {sq.score > 1 && (
            <Path d={arcD(START_DEG, fillEnd)} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" />
          )}
          <SvgText x={GCX} y={GCY - 1} textAnchor="middle" fontSize={22} fontWeight="700" fill={color}>
            {sq.score}
          </SvgText>
          <SvgText x={GCX} y={GCY + 12} textAnchor="middle" fontSize={7} fill={C.muted}>/ 100</SvgText>
        </Svg>
        <Text style={[s.gaugeLabel, { color }]}>{label}</Text>
        {sq.distanceLostYds > 0 && (
          <Text style={s.gaugeUpside}>+{sq.distanceLostYds} {t('distancePotential')}</Text>
        )}
      </View>
      <View style={s.sqStats}>
        <View style={s.sqStat}>
          <Text style={s.sqStatVal}>{sq.smashAvg.toFixed(2)}</Text>
          <Text style={s.sqStatLbl}>{t('smashAvg')}</Text>
        </View>
        <View style={s.sqSep} />
        <View style={s.sqStat}>
          <Text style={s.sqStatVal}>{sq.smashTarget.toFixed(2)}</Text>
          <Text style={s.sqStatLbl}>{t('smashTarget')}</Text>
        </View>
        <View style={s.sqSep} />
        <View style={s.sqStat}>
          <Text style={s.sqStatVal}>{sq.consistencyPct}%</Text>
          <Text style={s.sqStatLbl}>{t('spreadCV')}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Color maps (mobile palette) ─────────────────────────────────────────────────

function priorityColor(p: InsightPriority, C: Palette): string {
  return p === 'high' ? C.err : p === 'medium' ? C.warn : C.ok;
}
function priorityLabel(p: InsightPriority, t: TFunction): string {
  return p === 'high' ? t('insightPriority') : p === 'medium' ? t('insightOpportunity') : t('insightGood');
}
function scoreColor(label: string, C: Palette): string {
  return label === 'Elite' ? C.accent : label === 'Solid' ? C.ok : label === 'Developing' ? C.warn : C.err;
}

// ── Styles ──────────────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: C.sub, fontSize: scale(14), textAlign: 'center' },

  card: {
    backgroundColor: C.s1,
    borderRadius: R.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: C.muted, fontSize: scale(11), fontWeight: '700', letterSpacing: 1.0 },
  emptyNote: { color: C.sub, fontSize: scale(13) },

  // Strike quality
  gaugeWrap: { alignItems: 'center', gap: 2 },
  gaugeLabel: { fontSize: scale(15), fontWeight: '800', marginTop: -8 },
  gaugeUpside: { color: C.accent, fontSize: scale(12), fontWeight: '600' },
  sqStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  sqStat: { alignItems: 'center', gap: 2, flex: 1 },
  sqStatVal: { color: C.text, fontSize: scale(16), fontWeight: '700' },
  sqStatLbl: { color: C.muted, fontSize: scale(10) },
  sqSep: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: C.line },

  // Insights
  insight: { flexDirection: 'row', gap: 10 },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  insightBody: { flex: 1, gap: 3 },
  insightMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  insightPriority: { fontSize: scale(10), fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  insightCategory: { color: C.muted, fontSize: scale(10) },
  insightOpp: { color: C.accent, fontSize: scale(10), fontWeight: '700' },
  insightHeadline: { color: C.text, fontSize: scale(14), fontWeight: '700' },
  insightDetail: { color: C.sub, fontSize: scale(12), lineHeight: 17 },

  // Distance table
  dtHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  dtRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  dtCell: { flex: 1, color: C.sub, fontSize: scale(12), textAlign: 'right', fontVariant: ['tabular-nums' as const] },
  dtClub: { flex: 1.3, textAlign: 'left' },
  dtClubText: { color: C.text, fontWeight: '700' },
  dtPrimary: { color: C.text, fontWeight: '700' },
  dtHeaderText: { color: C.muted, fontSize: scale(10), fontWeight: '700' },
  dtNote: { color: C.muted, fontSize: scale(10), lineHeight: 14 },

  // Root cause chain
  chain: { gap: 0 },
  causeNode: { flexDirection: 'row', gap: 10 },
  causeMarkerCol: { alignItems: 'center', width: 12 },
  causeMarker: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginTop: 4 },
  causeConnector: { flex: 1, width: StyleSheet.hairlineWidth, backgroundColor: C.lineMid, marginVertical: 2 },
  causeText: { flex: 1, paddingBottom: 12 },
  causeLabel: { color: C.text, fontSize: scale(13), fontWeight: '600' },
  causeSub: { color: C.muted, fontSize: scale(11), marginTop: 1 },
  causeFix: {
    backgroundColor: C.accentSurface,
    borderRadius: R.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.accentMuted,
    padding: 10,
    gap: 2,
  },
  causeFixLabel: { color: C.accent, fontSize: scale(10), fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  causeFixText: { color: C.text, fontSize: scale(13), lineHeight: 18 },

  // Drills
  drill: { flexDirection: 'row', gap: 12 },
  drillNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  drillNumText: { color: C.accent, fontSize: scale(13), fontWeight: '800' },
  drillBody: { flex: 1, gap: 3 },
  drillTitle: { color: C.text, fontSize: scale(14), fontWeight: '700' },
  drillDesc: { color: C.sub, fontSize: scale(12), lineHeight: 17 },
  drillThought: { color: C.accent, fontSize: scale(12), fontStyle: 'italic' },
});
