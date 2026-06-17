import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

// Validate stream URL via URL parser - rejects javascript:/data: schemes, invalid ports (>65535),
// and malformed URLs. Hoisted outside the component (js-hoist-regexp / init-once).
function isValidStreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    // new URL() already rejects ports >65535, but guard against encoded quotes in the host
    if (/["'<>]/.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

interface Props {
  streamUrl: string;
  height?: number;
}

export function CameraStream({ streamUrl, height = 220 }: Props) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const validatedUrl = isValidStreamUrl(streamUrl.trim()) ? streamUrl.trim() : null;

  const html = validatedUrl
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>* { margin:0; padding:0; } body { background:#000; display:flex; align-items:center; justify-content:center; height:100vh; } img { max-width:100%; max-height:100vh; object-fit:contain; }</style></head><body><img src="${validatedUrl}" /></body></html>`
    : `<!DOCTYPE html><html><body style="background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><p style="color:#ef4444;font-family:sans-serif;text-align:center;padding:20px">${t('invalidStreamUrl')}</p></body></html>`;

  if (error) {
    return (
      <View style={[styles.errorBox, { height }]}>
        <Text style={styles.errorText}>{t('streamUnavailable')}</Text>
        <Text style={styles.errorSub}>{streamUrl}</Text>
        <TouchableOpacity onPress={() => setError(false)} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel={t('retry')}>
          <Text style={styles.retryText}>{t('retry')}</Text>
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

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { backgroundColor: C.bg, overflow: 'hidden', borderRadius: 10 },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, zIndex: 1,
  },
  errorBox: {
    backgroundColor: C.bg, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  errorText: { color: C.err, fontSize: scale(14), fontWeight: '600' },
  errorSub: { color: C.muted, fontSize: scale(11) },
  retryBtn: { backgroundColor: C.s3, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: C.accent, fontWeight: '600' },
});
