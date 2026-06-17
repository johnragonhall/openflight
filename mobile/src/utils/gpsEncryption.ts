import * as SecureStore from 'expo-secure-store';

// Field-level AES-256-GCM encryption for GPS coordinates.
//
// Defense-in-depth on top of SQLCipher full-disk encryption:
// even if the SQLCipher key is somehow extracted, GPS coords require
// a *second* independent key stored in iOS Keychain / Android Keystore.
//
// Key lifecycle:
//   - 256-bit random key generated once via crypto.getRandomValues()
//   - Stored as base64 in SecureStore (hardware-backed on supported devices)
//   - Cached in module scope after first load — no repeated Keystore round-trips
//
// Wire format per encrypted blob (base64):
//   [ 12-byte IV ] [ ciphertext + 16-byte GCM auth tag ]

const GPS_KEY_STORE = 'openflight.gps-aes-key-v1';

let _cryptoKey: CryptoKey | null = null;
let _keyPromise: Promise<CryptoKey> | null = null;

async function getKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey;
  if (!_keyPromise) {
    _keyPromise = (async () => {
      let b64 = await SecureStore.getItemAsync(GPS_KEY_STORE);
      if (!b64) {
        const raw = new Uint8Array(32);
        crypto.getRandomValues(raw);
        b64 = btoa(String.fromCharCode(...raw));
        await SecureStore.setItemAsync(GPS_KEY_STORE, b64);
      }
      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      _cryptoKey = await crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
      return _cryptoKey;
    })();
  }
  return _keyPromise;
}

export async function encryptCoords(lat: number, lng: number): Promise<string> {
  const key = await getKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plain = new TextEncoder().encode(`${lat},${lng}`);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const out = new Uint8Array(12 + cipher.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipher), 12);
  return btoa(String.fromCharCode(...out));
}

export async function decryptCoords(blob: string): Promise<[number, number] | null> {
  try {
    const key = await getKey();
    const buf = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
    if (buf.length < 29) return null; // 12 IV + 1 min plaintext + 16 tag
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf.slice(0, 12) },
      key,
      buf.slice(12),
    );
    const [lat, lng] = new TextDecoder().decode(plain).split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}
