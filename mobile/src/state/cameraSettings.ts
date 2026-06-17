import AsyncStorage from '@react-native-async-storage/async-storage';

const CAMERA_URL_KEY = 'camera_url';
const CAMERA_ENABLED_KEY = 'camera_enabled';

export const DEFAULT_CAMERA_URL = 'http://openflight.local:8080/stream';
export const DEFAULT_CAMERA_ENABLED = false;

let _urlCached: string | undefined = undefined;
let _enabledCached: boolean | undefined = undefined;

export async function getCameraUrl(): Promise<string> {
  if (_urlCached !== undefined) return _urlCached;
  const stored = await AsyncStorage.getItem(CAMERA_URL_KEY);
  _urlCached = stored ?? DEFAULT_CAMERA_URL;
  return _urlCached;
}

export async function setCameraUrl(url: string): Promise<void> {
  _urlCached = url;
  await AsyncStorage.setItem(CAMERA_URL_KEY, url);
}

export function clearCameraUrlCache(): void {
  _urlCached = undefined;
}

export async function getCameraEnabled(): Promise<boolean> {
  if (_enabledCached !== undefined) return _enabledCached;
  const stored = await AsyncStorage.getItem(CAMERA_ENABLED_KEY);
  _enabledCached = stored === 'true';
  return _enabledCached;
}

export async function setCameraEnabled(enabled: boolean): Promise<void> {
  _enabledCached = enabled;
  await AsyncStorage.setItem(CAMERA_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function clearCameraEnabledCache(): void {
  _enabledCached = undefined;
}
