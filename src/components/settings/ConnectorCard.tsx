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
  if (type === 'slack-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z" fill="#E01E5A"/>
        <path d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z" fill="#36C5F0"/>
        <path d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312z" fill="#2EB67D"/>
        <path d="M15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#ECB22E"/>
      </svg>
    );
  }
  if (type === 'discord-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    );
  }
  if (type === 'telegram-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#0088cc"/>
        <path d="M5.4 11.6l10.1-4.3c.5-.2.9.1.7.7L14.5 16c-.2.5-.6.6-1 .4l-2.8-2.1-1.3 1.3c-.1.1-.3.2-.5.2l.2-2.8 5.1-4.6c.2-.2 0-.3-.3-.1L7.6 13.2l-2.7-.8c-.6-.2-.6-.6.1-.8z" fill="white"/>
      </svg>
    );
  }
  if (type === 'teams-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="1" y="4" width="14" height="16" rx="2" fill="#6264a7"/>
        <text x="8" y="15" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">T</text>
        <circle cx="19" cy="7" r="3.5" fill="#6264a7"/>
        <rect x="15.5" y="11" width="7" height="7" rx="1.5" fill="#6264a7" opacity="0.8"/>
      </svg>
    );
  }
  if (type === 'signal-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#3a76f0"/>
        <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5 0 .97.25 1.88.7 2.67L6.5 17.5l2.83-.7c.79.45 1.7.7 2.67.7 3.04 0 5.5-2.46 5.5-5.5S15.04 6.5 12 6.5z" fill="white"/>
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
  'slack-observer': 'Slack',
  'discord-observer': 'Discord',
  'telegram-observer': 'Telegram',
  'teams-observer': 'Teams',
  'signal-observer': 'Signal',
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
