import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { isValidShot } from '../types/shot';
import type { Shot, SessionStats } from '../types/shot';

// RFC 1918 private ranges — allow cleartext HTTP only on local LAN.
// External hosts must use HTTPS/WSS.
const LAN_RE = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?$/;

function buildSecureUrl(hostAndPort: string): string {
  // Strip any existing scheme so we can apply the right one.
  const stripped = hostAndPort.replace(/^https?:\/\//, '');
  const host = stripped.split('/')[0];
  const scheme = LAN_RE.test(host) ? 'http' : 'https';
  return `${scheme}://${stripped}`;
}

export interface SocketConnectionState {
  connected: boolean;
  shots: Shot[];
  latestShot: Shot | null;
  mockMode: boolean;
  selectedClub: string;
  connect: (hostAndPort: string) => void;
  disconnect: () => void;
  clearSession: () => void;
  setClub: (club: string) => void;
}

export function useSocketConnection(): SocketConnectionState {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [latestShot, setLatestShot] = useState<Shot | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [selectedClub, setSelectedClub] = useState('driver');

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setConnected(false);
  }, []);

  const connect = useCallback(
    (hostAndPort: string) => {
      disconnect();
      const url = buildSecureUrl(hostAndPort);
      const socket = io(url, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('get_session');
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('shot', (data: unknown) => {
        const payload = data as { shot?: unknown };
        if (!payload || !isValidShot(payload.shot)) return;
        setLatestShot(payload.shot);
        setShots((prev) => [payload.shot!, ...prev].slice(0, 100));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

      socket.on('session_state', (data: unknown) => {
        const payload = data as { shots?: unknown[]; mock_mode?: boolean };
        if (!payload || !Array.isArray(payload.shots)) return;
        const ordered = payload.shots.filter(isValidShot).reverse();
        setShots(ordered);
        if (ordered.length > 0) setLatestShot(ordered[0]);
        if (typeof payload.mock_mode === 'boolean') setMockMode(payload.mock_mode);
      });

      socket.on('club_changed', (data: { club: string }) => {
        setSelectedClub(data.club);
      });

      socket.on('session_cleared', () => {
        setShots([]);
        setLatestShot(null);
      });

      socketRef.current = socket;
    },
    [disconnect]
  );

  useEffect(() => () => { socketRef.current?.close(); }, []);

  const clearSession = useCallback(() => {
    socketRef.current?.emit('clear_session');
  }, []);

  const setClub = useCallback((club: string) => {
    setSelectedClub(club);
    socketRef.current?.emit('set_club', { club });
  }, []);

  return { connected, shots, latestShot, mockMode, selectedClub, connect, disconnect, clearSession, setClub };
}
