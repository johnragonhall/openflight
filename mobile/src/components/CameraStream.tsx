import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from '../theme';

interface Props {
  streamUrl: string;
  height?: number;
}

export function CameraStream({ streamUrl, height = 220 }: Props) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Allow only http/https URLs with a safe host:port/path — blocks javascript: and data: URIs.
  const VALID_STREAM_RE = /^https?:\/\/[\w.-]+(:\d{1,5})?(\/[\w.%/=?&+-]*)?$/;
  const validatedUrl = VALID_STREAM_RE.test(streamUrl.trim()) ? streamUrl.trim() : null;

  const html = validatedUrl
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>* { margin:0; padding:0; } body { background:#000; display:flex; align-items:center; justify-content:center; height:100vh; } img { max-width:100%; max-height:100vh; object-fit:contain; }</style></head><body><img src="${validatedUrl}" /></body></html>`
    : `<!DOCTYPE html><html><body style="background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><p style="color:#ef4444;font-family:sans-serif;text-align:center;padding:20px">Invalid stream URL</p></body></html>`;

  if (error) {
    return (
      <View style={[styles.errorBox, { height }]}>
        <Text style={styles.errorText}>Stream unavailable</Text>
        <Text style={styles.errorSub}>{streamUrl}</Text>
        <TouchableOpacity onPress={() => setError(false)} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={C.accent} />
        </View>
      )}
      <WebView
        style={{ flex: 1, backgroundColor: C.bg }}
        source={{ html }}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        scrollEnabled={false}
        javaScriptEnabled={false}
        originWhitelist={[]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: C.bg, overflow: 'hidden', borderRadius: 10 },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, zIndex: 1,
  },
  errorBox: {
    backgroundColor: C.bg, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  errorText: { color: C.err, fontSize: 14, fontWeight: '600' },
  errorSub: { color: C.muted, fontSize: 11 },
  retryBtn: { backgroundColor: C.s3, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: C.accent, fontWeight: '600' },
});
