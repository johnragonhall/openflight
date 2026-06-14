import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  type Device,
  type Subscription,
  State as BleState,
} from 'react-native-ble-plx';
import { isValidShot } from '../types/shot';
import type { Shot } from '../types/shot';
import { getAccessibilityPrefs } from '../state/accessibilitySettings';

export const OPENFLIGHT_SERVICE_UUID       = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const SHOT_CHARACTERISTIC_UUID      = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const COMMAND_CHARACTERISTIC_UUID   = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
export const STATUS_CHARACTERISTIC_UUID    = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';
// Challenge characteristic: Pi writes a fresh 64-char hex nonce here.
// Client reads it, computes HMAC-SHA256(pairing_secret, nonce_utf8), sends hex digest.
export const CHALLENGE_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26ab';

const DEVICE_NAME = 'OpenFlight';
// SecureStore key for the 32-byte pairing secret (64 hex chars) obtained via QR scan.
export const BLE_PAIRING_SECRET_KEY = 'openflight.ble-pairing-secret';

/**
 * Compute HMAC-SHA256(pairing_secret_bytes, nonce_utf8_bytes).
 * Returns a 64-char lowercase hex string matching what the Pi verifies.
 */
async function computeHmac(secretHex: string, nonce: string): Promise<string> {
  const pairs = secretHex.match(/.{2}/g);
  if (!pairs || pairs.length !== 32) throw new Error('Invalid pairing secret format');
  const keyBytes = Uint8Array.from(pairs.map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(nonce));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS_MS = [3000, 6000, 12000];

export type BLEStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface BLEConnectionState {
  status: BLEStatus;
  errorMessage: string | null;
  scannedDevices: Device[];
  connectedDevice: Device | null;
  shots: Shot[];
  latestShot: Shot | null;
  malformedCount: number;
  selectedClub: string;
  startScan: () => void;
  stopScan: () => void;
  connectToDevice: (device: Device) => Promise<void>;
  disconnect: () => void;
  clearSession: () => void;
  setClub: (clubId: string) => Promise<void>;
  sendClientPrefs: () => Promise<void>;
}

const manager = new BleManager();

async function requestAndroidBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted' &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted'
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === 'granted';
}

export function useBLEConnection(): BLEConnectionState {
  const [status, setStatus] = useState<BLEStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [latestShot, setLatestShot] = useState<Shot | null>(null);
  const [malformedCount, setMalformedCount] = useState(0);
  const [selectedClub, setSelectedClub] = useState<string>('driver');

  const shotMonitorRef = useRef<Subscription | null>(null);
  const statusMonitorRef = useRef<Subscription | null>(null);
  const disconnectSubRef = useRef<Subscription | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const lastDeviceRef = useRef<Device | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null);

  const handleError = useCallback((msg: string) => {
    setStatus('error');
    setErrorMessage(msg);
  }, []);
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  const _teardownSubscriptions = useCallback(() => {
    shotMonitorRef.current?.remove();
    statusMonitorRef.current?.remove();
    disconnectSubRef.current?.remove();
    shotMonitorRef.current = null;
    statusMonitorRef.current = null;
    disconnectSubRef.current = null;
  }, []);
  const teardownRef = useRef(_teardownSubscriptions);
  teardownRef.current = _teardownSubscriptions;

  const stopScan = useCallback(() => {
    manager.stopDeviceScan();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setStatus((s) => (s === 'scanning' ? 'idle' : s));
  }, []);

  const startScan = useCallback(async () => {
    setScannedDevices([]);
    setErrorMessage(null);

    const permissionsOk = await requestAndroidBLEPermissions();
    if (!permissionsOk) {
      handleErrorRef.current('Bluetooth permission denied. Please enable it in Settings.');
      return;
    }

    const state = await manager.state();
    if (state !== BleState.PoweredOn) {
      handleErrorRef.current('Bluetooth is off. Please enable Bluetooth and try again.');
      return;
    }

    setStatus('scanning');

    // Filter by service UUID so iOS scans efficiently; fall back to name match
    // for devices that don't include the UUID in their advertisement packet.
    manager.startDeviceScan(
      [OPENFLIGHT_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          handleErrorRef.current(`Scan error: ${error.message}`);
          return;
        }
        if (!device) return;

        const isOpenFlight =
          device.name === DEVICE_NAME ||
          device.serviceUUIDs?.some(
            (u) => u.toLowerCase() === OPENFLIGHT_SERVICE_UUID.toLowerCase()
          );

        if (isOpenFlight) {
          setScannedDevices((prev) =>
            prev.find((d) => d.id === device.id) ? prev : [...prev, device]
          );
        }
      }
    );

    scanTimeoutRef.current = setTimeout(() => {
      manager.stopDeviceScan();
      setStatus((s) => (s === 'scanning' ? 'idle' : s));
    }, 15000);
  }, [stopScan]);

  const doConnectRef = useRef<(device: Device) => Promise<void>>(async () => {});

  const connectToDevice = useCallback(
    async (device: Device) => {
      stopScan();
      setStatus('connecting');
      lastDeviceRef.current = device;
      reconnectCountRef.current = 0;
      await doConnectRef.current(device);
    },
    [stopScan]
  );

  const _doConnect = useCallback(
    async (device: Device) => {
      teardownRef.current();

      try {
        const connected = await device.connect({ timeout: 10000 });
        await connected.discoverAllServicesAndCharacteristics();

        // HMAC-SHA256 challenge-response auth.
        // Pi writes a fresh 64-char hex nonce to CHALLENGE_CHARACTERISTIC on connect.
        // Mobile reads nonce, computes HMAC-SHA256(pairing_secret, nonce_utf8), sends hex.
        // The pairing secret is obtained once during the QR pairing ceremony.
        try {
          const secretHex = await SecureStore.getItemAsync(BLE_PAIRING_SECRET_KEY);
          if (secretHex) {
            const challengeChar = await connected.readCharacteristicForService(
              OPENFLIGHT_SERVICE_UUID,
              CHALLENGE_CHARACTERISTIC_UUID,
            );
            if (challengeChar?.value) {
              const nonce = atob(challengeChar.value);
              const hmacHex = await computeHmac(secretHex, nonce);
              await connected.writeCharacteristicWithResponseForService(
                OPENFLIGHT_SERVICE_UUID,
                COMMAND_CHARACTERISTIC_UUID,
                btoa(JSON.stringify({ cmd: 'auth_challenge', hmac: hmacHex })),
              );
            }
          }
        } catch {
          // No secret stored (not yet paired) or CHALLENGE char unavailable — open mode
        }

        // Request session history on connect
        try {
          await connected.writeCharacteristicWithResponseForService(
            OPENFLIGHT_SERVICE_UUID,
            COMMAND_CHARACTERISTIC_UUID,
            btoa(JSON.stringify({ cmd: 'get_session' }))
          );
        } catch {
          // Command char may not be available on older firmware — not fatal
        }

        // Send client preferences (units, accessibility, language) to kiosk
        try {
          const a11y = await getAccessibilityPrefs();
          await connected.writeCharacteristicWithResponseForService(
            OPENFLIGHT_SERVICE_UUID,
            COMMAND_CHARACTERISTIC_UUID,
            btoa(JSON.stringify({
              cmd: 'set_prefs',
              accessibility: a11y,
            }))
          );
        } catch {
          // not fatal
        }

        // Monitor shot notifications
        shotMonitorRef.current = connected.monitorCharacteristicForService(
          OPENFLIGHT_SERVICE_UUID,
          SHOT_CHARACTERISTIC_UUID,
          (err, characteristic) => {
            if (err || !characteristic?.value) return;
            try {
              const parsed: unknown = JSON.parse(atob(characteristic.value));
              if (!isValidShot(parsed)) {
                setMalformedCount((n) => n + 1);
                return;
              }
              setLatestShot(parsed);
              setShots((prev) => [parsed, ...prev].slice(0, 100));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              setMalformedCount((n) => n + 1);
            }
          }
        );

        // Monitor status notifications (session_cleared, etc.)
        statusMonitorRef.current = connected.monitorCharacteristicForService(
          OPENFLIGHT_SERVICE_UUID,
          STATUS_CHARACTERISTIC_UUID,
          (err, characteristic) => {
            if (err || !characteristic?.value) return;
            try {
              const event = JSON.parse(atob(characteristic.value));
              if (event.event === 'session_cleared') {
                setShots([]);
                setLatestShot(null);
              }
            } catch {
              // ignore malformed status events
            }
          }
        );

        disconnectSubRef.current = connected.onDisconnected((_err, _dev) => {
          teardownRef.current();
          connectedDeviceRef.current = null;
          setConnectedDevice(null);
          setStatus('disconnected');

          // Auto-reconnect with backoff
          const attempt = reconnectCountRef.current;
          if (lastDeviceRef.current && attempt < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAYS_MS[attempt] ?? 12000;
            reconnectCountRef.current += 1;
            reconnectTimerRef.current = setTimeout(() => {
              if (lastDeviceRef.current) {
                setStatus('connecting');
                doConnectRef.current(lastDeviceRef.current);
              }
            }, delay);
          }
        });

        reconnectCountRef.current = 0;
        connectedDeviceRef.current = connected;
        setConnectedDevice(connected);
        setStatus('connected');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        handleErrorRef.current(`Connection failed: ${msg}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally empty — all external references go through stable refs (handleErrorRef,
    // teardownRef, doConnectRef) so no reactive deps are needed.
    [],
  );
  doConnectRef.current = _doConnect;

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    lastDeviceRef.current = null;
    teardownRef.current();
    connectedDeviceRef.current?.cancelConnection();
    connectedDeviceRef.current = null;
    setConnectedDevice(null);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  const clearSession = useCallback(() => {
    setShots([]);
    setLatestShot(null);
    const writePromise = connectedDeviceRef.current?.writeCharacteristicWithResponseForService(
      OPENFLIGHT_SERVICE_UUID,
      COMMAND_CHARACTERISTIC_UUID,
      btoa(JSON.stringify({ cmd: 'clear_session' }))
    );
    writePromise?.catch(() => { /* not fatal — server will clear on its own timer */ });
  }, []);

  const setClub = useCallback(async (clubId: string) => {
    setSelectedClub(clubId);
    if (!connectedDeviceRef.current) return;
    try {
      await connectedDeviceRef.current.writeCharacteristicWithResponseForService(
        OPENFLIGHT_SERVICE_UUID,
        COMMAND_CHARACTERISTIC_UUID,
        btoa(JSON.stringify({ cmd: 'set_club', club: clubId }))
      );
    } catch {
      // not fatal — club label still updates locally via shot.club
    }
  }, []);

  const sendClientPrefs = useCallback(async () => {
    if (!connectedDeviceRef.current) return;
    try {
      const a11y = await getAccessibilityPrefs();
      await connectedDeviceRef.current.writeCharacteristicWithResponseForService(
        OPENFLIGHT_SERVICE_UUID,
        COMMAND_CHARACTERISTIC_UUID,
        btoa(JSON.stringify({ cmd: 'set_prefs', accessibility: a11y }))
      );
    } catch {
      // not fatal
    }
  }, []);

  useEffect(() => {
    return () => {
      teardownRef.current();
      manager.stopDeviceScan();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  return {
    status,
    errorMessage,
    scannedDevices,
    connectedDevice,
    shots,
    latestShot,
    malformedCount,
    selectedClub,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    clearSession,
    setClub,
    sendClientPrefs,
  };
}
