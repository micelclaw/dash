import { Loader2, Play, Square, Settings, ExternalLink } from 'lucide-react';

interface AppStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

interface Props {
  app: AppStatus | null;
  loading: boolean;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  description: string;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onNavigate: () => void;
}

function formatUptime(seconds: number | null): string {
  if (seconds == null) return '';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function MultimediaStatusCard({ app, loading, icon: Icon, color, description, onInstall, onStart, onStop, onNavigate }: Props) {
  const installed = app?.installed ?? false;
  const running = app?.running ?? false;

  return (
    <div className="mm-status-card">
      <div className="mm-card-header">
        <Icon size={18} style={{ color }} />
        <div style={{ flex: 1 }}>
          <div className="mm-card-name">{app?.display_name ?? '...'}</div>
          <div className="mm-card-desc">{description}</div>
        </div>
        {loading ? (
          <Loader2 size={13} className="mm-spin" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <span className="mm-status-dot" style={{ background: running ? '#22c55e' : installed ? '#6b7280' : '#ef4444' }} />
        )}
      </div>

      {!loading && installed && (
        <div className="mm-card-meta">
          {running && app?.ram_mb != null && <span>RAM: {app.ram_mb} MB</span>}
          {running && app?.uptime_seconds != null && <span>Up: {formatUptime(app.uptime_seconds)}</span>}
          {!running && <span style={{ color: 'var(--text-muted)' }}>Stopped</span>}
        </div>
      )}

      <div className="mm-card-actions">
        {!installed && !loading && (
          <button className="mm-btn mm-btn-install" style={{ background: color }} onClick={onInstall}>
            Install
          </button>
        )}
        {installed && !running && (
          <button className="mm-btn mm-btn-start" onClick={onStart}>
            <Play size={12} /> Start
          </button>
        )}
        {installed && running && (
          <>
            <button className="mm-btn mm-btn-open" onClick={onNavigate}>
              <ExternalLink size={12} /> Open
            </button>
            <button className="mm-btn mm-btn-stop" onClick={onStop}>
              <Square size={12} /> Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
}
