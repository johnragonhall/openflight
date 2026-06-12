import React, { createContext, useContext } from 'react';
import type { Shot } from '../types/shot';

export interface ConnectionContextValue {
  connected: boolean;
  connectionLabel: string;
  mockMode: boolean;
  shots: Shot[];
  latestShot: Shot | null;
  selectedClub: string;
  errorMessage: string | null;
  malformedCount: number;
  setClub: (clubId: string) => void;
  clearSession: () => void;
  dismissError: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export const ConnectionProvider = ConnectionContext.Provider;

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used inside ConnectionProvider');
  return ctx;
}
