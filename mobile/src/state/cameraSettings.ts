import AsyncStorage from '@react-native-async-storage/async-storage';

const CAMERA_URL_KEY = 'camera_url';
export const DEFAULT_CAMERA_URL = 'http://openflight.local:8080/stream';

let _cached: string | undefined = undefined;

export async function getCameraUrl(): Promise<string> {
  if (_cached !== undefined) return _cached;
  const stored = await AsyncStorage.getItem(CAMERA_URL_KEY);
  _cached = stored ?? DEFAULT_CAMERA_URL;
  return _cached;
}

export async function setCameraUrl(url: string): Promise<void> {
  _cached = url;
  await AsyncStorage.setItem(CAMERA_URL_KEY, url);
}

export function clearCameraUrlCache(): void {
  _cached = undefined;
}
