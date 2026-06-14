import { useEffect, useState } from 'react';
import { useUnitPreference } from '../state/useUnitPreference';
import './HistoryView.css';

interface SessionSummary {
  id: string;
  started_at: string | null;
  filename: string;
  shot_count: number;
  max_ball_speed: number | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function HistoryView() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { unitSystem } = useUnitPreference();

  useEffect(() => {
    setLoading(true);
    fetch('/api/history')
      .then((r) => r.json())
      .then((d) => { setSessions(d.sessions ?? []); setLoading(false); })
      .catch(() => { setError('Could not load history.'); setLoading(false); });
  }, []);

  const speedLabel = unitSystem === 'metric' ? 'km/h' : 'mph';
  const speedFactor = unitSystem === 'metric' ? 1.60934 : 1;

  if (loading) {
    return (
      <div className="history-view history-view--empty">
        <p className="history-view__message">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-view history-view--empty">
        <p className="history-view__message">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="history-view history-view--empty">
        <p className="history-view__message">No sessions recorded yet.</p>
        <p className="history-view__sub">Sessions appear here after your first shot.</p>
      </div>
    );
  }

  return (
    <div className="history-view">
      <h2 className="history-view__heading">Past Sessions</h2>
      <ul className="history-list" role="list">
        {sessions.map((s) => {
          const speed = s.max_ball_speed != null
            ? `${(s.max_ball_speed * speedFactor).toFixed(0)} ${speedLabel}`
            : null;
          return (
            <li key={s.id} className="history-card">
              <div className="history-card__meta">
                <span className="history-card__date">{formatDate(s.started_at)}</span>
                <span className="history-card__shots">{s.shot_count} shots</span>
              </div>
              {speed && (
                <div className="history-card__stat">
                  <span className="history-card__stat-label">Best ball speed</span>
                  <span className="history-card__stat-value">{speed}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
