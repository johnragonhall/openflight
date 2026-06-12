import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSessions, type SessionRow } from '../db/database';
import type { RootStackParamList } from '../types/navigation';

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
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function HistoryScreen() {
  const nav = useNavigation<NavProp>();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    try {
      setSessions(getSessions());
    } catch {
      // DB not ready yet; ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#22c55e" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (sessions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Hit some balls to start tracking history</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSub}>{sessions.length} sessions</Text>
      </View>
      <FlatList<SessionRow>
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => nav.navigate('SessionDetail', {
              sessionId: item.id,
              label: `${formatDate(item.started_at)} ${formatTime(item.started_at)}`,
            })}
          >
            <View>
              <Text style={styles.rowDate}>{formatDate(item.started_at)}</Text>
              <Text style={styles.rowTime}>
                {formatTime(item.started_at)} · {duration(item)} · {item.connection_type.toUpperCase()}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowShots}>{item.shot_count}</Text>
              <Text style={styles.rowShotsLabel}>shots</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  list: { paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 6 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  rowDate: { color: '#fff', fontWeight: '600', fontSize: 15 },
  rowTime: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowShots: { color: '#22c55e', fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums' as const] },
  rowShotsLabel: { color: '#6b7280', fontSize: 11 },
});
