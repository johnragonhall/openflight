import type { Device } from 'react-native-ble-plx';
import type { Shot } from '../types/shot';
import type { BLEStatus } from './useBLEConnection';

export type ConnectionMode = 'wifi' | 'ble';

export interface ConnectionState {
  mode: ConnectionMode;
  connected: boolean;
  shots: Shot[];
  latestShot: Shot | null;
  // WiFi only
  mockMode?: boolean;
  connect?: (ipAddress: string) => void;
  // BLE only
  bleStatus?: BLEStatus;
  bleError?: string | null;
  scannedDevices?: Device[];
  startScan?: () => void;
  stopScan?: () => void;
  connectToDevice?: (device: Device) => Promise<void>;
  // Shared
  disconnect: () => void;
  clearSession: () => void;
  setClub?: (club: string) => void;
}
