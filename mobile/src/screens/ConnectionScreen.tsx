import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
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
import type { BLEConnectionState } from '../hooks/useBLEConnection';
import type { SocketConnectionState } from '../hooks/useSocketConnection';
import { C } from '../theme';

const STORAGE_KEY = 'openflight.last-host';
const DEFAULT_HOST = '192.168.1.';
export const BLE_PIN_KEY = 'openflight.ble-pin';

interface ConnectionScreenProps {
  socket: SocketConnectionState;
  ble: BLEConnectionState;
}

export function ConnectionScreen({ socket, ble }: ConnectionScreenProps) {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to Launch Monitor</Text>

      <View style={styles.tabs}>
        {(['wifi', 'ble'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'wifi' ? 'Wi-Fi' : 'Bluetooth'}
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
        />
      ) : (
        <BLEPanel ble={ble} />
      )}
    </View>
  );
}

function WiFiPanel({
  socket,
  hostAndPort,
  setHostAndPort,
  onConnect,
}: {
  socket: SocketConnectionState;
  hostAndPort: string;
  setHostAndPort: (v: string) => void;
  onConnect: () => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.hint}>Enter your Pi&apos;s IP address and port (default 8080)</Text>
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
        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={socket.disconnect}>
          <Text style={[styles.buttonText, { color: '#ffffff' }]}>Disconnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.button} onPress={onConnect}>
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
      )}
      {socket.connected && (
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Connected via Wi-Fi</Text>
        </View>
      )}
    </View>
  );
}

function BLEPanel({ ble }: { ble: BLEConnectionState }) {
  const isScanning = ble.status === 'scanning';
  const isConnecting = ble.status === 'connecting';
  const isConnected = ble.status === 'connected';
  const [pin, setPin] = useState('');

  useEffect(() => {
    SecureStore.getItemAsync(BLE_PIN_KEY).then((v) => { if (v) setPin(v); }).catch(() => {});
  }, []);

  const savePin = (v: string) => {
    setPin(v);
    SecureStore.setItemAsync(BLE_PIN_KEY, v).catch(() => {});
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.hint}>BLE PIN (shown on Pi console when BLE starts)</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={savePin}
        placeholder="0000"
        placeholderTextColor="#4b5563"
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
      />

      {isConnected && ble.connectedDevice ? (
        <>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              Connected to {ble.connectedDevice.name ?? 'OpenFlight'}
            </Text>
          </View>
          <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={ble.disconnect}>
            <Text style={[styles.buttonText, { color: '#ffffff' }]}>Disconnect</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, isScanning && styles.activeButton]}
            onPress={isScanning ? ble.stopScan : ble.startScan}
            disabled={isConnecting}
          >
            {isScanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color="#0a0a0a" size="small" />
                <Text style={[styles.buttonText, { marginLeft: 8 }]}>Stop Scan</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>
                {isConnecting ? 'Connecting…' : 'Scan for Devices'}
              </Text>
            )}
          </TouchableOpacity>

          {ble.errorMessage && <Text style={styles.errorText}>{ble.errorMessage}</Text>}

          {ble.scannedDevices.length > 0 && (
            <>
              <Text style={styles.hint}>Devices found:</Text>
              <FlatList<Device>
                data={ble.scannedDevices}
                keyExtractor={(d) => d.id}
                renderItem={({ item }) => (
                  <DeviceRow device={item} onPress={() => ble.connectToDevice(item)} />
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

function DeviceRow({ device, onPress }: { device: Device; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.deviceRow} onPress={onPress}>
      <Text style={styles.deviceName}>{device.name ?? device.id}</Text>
      <Text style={styles.deviceRssi}>{device.rssi} dBm</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20 },
  title: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 24 },
  tabs: {
    flexDirection: 'row', backgroundColor: C.s2,
    borderRadius: 10, padding: 4, marginBottom: 24,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: C.accent },
  tabText: { color: C.sub, fontWeight: '600', fontSize: 15 },
  activeTabText: { color: C.bg },
  panel: { gap: 14 },
  hint: { color: C.sub, fontSize: 13 },
  input: {
    backgroundColor: C.s2, borderRadius: 10, padding: 14,
    color: C.text, fontSize: 16, fontFamily: 'monospace',
  },
  button: { backgroundColor: C.accent, borderRadius: 10, padding: 16, alignItems: 'center' },
  activeButton: { backgroundColor: C.accentMuted },
  dangerButton: { backgroundColor: C.s3 },
  buttonText: { color: C.bg, fontWeight: '700', fontSize: 16 },
  scanningRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.okSurface, padding: 12, borderRadius: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok },
  statusText: { color: C.ok, fontWeight: '600' },
  errorText: { color: '#ef4444', fontSize: 13 },
  deviceList: { maxHeight: 300 },
  deviceRow: {
    backgroundColor: C.s2, borderRadius: 10, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: C.line,
  },
  deviceName: { color: C.text, fontWeight: '600', fontSize: 15 },
  deviceRssi: { color: C.sub, fontSize: 13 },
});
