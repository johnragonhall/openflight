import { memo, useCallback, useEffect, useRef, useState } from 'react';

interface PairPayload {
  v: 1;
  s: string;
  h: string;
  p: number;
}

type State = 'idle' | 'loading' | 'ready' | 'error';

export const PairingQR = memo(function PairingQR() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  const generate = useCallback(async () => {
    setState('loading');
    setError('');

    let payload: PairPayload;
    try {
      const res = await fetch('/api/pair-qr', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      payload = await res.json() as PairPayload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pairing data');
      setState('error');
      return;
    }

    try {
      const QRCode: typeof import('qrcode') = await import('qrcode');
      const canvas = canvasRef.current;
      if (!canvas) { setError('Canvas not ready'); setState('error'); return; }
      await QRCode.toCanvas(canvas, JSON.stringify(payload), {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      setState('ready');
    } catch {
      setError('Failed to render QR code');
      setState('error');
    }
  }, []);

  useEffect(() => {
    return () => {
      // Clear the canvas when unmounted to avoid stale secret being visible.
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, []);

  return (
    <div style={styles.root}>
      <p style={styles.label}>Pair Mobile App</p>
      <p style={styles.hint}>
        Open the OpenFlight mobile app, go to Connection → Bluetooth → Scan QR to Pair, then show
        this code.
      </p>
      {state === 'idle' && (
        <button type="button" style={styles.btn} onClick={generate}>
          Show Pairing QR
        </button>
      )}
      {state === 'loading' && <p style={styles.sub}>Generating…</p>}
      {state === 'error' && (
        <>
          <p style={{ ...styles.sub, color: '#ef4444' }}>{error}</p>
          <button type="button" style={styles.btn} onClick={generate}>
            Retry
          </button>
        </>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: state === 'ready' ? 'block' : 'none',
          margin: '12px auto 0',
          borderRadius: 8,
        }}
      />
      {state === 'ready' && (
        <button type="button" style={{ ...styles.btn, marginTop: 10 }} onClick={() => setState('idle')}>
          Hide QR
        </button>
      )}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  root: {
    background: 'var(--surface-1, #1a1a1a)',
    borderRadius: 10,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--line, #2a2a2a)',
  },
  label: {
    color: 'var(--text, #f5f5f5)',
    fontWeight: 700,
    fontSize: 14,
    margin: 0,
  },
  hint: {
    color: 'var(--sub, #888)',
    fontSize: 12,
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.5,
    maxWidth: 280,
  },
  sub: {
    color: 'var(--sub, #888)',
    fontSize: 12,
    margin: 0,
  },
  btn: {
    background: 'var(--accent, #22c55e)',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
};
