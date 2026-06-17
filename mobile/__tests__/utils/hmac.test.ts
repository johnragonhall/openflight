import { sha256, hmacSha256Hex, computeHmac, utf8Bytes } from '../../src/utils/hmac';

function fromHex(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g) ?? [];
  return Uint8Array.from(pairs.map((b) => parseInt(b, 16)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('sha256', () => {
  it('matches the FIPS 180-4 vector for "abc"', () => {
    expect(toHex(sha256(utf8Bytes('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the vector for the empty string', () => {
    expect(toHex(sha256(new Uint8Array(0)))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('hmacSha256Hex (RFC 4231 known-answer vectors)', () => {
  it('Test Case 1: 20-byte 0x0b key, "Hi There"', () => {
    const key = new Uint8Array(20).fill(0x0b);
    expect(hmacSha256Hex(key, utf8Bytes('Hi There'))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
  });

  it('Test Case 2: "Jefe" key, "what do ya want for nothing?"', () => {
    expect(hmacSha256Hex(utf8Bytes('Jefe'), utf8Bytes('what do ya want for nothing?'))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('Test Case 3: long key (longer than the 64-byte block) is hashed first', () => {
    const key = new Uint8Array(131).fill(0xaa);
    expect(
      hmacSha256Hex(key, utf8Bytes('Test Using Larger Than Block-Size Key - Hash Key First')),
    ).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
  });
});

describe('computeHmac', () => {
  it('matches an independent HMAC oracle for a 32-byte secret + nonce', () => {
    const secret = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    expect(computeHmac(secret, 'abcdef0123456789')).toBe(
      'f1dd777cfe33344e68c5bccfffe5c0b083130eb509fcd6093ee5abcee3b58cc7',
    );
  });

  it('is self-consistent with the lower-level primitive', () => {
    const secret = 'deadbeef'.repeat(8); // 32 bytes
    const nonce = 'a3f9c1';
    expect(computeHmac(secret, nonce)).toBe(
      hmacSha256Hex(fromHex(secret), utf8Bytes(nonce)),
    );
  });

  it('produces a 64-char lowercase hex digest', () => {
    const digest = computeHmac('11'.repeat(32), 'nonce');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('throws when the secret is not exactly 32 bytes', () => {
    expect(() => computeHmac('abcd', 'nonce')).toThrow('Invalid pairing secret format');
    expect(() => computeHmac('zz'.repeat(32), 'nonce')).not.toThrow();
  });
});
