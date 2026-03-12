import { Play, Square, Cpu, Loader2, Wrench, Download, ExternalLink, CreditCard } from 'lucide-react';
import { CryptoLogs } from './CryptoLogs';
import { UpdateCheck } from './UpdateCheck';
import { formatUptime } from './crypto-formatters';

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
  loading?: boolean;
  starting?: boolean;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
  onOpenWebUI: () => void;
}

export function BtcPayStatusCard({ svc, loading, starting, onInstall, onStart, onStop, onConfigure, onOpenWebUI }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? '#22c55e' : installed ? '#f59e0b' : '#ef4444' }} />
        <CreditCard size={14} style={{ color: '#51b13e' }} />
        <span className="crypto-card-title">BTCPay Server</span>
        {running && <span className="crypto-card-phase">Running</span>}
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title="API Key Setup"><Wrench size={12} /></button>
        )}
        {!loading && installed && running && (
          <button className="crypto-btn-sm" onClick={onOpenWebUI} title="Open WebUI"><ExternalLink size={12} /></button>
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

        {!loading && !installed && (
          <button className="crypto-install-btn" onClick={onInstall}>
            <Download size={14} /> Install BTCPay Server
          </button>
        )}

        {!loading && installed && !running && !starting && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stopped</span>
        )}

        {!loading && (starting || (installed && svc?.phase === 'starting')) && !running && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={12} className="spin" /> Starting up...
            </span>
            <CryptoLogs service="btcpay" active />
          </div>
        )}

        {!loading && running && (
          <>
            <div className="crypto-card-stats">
              <div><span className="dim">Up</span> {formatUptime(svc?.uptime_seconds ?? null)}</div>
              <div><span className="dim">Port</span> 3003</div>
              {svc?.ram_mb != null && (
                <div className="crypto-card-ram" style={{ gridColumn: 'span 2' }}>
                  <Cpu size={11} /> {svc.ram_mb} MB
                </div>
              )}
            </div>
            <CryptoLogs service="btcpay" active />
          </>
        )}

        <UpdateCheck service="btcpay" installed={installed} loading={!!loading} />
      </div>
    </div>
  );
}
