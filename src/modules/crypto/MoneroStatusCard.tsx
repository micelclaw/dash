import { Play, Square, Cpu, Loader2, Wrench } from 'lucide-react';
import { CryptoLogs } from './CryptoLogs';

interface MoneroSync {
  height: number;
  target_height: number;
  synced: boolean;
  pruned: boolean;
  size_on_disk_bytes: number;
  peers_in: number;
  peers_out: number;
  uptime_seconds: number | null;
}

interface ServiceStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  phase: string;
}

interface Props {
  svc: ServiceStatus | null;
  sync: MoneroSync | null;
  loading?: boolean;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

export function MoneroStatusCard({ svc, sync, loading, onStart, onStop, onConfigure }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;
  const phase = svc?.phase ?? 'stopped';
  const progress = sync && sync.target_height > 0
    ? Math.round((sync.height / sync.target_height) * 100 * 100) / 100
    : 0;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? (sync?.synced ? '#22c55e' : '#f59e0b') : '#6b7280' }} />
        <span className="crypto-card-title">Monero Node</span>
        {!loading && <span className="crypto-card-phase">{phase}</span>}
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title="Settings"><Wrench size={12} /></button>
        )}
        {!loading && (running ? (
          <button className="crypto-btn-sm" onClick={onStop} title="Stop"><Square size={12} /></button>
        ) : (
          <button className="crypto-btn-sm" onClick={onStart} title={installed ? 'Start' : 'Install & Start'}>
            <Play size={12} />
          </button>
        ))}
      </div>

      {sync && (
        <div className="crypto-card-body">
          {!sync.synced && (
            <div className="crypto-progress-wrap">
              <div className="crypto-progress-bar" style={{ width: `${Math.min(progress, 100)}%`, background: '#f97316' }} />
              <span className="crypto-progress-label">{progress}%</span>
            </div>
          )}
          <div className="crypto-card-stats">
            <div><span className="dim">Height</span> {sync.height.toLocaleString()} / {sync.target_height.toLocaleString()}</div>
            <div><span className="dim">Peers</span> in: {sync.peers_in} out: {sync.peers_out}</div>
            <div><span className="dim">Pruned</span> {sync.pruned ? 'Yes' : 'No'}</div>
            <div><span className="dim">Disk</span> {formatBytes(sync.size_on_disk_bytes)}</div>
          </div>
          {svc?.ram_mb != null && (
            <div className="crypto-card-ram">
              <Cpu size={11} /> {svc.ram_mb} MB
            </div>
          )}
        </div>
      )}

      {loading && !svc && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Checking...
          </span>
        </div>
      )}

      {!loading && !sync && running && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Starting up...</span>
          <CryptoLogs service="monerod" active />
        </div>
      )}

      {sync && !sync.synced && (
        <div style={{ padding: '0 14px 12px' }}>
          <CryptoLogs service="monerod" active />
        </div>
      )}

      {!loading && !running && !sync && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{installed ? 'Stopped' : 'Not installed'}</span>
        </div>
      )}
    </div>
  );
}
