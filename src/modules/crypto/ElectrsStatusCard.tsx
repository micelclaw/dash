import { Play, Square, AlertTriangle, Cpu, Loader2, Wrench } from 'lucide-react';
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
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

export function ElectrsStatusCard({ svc, btcPruned, loading, onStart, onStop, onConfigure }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? '#22c55e' : '#6b7280' }} />
        <span className="crypto-card-title">Electrum Server</span>
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title="Settings"><Wrench size={12} /></button>
        )}
        {!loading && (running ? (
          <button className="crypto-btn-sm" onClick={onStop} title="Stop"><Square size={12} /></button>
        ) : (
          <button
            className="crypto-btn-sm"
            onClick={onStart}
            title={btcPruned ? 'Requires full node' : installed ? 'Start' : 'Install & Start'}
            disabled={btcPruned}
            style={btcPruned ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
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

        {!loading && !running && !btcPruned && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{installed ? 'Stopped' : 'Not installed'}</span>
        )}
      </div>
    </div>
  );
}
