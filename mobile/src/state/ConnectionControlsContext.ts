import { createContext, useContext } from 'react';
import type { SocketConnectionState } from '../hooks/useSocketConnection';
import type { BLEConnectionState } from '../hooks/useBLEConnection';

/**
 * Transport control surfaces for the connection setup screen.
 *
 * Kept separate from ConnectionContext (which is the transport-agnostic live
 * view consumed by every display screen) so the raw socket/BLE hook objects
 * are never prop-drilled through the navigator.
 */
export interface ConnectionControls {
  wifi: SocketConnectionState;
  ble: BLEConnectionState;
}

const ConnectionControlsContext = createContext<ConnectionControls | null>(null);

export const ConnectionControlsProvider = ConnectionControlsContext.Provider;

export function useConnectionControls(): ConnectionControls {
  const ctx = useContext(ConnectionControlsContext);
  if (!ctx) {
    throw new Error('useConnectionControls must be used inside ConnectionControlsProvider');
  }
  return ctx;
}
