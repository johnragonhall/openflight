import { useEffect, useRef } from 'react';
import type { A11yPrefs } from '../state/useAccessibilitySettings';
import './AccessibilityPanel.css';

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: A11yPrefs;
  onToggle: (key: keyof A11yPrefs, value: boolean) => void;
}

export function AccessibilityPanel({ open, onClose, prefs, onToggle }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <div ref={panelRef} className={`a11y-panel ${open ? 'a11y-panel--open' : ''}`} role="dialog" aria-label="Accessibility settings" aria-modal="true">
      <div className="a11y-panel__header">
        <span className="a11y-panel__title">Accessibility</span>
        <button className="a11y-panel__close" onClick={onClose} aria-label="Close accessibility panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="a11y-panel__section-label">MOTION</div>
      <label className="a11y-panel__row">
        <div className="a11y-panel__row-text">
          <span className="a11y-panel__row-label">Reduce Motion</span>
          <span className="a11y-panel__row-sub">Disable looping and entrance animations</span>
        </div>
        <button
          role="switch"
          aria-checked={prefs.reduceMotion}
          className={`a11y-toggle ${prefs.reduceMotion ? 'a11y-toggle--on' : ''}`}
          onClick={() => onToggle('reduceMotion', !prefs.reduceMotion)}
          aria-label="Reduce Motion"
        >
          <span className="a11y-toggle__thumb" />
        </button>
      </label>

      <div className="a11y-panel__section-label">DISPLAY</div>
      <label className="a11y-panel__row">
        <div className="a11y-panel__row-text">
          <span className="a11y-panel__row-label">High Contrast</span>
          <span className="a11y-panel__row-sub">Increase contrast for text and borders</span>
        </div>
        <button
          role="switch"
          aria-checked={prefs.highContrast}
          className={`a11y-toggle ${prefs.highContrast ? 'a11y-toggle--on' : ''}`}
          onClick={() => onToggle('highContrast', !prefs.highContrast)}
          aria-label="High Contrast"
        >
          <span className="a11y-toggle__thumb" />
        </button>
      </label>
      <label className="a11y-panel__row a11y-panel__row--last">
        <div className="a11y-panel__row-text">
          <span className="a11y-panel__row-label">Larger Text</span>
          <span className="a11y-panel__row-sub">Increase base font size</span>
        </div>
        <button
          role="switch"
          aria-checked={prefs.largeText}
          className={`a11y-toggle ${prefs.largeText ? 'a11y-toggle--on' : ''}`}
          onClick={() => onToggle('largeText', !prefs.largeText)}
          aria-label="Larger Text"
        >
          <span className="a11y-toggle__thumb" />
        </button>
      </label>

      <p className="a11y-panel__footer">Settings sync from the mobile app when connected.</p>
    </div>
  );
}

interface TriggerProps {
  open: boolean;
  onClick: () => void;
}

export function AccessibilityTrigger({ open, onClick }: TriggerProps) {
  return (
    <button
      className={`a11y-trigger ${open ? 'a11y-trigger--active' : ''}`}
      onClick={onClick}
      aria-label="Accessibility settings"
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v7M8 10h8M9 17l-2 4M15 17l2 4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
