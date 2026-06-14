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
import { PairScreen } from './src/screens/PairScreen';
import { SessionDetailScreen } from './src/screens/SessionDetailScreen';
import { AnimatedTabBar } from './src/components/AnimatedTabBar';
import { UnitsPickerScreen } from './src/screens/settings/UnitsPickerScreen';
import { TemperatureScreen } from './src/screens/settings/TemperatureScreen';
import { LanguageScreen } from './src/screens/settings/LanguageScreen';
import { BagScreen } from './src/screens/bag/BagScreen';
import { AddClubScreen } from './src/screens/bag/AddClubScreen';
import { ClubDetailScreen } from './src/screens/bag/ClubDetailScreen';
import { SpareClubsScreen } from './src/screens/bag/SpareClubsScreen';
import { AccessibilityScreen } from './src/screens/settings/AccessibilityScreen';
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
                {(props) => <ConnectionScreen {...props} socket={socket} ble={ble} />}
              </Stack.Screen>
              <Stack.Screen
                name="Pair"
                component={PairScreen}
                options={{
                  headerShown: true, title: 'Pair with Kiosk',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                }}
              />
              <Stack.Screen
                name="SessionDetail"
                component={SessionDetailScreen}
              />
              <Stack.Screen
                name="SettingsUnitsPicker"
                component={UnitsPickerScreen}
                options={{
                  headerShown: true, title: 'Units',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerTitleStyle: { color: C.text, fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="SettingsTemperature"
                component={TemperatureScreen}
                options={{
                  headerShown: true, title: 'Temperature',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerTitleStyle: { color: C.text, fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="SettingsLanguage"
                component={LanguageScreen}
                options={{
                  headerShown: true, title: 'Language',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerTitleStyle: { color: C.text, fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="SettingsAccessibility"
                component={AccessibilityScreen}
                options={{
                  headerShown: true, title: 'Accessibility',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerTitleStyle: { color: C.text, fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="BagMain"
                component={BagScreen}
                options={{
                  headerShown: true, title: 'My Bag',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerTitleStyle: { color: C.text, fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="BagAddClub"
                component={AddClubScreen}
                options={{
                  headerShown: true, title: 'Add Club',
                  presentation: 'modal',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerTitleStyle: { color: C.text, fontWeight: '700' },
                }}
              />
              <Stack.Screen
                name="BagClubDetail"
                component={ClubDetailScreen}
                options={{
                  headerShown: true, title: '',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerBackTitle: 'Bag',
                }}
              />
              <Stack.Screen
                name="BagSpareClubs"
                component={SpareClubsScreen}
                options={{
                  headerShown: true, title: 'Spare Clubs',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                  headerTitleStyle: { color: C.text, fontWeight: '700' },
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ConnectionProvider>
      </UnitPreferenceProvider>
    </SafeAreaProvider>
  );
}
