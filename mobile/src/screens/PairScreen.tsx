import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { BLE_PAIRING_SECRET_KEY } from '../hooks/useBLEConnection';
import { useT } from '../i18n/useT';
import { C } from '../theme';

// expo-camera CameraView provides built-in barcode scanning (Expo SDK 50+).
// Import lazily so the module is only resolved on devices that have it.
let CameraView: React.ComponentType<{
  style?: object;
  facing?: 'front' | 'back';
  onBarcodeScanned?: (event: { type: string; data: string }) => void;
}> | null = null;
let useCameraPermissions: (() => [{ granted: boolean } | null, () => Promise<void>]) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {
  // expo-camera not installed - show error state below
}

// QR payload from the kiosk: { v: 1, s: "<64-char hex secret>", h: "<ip>", p: <port> }
interface PairPayload {
  v: number;
  s: string;
  h: string;
  p: number;
}

function isPairPayload(obj: unknown): obj is PairPayload {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.s === 'string' &&
    /^[0-9a-f]{64}$/.test(o.s) &&
    typeof o.h === 'string' &&
    typeof o.p === 'number'
  );
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Pair'>;

interface PairScreenProps {
  navigation: Nav;
}

export function PairScreen({ navigation }: PairScreenProps) {
  const t = useT();
  const scanned = useRef(false);
  const [status, setStatus] = useState<'scanning' | 'success' | 'error' | 'no-camera'>(
    () => CameraView ? 'scanning' : 'no-camera',
  );
  const [errorMsg, setErrorMsg] = useState('');

  // Camera permissions - use nullish coalescing so the call is unconditional
  // (react-hooks/rules-of-hooks forbids conditional hook calls)
  const cameraPermissionsHook = useCameraPermissions ?? (() => [null, async () => {}] as const);
  const [permission, requestPermission] = cameraPermissionsHook();

  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => navigation.goBack(), 1200);
    return () => clearTimeout(t);
  }, [status, navigation]);

  useEffect(() => {
    if (CameraView && permission !== null && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcode = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned.current) return;
      scanned.current = true;

      try {
        const payload: unknown = JSON.parse(data);
        if (!isPairPayload(payload)) {
          setErrorMsg(t('pairBadQr'));
          setStatus('error');
          return;
        }
        await SecureStore.setItemAsync(BLE_PAIRING_SECRET_KEY, payload.s);
        setStatus('success');
      } catch {
        setErrorMsg(t('pairReadError'));
        setStatus('error');
      }
    },
    [t],
  );

  const retry = useCallback(() => {
    scanned.current = false;
    setStatus('scanning');
    setErrorMsg('');
  }, []);

  if (status === 'no-camera') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>{t('pairUnavailable')}</Text>
        <Text style={styles.sub}>{t('pairInstallCamera')}</Text>
      </SafeAreaView>
    );
  }

  if (status === 'success') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.title}>{t('pairSuccess')}</Text>
        <Text style={styles.sub}>{t('pairSuccessSub')}</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>{t('pairFailed')}</Text>
        <Text style={styles.sub}>{errorMsg}</Text>
        <TouchableOpacity style={styles.btn} onPress={retry} accessibilityLabel={t('a11yTryPairAgain')}>
          <Text style={styles.btnText}>{t('pairTryAgain')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>{t('pairCameraNeeded')}</Text>
        <Text style={styles.sub}>{t('pairCameraNeededSub')}</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={requestPermission}
          accessibilityLabel={t('a11yAllowCamera')}
        >
          <Text style={styles.btnText}>{t('pairAllowCamera')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {CameraView && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handleBarcode}
        />
      )}
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>{t('pairScanTitle')}</Text>
        <View style={styles.reticle} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.overlayHint}>{t('pairOverlayHint')}</Text>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('a11yCancelPairing')}
        >
          <Text style={styles.cancelText}>{t('pairCancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sub: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  successIcon: { color: C.ok, fontSize: 56, fontWeight: '700' },
  btn: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  btnText: { color: C.bg, fontWeight: '700', fontSize: 16 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 48,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  reticle: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: C.accent,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  overlayHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
});
