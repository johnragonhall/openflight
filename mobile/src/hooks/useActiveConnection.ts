import { useCallback } from 'react';
import type { Shot } from '../types/shot';
import { useSocketConnection, type SocketConnectionState } from './useSocketConnection';
import { useBLEConnection, type BLEConnectionState } from './useBLEConnection';

/**
 * Single source of truth for "the active connection".
 *
 * Owns both transports (Wi-Fi / Socket.IO and BLE), resolves which one is
 * live, and exposes a merged view plus the transport-specific control
 * surfaces. Wi-Fi takes precedence when both happen to be connected.
 *
 * The merged getters (`shots`, `latestShot`, `setClub`, …) let display
 * screens stay transport-agnostic, while `wifi`/`ble` give the connection
 * setup screen the controls it needs - no raw hook objects are passed
 * around as props.
 */
export interface ActiveConnection {
  connected: boolean;
  connectionLabel: string;
  mockMode: boolean;
  shots: Shot[];
  latestShot: Shot | null;
  selectedClub: string;
  bleErrorMessage: string | null;
  malformedCount: number;
  setClub: (clubId: string) => void;
  /** Transport-level clear (shots + server command). DB session reset is separate. */
  clearSession: () => void;
  startDemo: () => void;
  stopDemo: () => void;
  // Transport-specific control surfaces (for the connection setup screen).
  wifi: SocketConnectionState;
  ble: BLEConnectionState;
}

export function useActiveConnection(): ActiveConnection {
  const wifi = useSocketConnection();
  const ble = useBLEConnection();

  const wifiActive = wifi.connected;
  const bleActive = ble.status === 'connected';
  const connected = wifiActive || bleActive;

  // Stable method references (each sub-hook memoizes these with useCallback),
  // so the merged callbacks below only change when the active transport does.
  const { setClub: wifiSetClub, clearSession: wifiClear } = wifi;
  const { setClub: bleSetClub, clearSession: bleClear } = ble;

  const setClub = useCallback(
    (clubId: string) => {
      if (wifiActive) wifiSetClub(clubId);
      else if (bleActive) bleSetClub(clubId);
    },
    [wifiActive, bleActive, wifiSetClub, bleSetClub],
  );

  const clearSession = useCallback(() => {
    if (wifiActive) wifiClear();
    else bleClear();
  }, [wifiActive, wifiClear, bleClear]);

  return {
    connected,
    connectionLabel: wifiActive ? 'Wi-Fi' : 'BLE',
    mockMode: wifi.mockMode,
    shots: wifiActive ? wifi.shots : ble.shots,
    latestShot: wifiActive ? wifi.latestShot : ble.latestShot,
    selectedClub: wifiActive ? wifi.selectedClub : ble.selectedClub,
    bleErrorMessage: ble.errorMessage,
    malformedCount: ble.malformedCount,
    setClub,
    clearSession,
    startDemo: wifi.startDemo,
    stopDemo: wifi.stopDemo,
    wifi,
    ble,
  };
}
