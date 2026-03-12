import { useNavigate } from 'react-router';
import { CreditCard, ExternalLink, Loader2, Play, Square, Download, Wrench } from 'lucide-react';
import type { BtcPayInfo } from './BtcPayStatusCard';

interface ServiceStatus {
  name: string;
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
  info: BtcPayInfo | null;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

const formatBtc = (val: number) => {
  if (val === 0) return '0';
  return val.toFixed(8).replace(/\.?0+$/, '');
};

export function BtcPayCard({ svc, loading, starting, info, onInstall, onStart, onStop, onConfigure }: Props) {
  const navigate = useNavigate();
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;

  const store = info?.stores?.[0];
  const wallet = store?.wallet;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? '#22c55e' : installed ? '#f59e0b' : '#ef4444' }} />
        <CreditCard size={14} style={{ color: '#51b13e' }} />
        <span className="crypto-card-title">Bitcoin Wallet</span>
        {running && <span className="crypto-card-phase">Running</span>}
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title="API Key Setup"><Wrench size={12} /></button>
        )}
        {!loading && installed && (running ? (
          <button className="crypto-btn-sm" onClick={onStop} title="Stop"><Square size={12} /></button>
        ) : (
          <button className="crypto-btn-sm" onClick={onStart} title="Start"><Play size={12} /></button>
        ))}
      </div>

      <div className="crypto-card-body">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          BTCPay Server
        </div>

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
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Starting up...
          </span>
        )}

        {!loading && running && (
          <>
            <div className="bpc-balance">
              <div>
                <span className="bpc-label">On-chain</span>
                <span className="bpc-val">{wallet ? `${formatBtc(wallet.onchain_confirmed)} BTC` : '— BTC'}</span>
              </div>
              <div>
                <span className="bpc-label">Lightning</span>
                <span className="bpc-val">{wallet?.lightning != null ? `${formatBtc(wallet.lightning)} BTC` : '— sats'}</span>
              </div>
            </div>

            <button className="bpc-open-btn" onClick={() => window.open('http://localhost:3003', '_blank', 'noopener,noreferrer')}>
              <ExternalLink size={11} /> Open BTCPay
            </button>
          </>
        )}
      </div>

      <style>{`
        .bpc-balance { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; font-variant-numeric: tabular-nums; }
        .bpc-label { font-size: 11px; color: var(--text-muted); margin-right: 6px; }
        .bpc-val { font-size: 13px; font-weight: 500; color: var(--text); }
        .bpc-open-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .bpc-open-btn:hover { background: var(--surface-hover); color: var(--text); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
