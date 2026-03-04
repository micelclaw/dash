import { useState, useEffect } from 'react';
import { RefreshCw, Settings, Pause, Play, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';

// ─── Connector icons (inline SVG) ────────────────────────

function ConnectorIcon({ type, size = 20 }: { type: string; size?: number }) {
  if (type.startsWith('google') || type === 'gmail') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  }
  if (type === 'caldav' || type === 'carddav' || type.includes('synology')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="#e87e04" strokeWidth="2"/>
        <text x="12" y="16" textAnchor="middle" fill="#e87e04" fontSize="10" fontWeight="bold">S</text>
      </svg>
    );
  }
  // IMAP generic
  return <RefreshCw size={size} style={{ color: 'var(--info)' }} />;
}

// ─── Connector display labels ────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  'google-calendar': 'Google Calendar',
  'google-contacts': 'Google Contacts',
  'imap-generic': 'IMAP Email',
  caldav: 'CalDAV',
  carddav: 'CardDAV',
};

const STATUS_COLORS: Record<string, string> = {
  connected: '#22c55e',
  syncing: 'var(--amber)',
  error: 'var(--error)',
  paused: 'var(--text-muted)',
  disconnected: 'var(--text-muted)',
};

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ───────────────────────────────────────────

interface ConnectorCardProps {
  connector: {
    id: string;
    connector_type: string;
    display_name: string | null;
    name: string;
    domains: string[];
    status: string;
    last_sync_at: string | null;
    errors_count: number;
  };
  onRefresh: () => void;
  onConfigure?: (id: string) => void;
}

export function ConnectorCard({ connector, onRefresh, onConfigure }: ConnectorCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total?: number; folder?: string; phase?: string } | null>(null);

  // Listen for sync progress WS events
  const progressEvent = useWebSocket('sync.progress');
  const completedEvent = useWebSocket('sync.completed');

  useEffect(() => {
    if (progressEvent?.data?.connector_id === connector.id) {
      setProgress(progressEvent.data as any);
      if (!syncing) setSyncing(true);
    }
  }, [progressEvent, connector.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!completedEvent) return;
    // Clear syncing state when this connector's sync completes
    if (completedEvent.data?.connector_id === connector.id) {
      setProgress(null);
      setSyncing(false);
      onRefresh();
    }
  }, [completedEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = connector.display_name || TYPE_LABELS[connector.connector_type] || connector.name;
  const statusColor = STATUS_COLORS[connector.status] ?? 'var(--text-muted)';

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(`/sync/connectors/${connector.id}/run`);
      toast.success(`Sync started: ${label}`);
    } catch {
      toast.error('Failed to start sync');
    }
    // Keep spinner for 3s to give visual feedback
    setTimeout(() => { setSyncing(false); onRefresh(); }, 3000);
  };

  const handleTogglePause = async () => {
    try {
      const isSyncing = syncing || connector.status === 'syncing';
      if (connector.status === 'paused') {
        // Resume — trigger immediate sync
        await api.post(`/sync/connectors/${connector.id}/resume`);
        toast.success(`Resumed: ${label}`);
      } else {
        // Pause — will also abort running sync if active
        await api.post(`/sync/connectors/${connector.id}/pause`);
        if (isSyncing) {
          setSyncing(false);
          setProgress(null);
          toast.success(`Sync cancelled: ${label}`);
        } else {
          toast.success(`Paused: ${label}`);
        }
      }
      onRefresh();
    } catch {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Disconnect ${label}? This will stop syncing.`)) return;
    try {
      await api.delete(`/sync/connectors/${connector.id}`);
      toast.success(`Disconnected: ${label}`);
      onRefresh();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const iconBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none',
    color: 'var(--text-dim)', cursor: 'pointer',
    padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)',
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'border-color var(--transition-fast)',
    }}>
      {/* Top: icon + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ConnectorIcon type={connector.connector_type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {connector.domains.join(', ')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
          }} />
          <span style={{ fontSize: '0.6875rem', color: statusColor, textTransform: 'capitalize' }}>
            {connector.status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {syncing && progress && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{
            height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--amber)',
              width: progress.total ? `${Math.min(100, (progress.processed / progress.total) * 100)}%` : '50%',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
            {progress.phase ?? 'Syncing'}: {progress.processed}{progress.total ? `/${progress.total}` : ''}{progress.folder ? ` (${progress.folder})` : ''}
          </span>
        </div>
      )}

      {/* Bottom: last sync + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {syncing && !progress ? 'Syncing...' : `Last sync: ${timeAgo(connector.last_sync_at)}`}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={handleSync}
            disabled={syncing || connector.status === 'syncing'}
            style={{ ...iconBtnStyle, opacity: syncing ? 0.5 : 1 }}
            title="Sync now"
          >
            {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          </button>
          <button
            onClick={handleTogglePause}
            style={{
              ...iconBtnStyle,
              color: (syncing || connector.status === 'syncing')
                ? 'var(--amber)'
                : connector.status === 'paused'
                  ? '#22c55e'
                  : 'var(--text-dim)',
            }}
            title={
              (syncing || connector.status === 'syncing')
                ? 'Stop sync'
                : connector.status === 'paused'
                  ? 'Resume'
                  : 'Pause'
            }
          >
            {connector.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
          </button>
          {onConfigure && (
            <button onClick={() => onConfigure(connector.id)} style={iconBtnStyle} title="Configure">
              <Settings size={14} />
            </button>
          )}
          <button onClick={handleDelete} style={{ ...iconBtnStyle, color: 'var(--error)' }} title="Disconnect">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
