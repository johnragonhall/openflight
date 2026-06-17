import type { A11yPrefs } from '../state/useAccessibilitySettings';
import type { CloudSyncStatus } from '../types/cloud';
import { useLanguage } from '../state/useLanguage';
import { A11yToggleRow, SettingsPanel } from './SettingsPanel';

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: A11yPrefs;
  onToggle: (key: keyof A11yPrefs, value: boolean) => void;
  /** Nav-tab visibility toggles - kiosk/TV shell only (never the /display view). */
  showCameraTab: boolean;
  onToggleCameraTab: (visible: boolean) => void;
  showDebugTab: boolean;
  onToggleDebugTab: (visible: boolean) => void;
  /** Cloud-sync status pushed by the server, or null until it arrives. */
  cloudStatus: CloudSyncStatus | null;
  onToggleCloudSync: (enabled: boolean) => void;
}

/**
 * SettingsPanel for the interactive kiosk/TV shell. Wraps the a11y-only base
 * panel and injects the Camera/Debug nav-tab toggles, which the passive
 * /display scoreboard has no use for. Keeps the tab-toggle contract explicit
 * and type-safe rather than threaded through optional props on the base.
 */
export function KioskSettingsPanel({
  open,
  onClose,
  prefs,
  onToggle,
  showCameraTab,
  onToggleCameraTab,
  showDebugTab,
  onToggleDebugTab,
  cloudStatus,
  onToggleCloudSync,
}: Props) {
  const { t } = useLanguage();
  const cloudShown = !!(cloudStatus?.available && cloudStatus.configured);
  return (
    <SettingsPanel
      open={open}
      onClose={onClose}
      prefs={prefs}
      onToggle={onToggle}
      extraSections={
        <>
          <div className="a11y-panel__section-label">{t('cameraSection')}</div>
          <A11yToggleRow
            label={t('cameraTab')}
            sub={t('cameraTabSub')}
            checked={showCameraTab}
            onToggle={onToggleCameraTab}
          />
          <A11yToggleRow
            label={t('debugTab')}
            sub={t('debugTabSub')}
            checked={showDebugTab}
            onToggle={onToggleDebugTab}
            last={!cloudShown}
          />
          {cloudShown ? (
            <>
              <div className="a11y-panel__section-label">{t('cloudSection')}</div>
              <CloudSyncSettings status={cloudStatus!} onToggle={onToggleCloudSync} />
            </>
          ) : null}
        </>
      }
    />
  );
}

/** Cloud-sync settings: an uploads toggle and queue summary, or a link hint. */
function CloudSyncSettings({
  status,
  onToggle,
}: {
  status: CloudSyncStatus;
  onToggle: (enabled: boolean) => void;
}) {
  const { t } = useLanguage();
  if (!status.linked) {
    return (
      <p className="cloud-settings__hint" role="note">
        {t('cloudNotLinkedHint')}
      </p>
    );
  }
  const pending = status.pending ?? 0;
  const pushed = status.pushed ?? 0;
  const parked = status.parked ?? 0;
  return (
    <>
      <A11yToggleRow
        label={t('cloudUploads')}
        sub={t('cloudUploadsSub')}
        checked={!!status.enabled}
        onToggle={onToggle}
        last
      />
      <p className="cloud-settings__counts">
        <span>
          <b className="cloud-settings__n">{pending}</b> {t('cloudPending')}
        </span>
        <span className="cloud-settings__sep" aria-hidden="true">
          ·
        </span>
        <span>
          <b className="cloud-settings__n">{pushed}</b> {t('cloudPushed')}
        </span>
        {parked > 0 ? (
          <>
            <span className="cloud-settings__sep" aria-hidden="true">
              ·
            </span>
            <span className="cloud-settings__parked">
              <b className="cloud-settings__n">{parked}</b> {t('cloudParked')}
            </span>
          </>
        ) : null}
      </p>
    </>
  );
}
