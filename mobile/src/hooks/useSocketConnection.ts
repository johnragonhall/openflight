import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Shot, SessionStats } from '../types/shot';

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
      const url = hostAndPort.startsWith('http') ? hostAndPort : `http://${hostAndPort}`;
      const socket = io(url, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('get_session');
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('shot', (data: { shot: Shot; stats: SessionStats }) => {
        setLatestShot(data.shot);
        setShots((prev) => [data.shot, ...prev].slice(0, 100));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

      socket.on(
        'session_state',
        (data: { shots: Shot[]; mock_mode?: boolean }) => {
          const ordered = [...data.shots].reverse();
          setShots(ordered);
          if (ordered.length > 0) setLatestShot(ordered[0]);
          if (data.mock_mode !== undefined) setMockMode(data.mock_mode);
        }
      );

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
