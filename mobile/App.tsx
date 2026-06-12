import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useBLEConnection } from './src/hooks/useBLEConnection';
import { useSocketConnection } from './src/hooks/useSocketConnection';
import { UnitPreferenceProvider } from './src/state/UnitPreferenceProvider';
import { HomeScreen } from './src/screens/HomeScreen';
import { ConnectionScreen } from './src/screens/ConnectionScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export type RootStackParamList = {
  Home: undefined;
  Connection: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const NAV_THEME = {
  dark: true,
  colors: {
    primary: '#22c55e',
    background: '#0a0a0a',
    card: '#111111',
    text: '#ffffff',
    border: '#1a1a1a',
    notification: '#22c55e',
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};

export default function App() {
  const socket = useSocketConnection();
  const ble = useBLEConnection();

  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const wifiActive = socket.connected;
  const bleActive = ble.status === 'connected';
  const connected = wifiActive || bleActive;

  const shots = wifiActive ? socket.shots : ble.shots;
  const latestShot = wifiActive ? socket.latestShot : ble.latestShot;
  const connectionLabel = wifiActive ? 'Wi-Fi' : 'BLE';
  const selectedClub = wifiActive ? socket.selectedClub : ble.selectedClub;

  const clearSession = wifiActive ? socket.clearSession : ble.clearSession;

  const handleSetClub = (clubId: string) => {
    if (wifiActive) {
      socket.setClub(clubId);
    } else if (bleActive) {
      ble.setClub(clubId);
    }
  };

  const displayedError = ble.errorMessage !== dismissedError ? ble.errorMessage : null;

  return (
    <SafeAreaProvider>
      <UnitPreferenceProvider>
        <StatusBar style="light" />
        <NavigationContainer theme={NAV_THEME}>
          <Stack.Navigator>
            <Stack.Screen name="Home" options={{ headerShown: false }}>
              {({ navigation }) => (
                <HomeScreen
                  connected={connected}
                  connectionLabel={connectionLabel}
                  mockMode={socket.mockMode}
                  shots={shots}
                  latestShot={latestShot}
                  selectedClub={selectedClub}
                  errorMessage={displayedError}
                  malformedCount={ble.malformedCount}
                  onPressConnect={() => navigation.navigate('Connection')}
                  onPressSettings={() => navigation.navigate('Settings')}
                  onClearSession={clearSession}
                  onSetClub={handleSetClub}
                  onDismissError={() => setDismissedError(ble.errorMessage)}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Connection"
              options={{ title: 'Connect', headerStyle: { backgroundColor: '#111111' } }}
            >
              {() => <ConnectionScreen socket={socket} ble={ble} />}
            </Stack.Screen>

            <Stack.Screen
              name="Settings"
              options={{ title: 'Settings', headerStyle: { backgroundColor: '#111111' } }}
            >
              {() => <SettingsScreen />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </UnitPreferenceProvider>
    </SafeAreaProvider>
  );
}
