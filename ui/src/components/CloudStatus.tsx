import { useLanguage } from '../state/useLanguage';
import type { CloudSyncStatus } from '../types/cloud';
import './CloudStatus.css';

type CloudState = 'synced' | 'syncing' | 'paused' | 'offline';

// Static icon, hoisted so it isn't rebuilt on every render.
const CLOUD_ICON = (
  <svg
    className="cloud-status__icon"
    viewBox="0 0 24 24"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17.5 19a4.5 4.5 0 0 0 .45-8.98 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 19z" />
  </svg>
);

const STATE_CLASS: Record<CloudState, string> = {
  synced: 'cloud-status--synced',
  syncing: 'cloud-status--syncing',
  paused: 'cloud-status--paused',
  offline: 'cloud-status--offline',
};

const STATE_TEXT_KEY = {
  synced: 'cloudSynced',
  syncing: 'cloudSyncing',
  paused: 'cloudPaused',
  offline: 'cloudOffline',
} as const;

function deriveState(s: CloudSyncStatus | null): CloudState | null {
  if (!s || !s.available || !s.configured) return null; // cloud not set up: hide
  if (!s.linked) return 'offline';
  if (!s.enabled) return 'paused';
  return (s.pending ?? 0) > 0 ? 'syncing' : 'synced';
}

/** Header badge mirroring ConnectionStatus, showing the cloud-sync state. */
export function CloudStatus({ status }: { status: CloudSyncStatus | null }) {
  const { t } = useLanguage();
  const state = deriveState(status);
  if (state === null) return null;

  const pending = status?.pending ?? 0;
  const label = t(STATE_TEXT_KEY[state]);
  const text = state === 'syncing' && pending > 0 ? `${label} ${pending}` : label;
  // Spoken label carries the queue count for VoiceOver and Switch Control; the
  // visible text stays compact. Color is paired with text, so the state still
  // reads in grayscale.
  const spoken =
    state === 'syncing' && pending > 0
      ? `${t('cloudSync')}: ${label}, ${pending} ${t('cloudPending')}`
      : `${t('cloudSync')}: ${label}`;

  // Quiet by default: synced/paused show the icon alone (color carries the
  // state), and only the states that need words — syncing (count) and offline
  // — show text, so the header isn't two near-identical chips.
  const showText = state === 'syncing' || state === 'offline';
  return (
    <div
      className={`cloud-status ${STATE_CLASS[state]}${showText ? '' : ' cloud-status--compact'}`}
      role="status"
      aria-live="polite"
      aria-label={spoken}
      title={spoken}
    >
      {CLOUD_ICON}
      {showText ? <span className="cloud-status__text">{text}</span> : null}
    </div>
  );
}
