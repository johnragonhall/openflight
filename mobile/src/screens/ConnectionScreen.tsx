import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Device } from 'react-native-ble-plx';
import { BLE_PAIRING_SECRET_KEY, type BLEConnectionState } from '../hooks/useBLEConnection';
import type { SocketConnectionState } from '../hooks/useSocketConnection';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useConnectionControls } from '../state/ConnectionControlsContext';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT, type TFunction } from '../i18n/useT';

const STORAGE_KEY = 'openflight.last-host';
const DEFAULT_HOST = '192.168.1.';

type Styles = ReturnType<typeof makeStyles>;

type ConnectionScreenProps = NativeStackScreenProps<RootStackParamList, 'Connection'>;

export function ConnectionScreen({ navigation }: ConnectionScreenProps) {
  const { wifi: socket, ble } = useConnectionControls();
  const C = useThemeColors();
  const { scale } = useFontScale();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  const t = useT();
  const [tab, setTab] = useState<'wifi' | 'ble'>('wifi');
  const [hostAndPort, setHostAndPort] = useState(DEFAULT_HOST);

  // Restore last-used address
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setHostAndPort(stored);
      })
      .catch(() => { /* use default */ });
  }, []);

  const handleConnect = () => {
    AsyncStorage.setItem(STORAGE_KEY, hostAndPort).catch(() => { /* silent */ });
    socket.connect(hostAndPort);
  };

  const inDemo = socket.mockMode && !socket.connected;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('connTitle')}</Text>

      <View style={styles.tabs}>
        {(['wifi', 'ble'] as const).map((tk) => (
          <TouchableOpacity
            key={tk}
            style={[styles.tab, tab === tk && styles.activeTab]}
            onPress={() => setTab(tk)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === tk }}
            accessibilityLabel={tk === 'wifi' ? t('connWifi') : t('connBluetooth')}
          >
            <Text style={[styles.tabText, tab === tk && styles.activeTabText]}>
              {tk === 'wifi' ? t('connWifi') : t('connBluetooth')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'wifi' ? (
        <WiFiPanel
          socket={socket}
          hostAndPort={hostAndPort}
          setHostAndPort={setHostAndPort}
          onConnect={handleConnect}
          styles={styles}
          C={C}
          t={t}
        />
      ) : (
        <BLEPanel ble={ble} onPair={() => navigation.navigate('Pair')} styles={styles} C={C} t={t} />
      )}

      <View style={styles.demoSection}>
        <View style={styles.divider} />
        {inDemo ? (
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={socket.stopDemo}
            accessibilityLabel={t('a11yStopDemo')}
          >
            <Text style={[styles.buttonText, { color: C.text }]}>{t('connStopDemo')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.demoButton}
            onPress={socket.startDemo}
            accessibilityLabel={t('a11yTryDemo')}
          >
            <Text style={styles.demoButtonText}>{t('connTryDemo')}</Text>
            <Text style={styles.demoHint}>{t('connDemoHint')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function WiFiPanel({
  socket,
  hostAndPort,
  setHostAndPort,
  onConnect,
  styles,
  C,
  t,
}: {
  socket: SocketConnectionState;
  hostAndPort: string;
  setHostAndPort: (v: string) => void;
  onConnect: () => void;
  styles: Styles;
  C: Palette;
  t: TFunction;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.hint}>{t('connHint')}</Text>
      <TextInput
        style={styles.input}
        value={hostAndPort}
        onChangeText={setHostAndPort}
        placeholder="192.168.1.42:8080"
        placeholderTextColor="#4b5563"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {socket.connected ? (
        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={socket.disconnect}
          accessibilityLabel={t('a11yDisconnectMonitor')}
        >
          <Text style={[styles.buttonText, { color: C.text }]}>{t('connDisconnect')}</Text>
        </TouchableOpacity>
      ) : socket.connecting ? (
        <View
          style={[styles.button, styles.activeButton]}
          accessibilityLabel={t('a11yConnectingMonitor')}
          accessibilityState={{ busy: true }}
        >
          <View style={styles.scanningRow}>
            <ActivityIndicator color="#0a0a0a" size="small" />
            <Text style={[styles.buttonText, { marginLeft: 8 }]}>{t('connConnecting')}</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={onConnect}
          accessibilityLabel={t('a11yConnectMonitor')}
        >
          <Text style={styles.buttonText}>{t('connConnect')}</Text>
        </TouchableOpacity>
      )}
      {socket.connected && (
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{t('connConnectedWifi')}</Text>
        </View>
      )}
      {!socket.connected && !socket.connecting && socket.errorMessage && (
        <Text style={styles.errorText}>{socket.errorMessage}</Text>
      )}
    </View>
  );
}

function BLEPanel({ ble, onPair, styles, C, t }: { ble: BLEConnectionState; onPair: () => void; styles: Styles; C: Palette; t: TFunction }) {
  const isScanning = ble.status === 'scanning';
  const isConnecting = ble.status === 'connecting';
  const isConnected = ble.status === 'connected';
  const [paired, setPaired] = useState<boolean | null>(null);

  const checkPaired = useCallback(() => {
    SecureStore.getItemAsync(BLE_PAIRING_SECRET_KEY)
      .then((v) => setPaired(v !== null))
      .catch(() => setPaired(false));
  }, []);

  useEffect(() => { checkPaired(); }, [checkPaired]);

  const unpair = useCallback(() => {
    SecureStore.deleteItemAsync(BLE_PAIRING_SECRET_KEY)
      .then(() => setPaired(false))
      .catch(() => {});
    if (isConnected) ble.disconnect();
  }, [ble, isConnected]);

  return (
    <View style={styles.panel}>
      {paired === null ? (
        <ActivityIndicator color={C.accent} />
      ) : paired ? (
        <View style={styles.pairedBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{t('blePaired')}</Text>
          <TouchableOpacity
            onPress={unpair}
            style={styles.unpairBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={t('a11yUnpairKiosk')}
          >
            <Text style={styles.unpairText}>{t('bleUnpair')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.hint}>{t('bleScanQrHint')}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={onPair}
            accessibilityLabel={t('a11yScanQrPair')}
          >
            <Text style={styles.buttonText}>{t('bleScanQr')}</Text>
          </TouchableOpacity>
        </>
      )}

      {isConnected && ble.connectedDevice ? (
        <>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {t('bleConnectedTo', { name: ble.connectedDevice.name ?? 'OpenFlight' })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={ble.disconnect}
            accessibilityLabel={t('a11yDisconnectBt')}
          >
            <Text style={[styles.buttonText, { color: C.text }]}>{t('connDisconnect')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, isScanning && styles.activeButton]}
            onPress={isScanning ? ble.stopScan : ble.startScan}
            disabled={isConnecting || !paired}
            accessibilityLabel={
              isScanning ? 'Stop Bluetooth scan' : isConnecting ? 'Connecting…' : 'Scan for Bluetooth devices'
            }
            accessibilityState={{ disabled: isConnecting || !paired, busy: isScanning || isConnecting }}
          >
            {isScanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color="#0a0a0a" size="small" />
                <Text style={[styles.buttonText, { marginLeft: 8 }]}>{t('bleStopScan')}</Text>
              </View>
            ) : (
              <Text style={[styles.buttonText, !paired && { opacity: 0.4 }]}>
                {isConnecting ? t('connConnecting') : t('bleScanDevices')}
              </Text>
            )}
          </TouchableOpacity>

          {ble.errorMessage && <Text style={styles.errorText}>{ble.errorMessage}</Text>}

          {ble.scannedDevices.length > 0 && (
            <>
              <Text style={styles.hint}>{t('bleDevicesFound')}</Text>
              <FlatList<Device>
                data={ble.scannedDevices}
                keyExtractor={(d) => d.id}
                renderItem={({ item }) => (
                  <DeviceRow device={item} onPress={() => ble.connectToDevice(item)} styles={styles} />
                )}
                style={styles.deviceList}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

function DeviceRow({ device, onPress, styles }: { device: Device; onPress: () => void; styles: Styles }) {
  return (
    <TouchableOpacity
      style={styles.deviceRow}
      onPress={onPress}
      accessibilityLabel={`${device.name ?? device.id}, ${device.rssi} dBm. Tap to connect.`}
    >
      <Text style={styles.deviceName}>{device.name ?? device.id}</Text>
      <Text style={styles.deviceRssi}>{device.rssi} dBm</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20 },
  title: { color: C.text, fontSize: scale(22), fontWeight: '700', marginBottom: 24 },
  tabs: {
    flexDirection: 'row', backgroundColor: C.s2,
    borderRadius: 10, padding: 4, marginBottom: 24,
  },
  tab: { flex: 1, paddingVertical: 12, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: C.accent },
  tabText: { color: C.sub, fontWeight: '600', fontSize: scale(15) },
  activeTabText: { color: C.bg },
  panel: { gap: 14 },
  hint: { color: C.sub, fontSize: scale(13) },
  input: {
    backgroundColor: C.s2, borderRadius: 10, padding: 14,
    color: C.text, fontSize: scale(16), fontFamily: 'monospace',
  },
  button: { backgroundColor: C.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
  activeButton: { backgroundColor: C.accentMuted },
  dangerButton: { backgroundColor: C.s3 },
  buttonText: { color: C.bg, fontWeight: '700', fontSize: scale(16) },
  scanningRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.okSurface, padding: 12, borderRadius: 10,
  },
  pairedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.okSurface, padding: 12, borderRadius: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok },
  statusText: { color: C.ok, fontWeight: '600', flex: 1 },
  unpairBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  unpairText: { color: C.muted, fontSize: scale(12), fontWeight: '600' },
  errorText: { color: C.err, fontSize: scale(13) },
  deviceList: { maxHeight: 300 },
  deviceRow: {
    backgroundColor: C.s2, borderRadius: 10, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: C.line,
  },
  deviceName: { color: C.text, fontWeight: '600', fontSize: scale(15) },
  deviceRssi: { color: C.sub, fontSize: scale(13) },
  demoSection: { marginTop: 24 },
  divider: { height: 1, backgroundColor: C.line, marginBottom: 20 },
  demoButton: {
    borderRadius: 10, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: C.accentMuted, backgroundColor: C.accentSurface,
  },
  demoButtonText: { color: C.accent, fontWeight: '700', fontSize: scale(15) },
  demoHint: { color: C.muted, fontSize: scale(12), marginTop: 4 },
});
