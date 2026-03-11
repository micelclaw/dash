import { Play, Square, AlertTriangle, Cpu, Loader2, Wrench, Download } from 'lucide-react';
import { CryptoLogs } from './CryptoLogs';

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
  btcPruned: boolean;
  loading?: boolean;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

export function ElectrsStatusCard({ svc, btcPruned, loading, onInstall, onStart, onStop, onConfigure }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? '#22c55e' : installed ? '#f59e0b' : '#ef4444' }} />
        <span className="crypto-card-title">Electrum Server</span>
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title="Settings"><Wrench size={12} /></button>
        )}
        {!loading && installed && (running ? (
          <button className="crypto-btn-sm" onClick={onStop} title="Stop"><Square size={12} /></button>
        ) : (
          <button className="crypto-btn-sm" onClick={onStart} title="Start">
            <Play size={12} />
          </button>
        ))}
      </div>

      <div className="crypto-card-body">
        {loading && !svc && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Checking...
          </span>
        )}

        {!loading && btcPruned && !running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--amber, #f59e0b)' }}>
            <AlertTriangle size={13} />
            Requires Bitcoin Core full node (prune=0, txindex=1)
          </div>
        )}

        {!loading && running && (
          <>
            <div className="crypto-card-stats">
              <div><span className="dim">Status</span> Running</div>
              <div><span className="dim">Port</span> 50001</div>
              {svc?.ram_mb != null && (
                <div className="crypto-card-ram" style={{ gridColumn: 'span 2' }}>
                  <Cpu size={11} /> {svc.ram_mb} MB
                </div>
              )}
            </div>
            <CryptoLogs service="electrs" active />
          </>
        )}

        {!loading && !running && !btcPruned && installed && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stopped</span>
        )}

        {!loading && !installed && !btcPruned && (
          <button className="crypto-install-btn" onClick={onInstall}>
            <Download size={14} /> Install Electrum Server
          </button>
        )}
      </div>
    </div>
  );
}
