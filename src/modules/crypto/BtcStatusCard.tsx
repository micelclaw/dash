import { Play, Square, Cpu, Loader2, Wrench } from 'lucide-react';
import { CryptoLogs } from './CryptoLogs';

interface BtcSync {
  chain: string;
  blocks: number;
  headers: number;
  verification_progress: number;
  synced: boolean;
  pruned: boolean;
  prune_target_mb: number | null;
  size_on_disk_bytes: number;
  peers: number;
  estimated_time_remaining_s: number | null;
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
  sync: BtcSync | null;
  loading?: boolean;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

function formatEta(seconds: number | null): string {
  if (!seconds) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatUptime(s: number | null): string {
  if (!s) return '-';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  return `${h}h`;
}

function getPhaseLabel(phase: string, sync: BtcSync | null, running: boolean): string {
  if (!running) return phase === 'stopped' ? 'Stopped' : phase;
  if (!sync) return 'Starting...';
  if (sync.synced) return 'Synced';
  return 'Initial Block Download';
}

function formatBlockDate(sync: BtcSync): string | null {
  // The "date" field isn't in our interface, but we can estimate from progress
  // We'll show block age relative to now
  if (sync.synced) return null;
  const pct = sync.verification_progress * 100;
  if (pct < 1) return 'Processing historical blocks';
  if (pct < 50) return 'Downloading & verifying blockchain';
  if (pct < 95) return 'Catching up to chain tip';
  return 'Almost synced';
}

export function BtcStatusCard({ svc, sync, loading, onStart, onStop, onConfigure }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;
  const phase = svc?.phase ?? 'stopped';
  const progress = sync ? Math.round(sync.verification_progress * 100 * 100) / 100 : 0;
  const phaseLabel = getPhaseLabel(phase, sync, running);

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? (sync?.synced ? '#22c55e' : '#f59e0b') : '#6b7280' }} />
        <span className="crypto-card-title">Bitcoin Core</span>
        {!loading && <span className="crypto-card-phase">{phaseLabel}</span>}
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

      {sync && !sync.synced && (
        <div className="crypto-card-body">
          <div className="btc-ibd-banner">
            <div className="btc-ibd-title">
              <Loader2 size={13} className="spin" style={{ color: '#f59e0b' }} />
              <span>{formatBlockDate(sync) ?? 'Syncing blockchain'}</span>
            </div>
            <div className="btc-ibd-pct">{progress}%</div>
          </div>
          <div className="crypto-progress-wrap" style={{ marginTop: 8 }}>
            <div className="crypto-progress-bar" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="crypto-card-stats" style={{ marginTop: 10 }}>
            <div><span className="dim">Block</span> {sync.blocks.toLocaleString()} / {sync.headers.toLocaleString()}</div>
            <div><span className="dim">Peers</span> {sync.peers}</div>
            <div><span className="dim">Chain</span> {sync.chain}</div>
            <div><span className="dim">Disk</span> {formatBytes(sync.size_on_disk_bytes)}</div>
            <div><span className="dim">Mode</span> {sync.pruned ? `Pruned (${sync.prune_target_mb} MB)` : 'Full Node'}</div>
            {sync.estimated_time_remaining_s != null && (
              <div><span className="dim">ETA</span> {formatEta(sync.estimated_time_remaining_s)}</div>
            )}
            <div><span className="dim">Up</span> {formatUptime(sync.uptime_seconds)}</div>
          </div>
          {svc?.ram_mb != null && (
            <div className="crypto-card-ram">
              <Cpu size={11} /> {svc.ram_mb} MB
            </div>
          )}
          <CryptoLogs service="bitcoind" active />
        </div>
      )}

      {sync && sync.synced && (
        <div className="crypto-card-body">
          <div className="crypto-card-stats">
            <div><span className="dim">Block</span> {sync.blocks.toLocaleString()} / {sync.headers.toLocaleString()}</div>
            <div><span className="dim">Peers</span> {sync.peers}</div>
            <div><span className="dim">Chain</span> {sync.chain}</div>
            <div><span className="dim">Disk</span> {formatBytes(sync.size_on_disk_bytes)}</div>
            <div><span className="dim">Mode</span> {sync.pruned ? `Pruned (${sync.prune_target_mb} MB)` : 'Full Node'}</div>
            <div><span className="dim">Up</span> {formatUptime(sync.uptime_seconds)}</div>
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Initializing Bitcoin Core...
          </span>
          <CryptoLogs service="bitcoind" active />
        </div>
      )}

      <style>{`
        .crypto-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .crypto-card-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .crypto-card-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .crypto-card-title { font-weight: 600; color: var(--text); }
        .crypto-card-phase { font-size: 11px; color: var(--text-muted); text-transform: capitalize; }
        .crypto-card-body { padding: 12px 14px; }
        .crypto-card-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 12px; color: var(--text); }
        .crypto-card-stats .dim { color: var(--text-muted); margin-right: 4px; }
        .crypto-card-ram { display: flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 11px; color: var(--text-muted); }
        .crypto-progress-wrap { position: relative; height: 6px; background: var(--border); border-radius: 3px; margin-bottom: 10px; overflow: hidden; }
        .crypto-progress-bar { height: 100%; background: #f59e0b; border-radius: 3px; transition: width .5s ease; }
        .crypto-progress-label { position: absolute; right: 0; top: -16px; font-size: 11px; color: var(--text-muted); }
        .crypto-btn-sm { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; }
        .crypto-btn-sm:hover { background: var(--surface-hover); color: var(--text); }
        .btc-ibd-banner { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .btc-ibd-title { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #f59e0b; font-weight: 500; }
        .btc-ibd-pct { font-size: 18px; font-weight: 700; color: #f59e0b; font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}
