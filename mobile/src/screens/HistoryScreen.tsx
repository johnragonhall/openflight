import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSessions, type SessionRow } from '../db/database';
import type { RootStackParamList } from '../types/navigation';
import { PressableScale } from '../components/PressableScale';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';
import { logger } from '../utils/logger';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function duration(row: SessionRow): string {
  if (!row.ended_at) return 'active';
  const ms = new Date(row.ended_at).getTime() - new Date(row.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function HistoryScreen() {
  const nav = useNavigation<NavProp>();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getSessions()
      .then(setSessions)
      .catch((err) => logger.error('Failed to load sessions:', err))
      .finally(() => setLoading(false));
  }, []);

  // Reload whenever the tab regains focus so newly recorded sessions and
  // updated shot counts appear without an app restart.
  useFocusEffect(load);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (sessions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('tabHistory')}</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('historyEmpty')}</Text>
          <Text style={styles.emptySub}>{t('historyEmptySub')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabHistory')}</Text>
        <View style={styles.headerCountPill}>
          <Text style={styles.headerCountText}>{sessions.length}</Text>
        </View>
      </View>
      <FlatList<SessionRow>
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PressableScale
            style={styles.row}
            onPress={() => nav.navigate('SessionDetail', {
              sessionId: item.id,
              label: `${formatDate(item.started_at)} ${formatTime(item.started_at)}`,
            })}
            scale={0.985}
            accessibilityRole="button"
            accessibilityLabel={`${formatDate(item.started_at)} ${formatTime(item.started_at)}, ${duration(item)}, ${item.connection_type.toUpperCase()}, ${item.shot_count} ${t('shotCount')}`}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowDate}>{formatDate(item.started_at)}</Text>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTime}>{formatTime(item.started_at)}</Text>
                <View style={styles.dot} />
                <Text style={styles.rowTime}>{duration(item)}</Text>
                <View style={styles.dot} />
                <View style={styles.connPill}>
                  <Text style={styles.connPillText}>{item.connection_type.toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowShots}>{item.shot_count}</Text>
              <Text style={styles.rowShotsLabel}>{t('shotCount')}</Text>
            </View>
          </PressableScale>
        )}
      />
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

  list: { padding: 12, gap: 6, paddingBottom: 40 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: C.text, fontSize: scale(18), fontWeight: '700' },
  emptySub: { color: C.sub, fontSize: scale(14), textAlign: 'center', marginTop: 6 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.s1,
    borderRadius: R.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  rowMain: { gap: 6 },
  rowDate: { color: C.text, fontWeight: '600', fontSize: scale(15) },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTime: { color: C.sub, fontSize: scale(12) },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.muted },
  connPill: {
    backgroundColor: C.s3,
    borderRadius: R.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  connPillText: { color: C.muted, fontSize: scale(9), fontWeight: '700', letterSpacing: 0.5 },
  rowRight: { alignItems: 'flex-end' },
  rowShots: {
    color: C.accent,
    fontSize: scale(24),
    fontWeight: '700',
    fontVariant: ['tabular-nums' as const],
    lineHeight: 28,
  },
  rowShotsLabel: { color: C.sub, fontSize: scale(10) },
});
