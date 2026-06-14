import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { AnimatedTabBar } from './src/components/AnimatedTabBar';
import type { RootStackParamList, MainTabParamList } from './src/types/navigation';
import { C } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const NAV_THEME = {
  dark: true,
  colors: {
    primary: C.accent, background: C.bg, card: C.s1,
    text: C.text, border: C.line, notification: C.accent,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium:  { fontFamily: 'System', fontWeight: '500' as const },
    bold:    { fontFamily: 'System', fontWeight: '700' as const },
    heavy:   { fontFamily: 'System', fontWeight: '900' as const },
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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
  const [dbReady, setDbReady] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const prevShotTsRef = useRef<string | null>(null);

  const wifiActive = socket.connected;
  const bleActive = ble.status === 'connected';
  const connected = wifiActive || bleActive;
  const shots = wifiActive ? socket.shots : ble.shots;
  const latestShot = wifiActive ? socket.latestShot : ble.latestShot;
  const connectionLabel = wifiActive ? 'Wi-Fi' : 'BLE';
  const selectedClub = wifiActive ? socket.selectedClub : ble.selectedClub;

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch(() => { /* DB unavailable — shots remain in-memory only */ });
  }, []);

  // Start DB session on first connect, but only after DB is ready
  useEffect(() => {
    if (!dbReady || !connected || sessionIdRef.current) return;
    createSession(connectionLabel)
      .then((id) => { sessionIdRef.current = id; })
      .catch(() => {});
  }, [connected, connectionLabel, dbReady]);

  // Persist each new shot
  useEffect(() => {
    if (!latestShot || latestShot.timestamp === prevShotTsRef.current) return;
    prevShotTsRef.current = latestShot.timestamp;
    if (!sessionIdRef.current) return;
    saveShot(sessionIdRef.current, enrichShot(latestShot)).catch(() => {});
  }, [latestShot]);

  const clearSession = () => {
    const oldId = sessionIdRef.current;
    sessionIdRef.current = null;
    if (oldId) endSession(oldId).catch(() => {});
    if (connected) {
      createSession(connectionLabel)
        .then((id) => { sessionIdRef.current = id; })
        .catch(() => {});
    }
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
    startDemo: socket.startDemo,
    stopDemo: socket.stopDemo,
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
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
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
