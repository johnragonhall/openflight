import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  type Device,
  type Subscription,
  State as BleState,
} from 'react-native-ble-plx';
import type { Shot } from '../types/shot';

export const OPENFLIGHT_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const SHOT_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const COMMAND_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
export const STATUS_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';

const DEVICE_NAME = 'OpenFlight';
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

  const handleError = useCallback((msg: string) => {
    setStatus('error');
    setErrorMessage(msg);
  }, []);

  const _teardownSubscriptions = useCallback(() => {
    shotMonitorRef.current?.remove();
    statusMonitorRef.current?.remove();
    disconnectSubRef.current?.remove();
    shotMonitorRef.current = null;
    statusMonitorRef.current = null;
    disconnectSubRef.current = null;
  }, []);

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
      handleError('Bluetooth permission denied. Please enable it in Settings.');
      return;
    }

    const state = await manager.state();
    if (state !== BleState.PoweredOn) {
      handleError('Bluetooth is off. Please enable Bluetooth and try again.');
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
          handleError(`Scan error: ${error.message}`);
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
  }, [handleError]);

  const connectToDevice = useCallback(
    async (device: Device) => {
      stopScan();
      setStatus('connecting');
      lastDeviceRef.current = device;
      reconnectCountRef.current = 0;
      await _doConnect(device);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopScan]
  );

  const _doConnect = useCallback(
    async (device: Device) => {
      _teardownSubscriptions();

      try {
        const connected = await device.connect({ timeout: 10000 });
        await connected.discoverAllServicesAndCharacteristics();

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

        // Monitor shot notifications
        shotMonitorRef.current = connected.monitorCharacteristicForService(
          OPENFLIGHT_SERVICE_UUID,
          SHOT_CHARACTERISTIC_UUID,
          (err, characteristic) => {
            if (err || !characteristic?.value) return;
            try {
              const shot: Shot = JSON.parse(atob(characteristic.value));
              setLatestShot(shot);
              setShots((prev) => [shot, ...prev].slice(0, 100));
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
          _teardownSubscriptions();
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
                _doConnect(lastDeviceRef.current);
              }
            }, delay);
          }
        });

        reconnectCountRef.current = 0;
        setConnectedDevice(connected);
        setStatus('connected');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        handleError(`Connection failed: ${msg}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_teardownSubscriptions, handleError]
  );

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    lastDeviceRef.current = null;
    _teardownSubscriptions();
    connectedDevice?.cancelConnection();
    setConnectedDevice(null);
    setStatus('idle');
    setErrorMessage(null);
  }, [_teardownSubscriptions, connectedDevice]);

  const clearSession = useCallback(() => {
    setShots([]);
    setLatestShot(null);
    if (connectedDevice) {
      connectedDevice
        .writeCharacteristicWithResponseForService(
          OPENFLIGHT_SERVICE_UUID,
          COMMAND_CHARACTERISTIC_UUID,
          btoa(JSON.stringify({ cmd: 'clear_session' }))
        )
        .catch(() => { /* not fatal — server will clear on its own timer */ });
    }
  }, [connectedDevice]);

  const setClub = useCallback(
    async (clubId: string) => {
      setSelectedClub(clubId);
      if (!connectedDevice) return;
      try {
        await connectedDevice.writeCharacteristicWithResponseForService(
          OPENFLIGHT_SERVICE_UUID,
          COMMAND_CHARACTERISTIC_UUID,
          btoa(JSON.stringify({ cmd: 'set_club', club: clubId }))
        );
      } catch {
        // not fatal — club label still updates locally via shot.club
      }
    },
    [connectedDevice]
  );

  useEffect(() => {
    return () => {
      _teardownSubscriptions();
      manager.stopDeviceScan();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [_teardownSubscriptions]);

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
  };
}
