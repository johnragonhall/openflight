import React, { useCallback, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useActiveConnection } from './src/hooks/useActiveConnection';
import { useShotPersistence } from './src/hooks/useShotPersistence';
import { UnitPreferenceProvider } from './src/state/UnitPreferenceProvider';
import { AccessibilityProvider } from './src/state/AccessibilityProvider';
import { ConnectionProvider, type ConnectionContextValue } from './src/state/ConnectionContext';
import { ConnectionControlsProvider } from './src/state/ConnectionControlsContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
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
      <Tab.Screen name="Analytics" component={StatsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const {
    connected, connectionLabel, mockMode, shots, latestShot, selectedClub,
    bleErrorMessage, malformedCount, setClub, clearSession: transportClear,
    startDemo, stopDemo, wifi, ble,
  } = useActiveConnection();
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const { dbError, resetSession, dismissDbError } = useShotPersistence({
    latestShot,
    connected,
    connectionLabel,
  });

  const clearSession = useCallback(() => {
    resetSession();
    transportClear();
  }, [resetSession, transportClear]);

  const dismissError = useCallback(() => {
    dismissDbError();
    setDismissedError(bleErrorMessage);
  }, [dismissDbError, bleErrorMessage]);

  const bleError = bleErrorMessage !== dismissedError ? bleErrorMessage : null;
  const errorMessage = dbError ?? bleError;

  const ctxValue = useMemo<ConnectionContextValue>(() => ({
    connected,
    connectionLabel,
    mockMode,
    shots,
    latestShot,
    selectedClub,
    errorMessage,
    malformedCount,
    setClub,
    clearSession,
    dismissError,
    startDemo,
    stopDemo,
  }), [
    connected, connectionLabel, mockMode, shots, latestShot, selectedClub,
    errorMessage, malformedCount, setClub, clearSession, dismissError,
    startDemo, stopDemo,
  ]);

  const controls = useMemo(() => ({ wifi, ble }), [wifi, ble]);

  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
       <UnitPreferenceProvider>
        <ConnectionProvider value={ctxValue}>
         <ConnectionControlsProvider value={controls}>
          <StatusBar style="light" />
          <NavigationContainer theme={NAV_THEME}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="Connection"
                component={ConnectionScreen}
                options={{
                  headerShown: true, title: 'Connect',
                  headerStyle: { backgroundColor: C.s1 },
                  headerTintColor: C.accent,
                }}
              />
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
         </ConnectionControlsProvider>
        </ConnectionProvider>
       </UnitPreferenceProvider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
