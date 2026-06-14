import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { ShotDisplay } from './components/ShotDisplay';
import { StatsView } from './components/StatsView';
import { ShotList } from './components/ShotList';
import { DebugPanel } from './components/DebugPanel';
import { CameraFeed } from './components/CameraFeed';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ClubPicker } from './components/ClubPicker';
import { ClubSelectScreen } from './components/ClubSelectScreen';
import { BallDetectionIndicator } from './components/BallDetectionIndicator';
import { DisplayMode } from './components/DisplayMode';
import { AccessibilityPanel, AccessibilityTrigger } from './components/AccessibilityPanel';
import { HistoryView } from './components/HistoryView';
import { useAccessibilitySettings } from './state/useAccessibilitySettings';
import {
  LaunchDaddyProvider,
  useLaunchDaddy,
  LaunchDaddyOverlay,
  LaunchDaddyBrand,
  LaunchDaddySecretIndicator,
} from './components/LaunchDaddy';
import { ShotProvider } from './state/ShotProvider';
import { UnitPreferenceProvider } from './state/UnitPreferenceProvider';
import { useShotContext } from './state/useShotContext';
import { useUnitPreference } from './state/useUnitPreference';

import Logo from './logo/Logo';

import './App.css';

type View = 'live' | 'stats' | 'shots' | 'history' | 'camera' | 'debug';

// Navigation icons as inline SVGs for better control
const Icons = {
  live: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shots: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3M3 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  debug: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function AppContent() {
  const {
    connected,
    adminToken,
    mockMode,
    debugMode,
    debugReadings,
    debugShotLogs,
    radarConfig,
    cameraStatus,
    triggerDiagnostics,
    triggerStatus,
    remoteA11yPrefs,
    clearSession,
    setClub,
    simulateShot,
    toggleDebug,
    updateRadarConfig,
    toggleCamera,
    toggleCameraStream,
    shutdown,
  } = useSocket();

  const { prefs: a11yPrefs, setPref: setA11yPref, applyRemote } = useAccessibilitySettings();
  const [a11yPanelOpen, setA11yPanelOpen] = useState(false);

  const { latestShot, shots, isNewShot, shotVersion } = useShotContext();

  const [currentView, setCurrentView] = useState<View>('live');
  const [selectedClub, setSelectedClub] = useState('driver');
  // Shown on every app load so the user confirms their club before the first
  // shot (skippable, keeps the default). The /display route returns early
  // below, so this interstitial never appears in the passive TV view.
  const [showClubSelect, setShowClubSelect] = useState(true);
  const [showShutdown, setShowShutdown] = useState(false);
  const { isLaunchDaddyMode, isExploding, triggerExplosion, handleSecretTap } = useLaunchDaddy();
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const isDisplayRoute =
    typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/display';

  // Trigger explosion when a new shot is detected in Launch Daddy mode
  useEffect(() => {
    if (isNewShot && isLaunchDaddyMode) {
      triggerExplosion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shotVersion triggers the effect; isNewShot is only a guard
  }, [shotVersion, isLaunchDaddyMode, triggerExplosion]);

  // Apply remote a11y prefs when received from mobile app
  useEffect(() => {
    if (remoteA11yPrefs) applyRemote(remoteA11yPrefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteA11yPrefs]);

  const handleClubChange = (club: string) => {
    setSelectedClub(club);
    setClub(club);
  };

  if (isDisplayRoute) {
    return (
      <DisplayMode
        connected={connected}
        cameraStatus={cameraStatus}
        latestShot={latestShot}
        shots={shots}
      />
    );
  }

  return (
    <div className={`app ${isLaunchDaddyMode ? 'app--launch-daddy' : ''} ${isExploding ? 'app--exploding' : ''}`}>
      {showClubSelect && (
        <ClubSelectScreen
          selectedClub={selectedClub}
          onSelect={(club) => {
            handleClubChange(club);
            setShowClubSelect(false);
          }}
          onSkip={() => setShowClubSelect(false)}
        />
      )}

      {/* Launch Daddy Overlay */}
      <LaunchDaddyOverlay />
      <LaunchDaddySecretIndicator />

      <header className="header">
        {/* Secret activation area - click/tap 5 times quickly */}
        <div
          className="header__secret-tap"
          onClick={handleSecretTap}
          onKeyDown={(e) => e.key === 'Enter' && handleSecretTap()}
          role="button"
          tabIndex={0}
          style={{
            padding: '8px',
            cursor: 'pointer',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
          }}
        >
          {isLaunchDaddyMode ? <LaunchDaddyBrand /> : <Logo size="small" variant="light" />}
        </div>
        <div className="header__controls">
          <div className="unit-toggle" role="group" aria-label="Display units">
            <button
              type="button"
              className={`unit-toggle__button ${unitSystem === 'imperial' ? 'unit-toggle__button--active' : ''}`}
              onClick={() => setUnitSystem('imperial')}
              aria-pressed={unitSystem === 'imperial'}
            >
              MPH/YDS
            </button>
            <button
              type="button"
              className={`unit-toggle__button ${unitSystem === 'metric' ? 'unit-toggle__button--active' : ''}`}
              onClick={() => setUnitSystem('metric')}
              aria-pressed={unitSystem === 'metric'}
            >
              KMH/M
            </button>
          </div>
          <ClubPicker selectedClub={selectedClub} onClubChange={handleClubChange} />
          <BallDetectionIndicator
            available={cameraStatus.available}
            enabled={cameraStatus.enabled}
            detected={cameraStatus.ball_detected}
            confidence={cameraStatus.ball_confidence}
            onToggle={toggleCamera}
          />
          <ConnectionStatus connected={connected} />
          <AccessibilityTrigger open={a11yPanelOpen} onClick={() => setA11yPanelOpen((o) => !o)} />
          <button
            className="power-button"
            onClick={() => setShowShutdown(true)}
            aria-label="Shut down OpenFlight"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <AccessibilityPanel
        open={a11yPanelOpen}
        onClose={() => setA11yPanelOpen(false)}
        prefs={a11yPrefs}
        onToggle={setA11yPref}
      />

      {showShutdown && (
        <div className="shutdown-overlay" role="presentation">
          <div
            className="shutdown-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shutdown-title"
          >
            <p id="shutdown-title">Shut down OpenFlight?</p>
            <div className="shutdown-dialog__buttons">
              <button
                className="shutdown-dialog__confirm"
                onClick={() => { shutdown(); setShowShutdown(false); }}
                aria-label="Confirm shut down"
              >
                Shut Down
              </button>
              <button
                className="shutdown-dialog__cancel"
                onClick={() => setShowShutdown(false)}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="nav" aria-label="Main navigation">
        <button
          className={`nav__button ${currentView === 'live' ? 'nav__button--active' : ''}`}
          onClick={() => setCurrentView('live')}
          aria-current={currentView === 'live' ? 'page' : undefined}
        >
          {Icons.live}
          <span>Live</span>
        </button>
        <button
          className={`nav__button ${currentView === 'stats' ? 'nav__button--active' : ''}`}
          onClick={() => setCurrentView('stats')}
          aria-current={currentView === 'stats' ? 'page' : undefined}
        >
          {Icons.stats}
          <span>Stats</span>
        </button>
        <button
          className={`nav__button ${currentView === 'shots' ? 'nav__button--active' : ''}`}
          onClick={() => setCurrentView('shots')}
          aria-current={currentView === 'shots' ? 'page' : undefined}
          aria-label={shots.length > 0 ? `Shots, ${shots.length} recorded` : 'Shots'}
        >
          {Icons.shots}
          <span aria-hidden="true">Shots</span>
          {shots.length > 0 && <span className="nav__badge" aria-hidden="true">{shots.length}</span>}
        </button>
        <button
          className={`nav__button ${currentView === 'history' ? 'nav__button--active' : ''}`}
          onClick={() => setCurrentView('history')}
          aria-current={currentView === 'history' ? 'page' : undefined}
        >
          {Icons.history}
          <span>History</span>
        </button>
        <button
          className={`nav__button ${currentView === 'camera' ? 'nav__button--active' : ''} ${cameraStatus.streaming ? 'nav__button--streaming' : ''}`}
          onClick={() => setCurrentView('camera')}
          aria-current={currentView === 'camera' ? 'page' : undefined}
          aria-label={cameraStatus.ball_detected ? 'Camera (ball detected)' : 'Camera'}
        >
          {Icons.camera}
          <span aria-hidden="true">Camera</span>
          {cameraStatus.ball_detected && <span className="nav__ball-dot" aria-hidden="true" />}
        </button>
        <button
          className={`nav__button ${currentView === 'debug' ? 'nav__button--active' : ''} ${debugMode ? 'nav__button--recording' : ''}`}
          onClick={() => setCurrentView('debug')}
          aria-current={currentView === 'debug' ? 'page' : undefined}
          aria-label={debugMode ? 'Debug (recording)' : 'Debug'}
        >
          {Icons.debug}
          <span aria-hidden="true">Debug</span>
          {debugMode && <span className="nav__recording-dot" aria-hidden="true" />}
        </button>
      </nav>

      <main className="main">
        {currentView === 'live' && (
          <div className="live-view">
            {isNewShot && <div key={shotVersion} className="shot-flash" />}
            <ShotDisplay key={shotVersion} shot={latestShot} animate={isNewShot} />
            {mockMode && (
              <button className="simulate-button" onClick={simulateShot}>
                Simulate Shot
              </button>
            )}
          </div>
        )}
        {currentView === 'stats' && <StatsView shots={shots} onClearSession={clearSession} />}
        {currentView === 'shots' && <ShotList shots={shots} />}
        {currentView === 'history' && <HistoryView />}
        {currentView === 'camera' && (
          <CameraFeed cameraStatus={cameraStatus} onToggleCamera={toggleCamera} onToggleStream={toggleCameraStream} streamToken={adminToken} />
        )}
        {currentView === 'debug' && (
          <DebugPanel
            enabled={debugMode}
            readings={debugReadings}
            shotLogs={debugShotLogs}
            radarConfig={radarConfig}
            cameraStatus={cameraStatus}
            mockMode={mockMode}
            onToggle={toggleDebug}
            onUpdateConfig={updateRadarConfig}
            triggerDiagnostics={triggerDiagnostics}
            triggerStatus={triggerStatus}
          />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <LaunchDaddyProvider>
      <UnitPreferenceProvider>
        <ShotProvider>
          <AppContent />
        </ShotProvider>
      </UnitPreferenceProvider>
    </LaunchDaddyProvider>
  );
}

export default App;
