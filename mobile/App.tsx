import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { useBLEConnection } from './src/hooks/useBLEConnection';
import { useSocketConnection } from './src/hooks/useSocketConnection';
import { UnitPreferenceProvider } from './src/state/UnitPreferenceProvider';
import { ConnectionProvider, type ConnectionContextValue } from './src/state/ConnectionContext';
import { enrichShot } from './src/utils/ballistics';
import { initDatabase, createSession, endSession, saveShot } from './src/db/database';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { RangeScreen } from './src/screens/RangeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ConnectionScreen } from './src/screens/ConnectionScreen';
import { SessionDetailScreen } from './src/screens/SessionDetailScreen';
import type { RootStackParamList, MainTabParamList } from './src/types/navigation';

try { initDatabase(); } catch { /* noop */ }

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const NAV_THEME = {
  dark: true,
  colors: {
    primary: '#22c55e', background: '#0a0a0a', card: '#111111',
    text: '#ffffff', border: '#1a1a1a', notification: '#22c55e',
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium:  { fontFamily: 'System', fontWeight: '500' as const },
    bold:    { fontFamily: 'System', fontWeight: '700' as const },
    heavy:   { fontFamily: 'System', fontWeight: '900' as const },
  },
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { on: IoniconName; off: IoniconName }> = {
  Live:     { on: 'radio',        off: 'radio-outline' },
  History:  { on: 'time',         off: 'time-outline' },
  Stats:    { on: 'stats-chart',  off: 'stats-chart-outline' },
  Range:    { on: 'flag',         off: 'flag-outline' },
  Settings: { on: 'settings',     off: 'settings-outline' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#111111', borderTopColor: '#1a1a1a' },
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons?.on : icons?.off;
          return name ? <Ionicons name={name} size={size} color={color} /> : null;
        },
      })}
    >
      <Tab.Screen name="Live" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Range" component={RangeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const socket = useSocketConnection();
  const ble = useBLEConnection();
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const prevShotTsRef = useRef<string | null>(null);

  const wifiActive = socket.connected;
  const bleActive = ble.status === 'connected';
  const connected = wifiActive || bleActive;
  const shots = wifiActive ? socket.shots : ble.shots;
  const latestShot = wifiActive ? socket.latestShot : ble.latestShot;
  const connectionLabel = wifiActive ? 'Wi-Fi' : 'BLE';
  const selectedClub = wifiActive ? socket.selectedClub : ble.selectedClub;

  // Start DB session on first connect
  useEffect(() => {
    if (connected && !sessionIdRef.current) {
      try { sessionIdRef.current = createSession(connectionLabel); } catch { /* noop */ }
    }
  }, [connected, connectionLabel]);

  // Persist each new shot
  useEffect(() => {
    if (!latestShot || latestShot.timestamp === prevShotTsRef.current) return;
    prevShotTsRef.current = latestShot.timestamp;
    if (!sessionIdRef.current) return;
    try { saveShot(sessionIdRef.current, enrichShot(latestShot)); } catch { /* noop */ }
  }, [latestShot]);

  const clearSession = () => {
    try {
      if (sessionIdRef.current) endSession(sessionIdRef.current);
      sessionIdRef.current = connected ? createSession(connectionLabel) : null;
    } catch { /* noop */ }
    (wifiActive ? socket.clearSession : ble.clearSession)();
  };

  const setClub = (clubId: string) => {
    if (wifiActive) socket.setClub(clubId);
    else if (bleActive) ble.setClub(clubId);
  };

  const displayedError = ble.errorMessage !== dismissedError ? ble.errorMessage : null;

  const ctxValue: ConnectionContextValue = {
    connected, connectionLabel, mockMode: socket.mockMode,
    shots, latestShot, selectedClub,
    errorMessage: displayedError, malformedCount: ble.malformedCount,
    setClub, clearSession,
    dismissError: () => setDismissedError(ble.errorMessage),
  };

  return (
    <SafeAreaProvider>
      <UnitPreferenceProvider>
        <ConnectionProvider value={ctxValue}>
          <StatusBar style="light" />
          <NavigationContainer theme={NAV_THEME}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="Connection"
                options={{
                  headerShown: true, title: 'Connect',
                  headerStyle: { backgroundColor: '#111111' },
                  headerTintColor: '#22c55e',
                }}
              >
                {() => <ConnectionScreen socket={socket} ble={ble} />}
              </Stack.Screen>
              <Stack.Screen
                name="SessionDetail"
                component={SessionDetailScreen}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ConnectionProvider>
      </UnitPreferenceProvider>
    </SafeAreaProvider>
  );
}
