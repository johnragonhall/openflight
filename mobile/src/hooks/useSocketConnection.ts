import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { isValidShot } from '../types/shot';
import type { Shot, SessionStats } from '../types/shot';
import { getAccessibilityPrefs } from '../state/accessibilitySettings';

// RFC 1918 private ranges — allow cleartext HTTP only on local LAN.
// External hosts must use HTTPS/WSS.
const LAN_RE = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?$/;

function buildSecureUrl(hostAndPort: string): string {
  // Strip any existing scheme so we can apply the right one.
  const stripped = hostAndPort.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
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
  startDemo: () => void;
  stopDemo: () => void;
}

const DEMO_CLUBS = ['driver', '3wood', '5iron', '7iron', '9iron', 'pw', 'sw'];
const DEMO_PROFILES: Record<string, { ball: [number, number]; club: [number, number]; angle: [number, number] }> = {
  driver:  { ball: [140, 165], club: [90, 105], angle: [10, 15] },
  '3wood': { ball: [125, 145], club: [85,  98], angle: [11, 16] },
  '5iron': { ball: [100, 118], club: [72,  85], angle: [14, 19] },
  '7iron': { ball: [85,  102], club: [62,  75], angle: [17, 22] },
  '9iron': { ball: [70,   88], club: [52,  64], angle: [22, 28] },
  pw:      { ball: [58,   74], club: [46,  57], angle: [28, 34] },
  sw:      { ball: [40,   58], club: [38,  49], angle: [34, 42] },
};

function randBetween(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo);
}

function makeDemoShot(club: string): Shot {
  const profile = DEMO_PROFILES[club] ?? DEMO_PROFILES['7iron']!;
  const ballSpeed = randBetween(...profile.ball);
  const clubSpeed = randBetween(...profile.club);
  const launchAngle = randBetween(...profile.angle);
  const carry = ballSpeed * 1.67 + launchAngle * 0.8;
  const side = (Math.random() - 0.5) * 20;
  return {
    timestamp: new Date().toISOString(),
    club,
    ball_speed_mph: +ballSpeed.toFixed(1),
    club_speed_mph: +clubSpeed.toFixed(1),
    smash_factor: +(ballSpeed / clubSpeed).toFixed(2),
    estimated_carry_yards: +carry.toFixed(1),
    carry_spin_adjusted: +(carry * 0.97).toFixed(1),
    carry_range: [+(carry * 0.93).toFixed(1), +(carry * 1.07).toFixed(1)],
    peak_magnitude: null,
    launch_angle_vertical: +launchAngle.toFixed(1),
    launch_angle_horizontal: +side.toFixed(1),
    launch_angle_confidence: 0.9,
    angle_source: 'estimated',
    club_angle_deg: +(side * 0.4).toFixed(1),
    club_path_deg: +(side * 0.3).toFixed(1),
    spin_axis_deg: +(side * 1.2).toFixed(1),
    spin_rpm: +randBetween(2200, 4800).toFixed(0),
    spin_confidence: 0.85,
    spin_quality: 'medium',
    apex_height_yards: +(carry * randBetween(0.12, 0.20)).toFixed(1),
    total_distance_yards: +(carry * randBetween(1.05, 1.15)).toFixed(1),
    face_to_path_deg: +(side * 0.15).toFixed(1),
    is_mishit: Math.random() < 0.08,
  };
}

export function useSocketConnection(): SocketConnectionState {
  const socketRef = useRef<Socket | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [latestShot, setLatestShot] = useState<Shot | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [selectedClub, setSelectedClub] = useState('driver');

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
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
        getAccessibilityPrefs()
          .then((a11y) => socket.emit('client_prefs', { accessibility: a11y }))
          .catch(() => {});
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('shot', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const payload = data as Record<string, unknown>;
        const shot = payload.shot;
        if (!isValidShot(shot)) return;
        setLatestShot(shot);
        setShots((prev) => [shot, ...prev].slice(0, 100));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

      socket.on('session_state', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const payload = data as Record<string, unknown>;
        if (!Array.isArray(payload.shots)) return;
        const ordered = payload.shots.filter(isValidShot).reverse();
        setShots(ordered);
        if (ordered.length > 0) setLatestShot(ordered[0] ?? null);
        if (typeof payload.mock_mode === 'boolean') setMockMode(payload.mock_mode);
      });

      socket.on('club_changed', (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const { club } = data as Record<string, unknown>;
        if (typeof club === 'string') setSelectedClub(club);
      });

      socket.on('session_cleared', () => {
        setShots([]);
        setLatestShot(null);
      });

      socketRef.current = socket;
    },
    [disconnect]
  );

  useEffect(() => () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
    }
    if (demoIntervalRef.current) clearTimeout(demoIntervalRef.current);
  }, []);

  const clearSession = useCallback(() => {
    socketRef.current?.emit('clear_session');
  }, []);

  const setClub = useCallback((club: string) => {
    setSelectedClub(club);
    socketRef.current?.emit('set_club', { club });
  }, []);

  const stopDemo = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setConnected(false);
    setMockMode(false);
    setShots([]);
    setLatestShot(null);
  }, []);

  const startDemo = useCallback(() => {
    disconnect();
    setConnected(true);
    setMockMode(true);
    setShots([]);
    setLatestShot(null);

    // Fire first shot immediately, then every 4–7 seconds
    const fireShot = () => {
      const club = DEMO_CLUBS[Math.floor(Math.random() * DEMO_CLUBS.length)]!;
      const shot = makeDemoShot(club);
      setLatestShot(shot);
      setShots((prev) => [shot, ...prev].slice(0, 100));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    fireShot();
    const scheduleNext = () => {
      const delay = 4000 + Math.random() * 3000;
      demoIntervalRef.current = setTimeout(() => {
        fireShot();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }, [disconnect]);

  return { connected, shots, latestShot, mockMode, selectedClub, connect, disconnect, clearSession, setClub, startDemo, stopDemo };
}
