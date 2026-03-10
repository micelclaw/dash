import { Play, Square, Zap, Cpu, Loader2, Wrench } from 'lucide-react';
import { CryptoLogs } from './CryptoLogs';

interface LightningInfo {
  id: string;
  alias: string;
  num_channels: number;
  num_active_channels: number;
  num_peers: number;
  total_capacity_sat: number;
  synced_to_chain: boolean;
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
  info: LightningInfo | null;
  loading?: boolean;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

function truncateId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

export function LightningStatusCard({ svc, info, loading, onStart, onStop, onConfigure }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? (info?.synced_to_chain ? '#22c55e' : '#f59e0b') : '#6b7280' }} />
        <Zap size={14} style={{ color: '#f59e0b' }} />
        <span className="crypto-card-title">Core Lightning</span>
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

      {info && (
        <div className="crypto-card-body">
          <div className="crypto-card-stats">
            <div><span className="dim">Node ID</span> {truncateId(info.id)}</div>
            {info.alias && <div><span className="dim">Alias</span> {info.alias}</div>}
            <div><span className="dim">Channels</span> {info.num_active_channels}/{info.num_channels}</div>
            <div><span className="dim">Peers</span> {info.num_peers}</div>
            <div><span className="dim">Capacity</span> {info.total_capacity_sat.toLocaleString()} sat</div>
            <div><span className="dim">Synced</span> {info.synced_to_chain ? 'Yes' : 'No'}</div>
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

      {!loading && !info && running && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Starting up...</span>
          <CryptoLogs service="lightning" active />
        </div>
      )}

      {!loading && !running && !info && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{installed ? 'Stopped' : 'Not installed'}</span>
        </div>
      )}
    </div>
  );
}
