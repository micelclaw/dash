import { useState, useEffect, useCallback } from 'react';
import { Wallet, RefreshCw, Loader2, Link, Zap } from 'lucide-react';
import { api } from '@/services/api';

interface WalletBalance {
  onchain: { confirmed: number; unconfirmed: number };
  lightning: { offchain: number } | null;
}

interface Props {
  btcpayInstalled: boolean;
  btcpayRunning: boolean;
  loading: boolean;
  onInstall: () => void;
  onConnect: () => void;
}

export function WalletBalanceCard({ btcpayInstalled, btcpayRunning, loading, onInstall, onConnect }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    if (!btcpayRunning) return;
    try {
      const res = await api.get<{ data: { connected: boolean } }>('/crypto/btcpay/wallet/status');
      const data = res.data as any;
      setConnected(data.connected);
      return data.connected;
    } catch {
      setConnected(false);
      return false;
    }
  }, [btcpayRunning]);

  const fetchBalance = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await api.get<{ data: WalletBalance }>('/crypto/btcpay/wallet');
      setBalance(res.data as WalletBalance);
    } catch {
      setError('Could not fetch balance');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Check connection + fetch balance on mount and periodically
  useEffect(() => {
    if (!btcpayRunning) {
      setConnected(null);
      setBalance(null);
      return;
    }
    let interval: ReturnType<typeof setInterval>;
    (async () => {
      const isConnected = await checkConnection();
      if (isConnected) {
        await fetchBalance();
        interval = setInterval(fetchBalance, 60_000);
      }
    })();
    return () => clearInterval(interval);
  }, [btcpayRunning, checkConnection, fetchBalance]);

  const formatBtc = (val: number) => {
    if (val === 0) return '0';
    return val.toFixed(8).replace(/\.?0+$/, '');
  };

  const total = balance
    ? balance.onchain.confirmed + (balance.lightning?.offchain ?? 0)
    : 0;

  // Not installed state
  if (!loading && !btcpayInstalled) {
    return (
      <button className="wbc-card wbc-card-action" onClick={onInstall}>
        <Wallet size={18} style={{ color: 'var(--text-muted)' }} />
        <div>
          <div className="wbc-label">Bitcoin Wallet</div>
          <div className="wbc-hint">Install BTCPay Server to manage your wallet</div>
        </div>
        <style>{STYLES}</style>
      </button>
    );
  }

  // Installed but not running
  if (!loading && btcpayInstalled && !btcpayRunning) {
    return (
      <div className="wbc-card">
        <Wallet size={18} style={{ color: 'var(--text-muted)' }} />
        <div>
          <div className="wbc-label">Bitcoin Wallet</div>
          <div className="wbc-hint">BTCPay Server is stopped</div>
        </div>
        <style>{STYLES}</style>
      </div>
    );
  }

  // Loading / checking connection
  if (loading || connected === null) {
    return (
      <div className="wbc-card">
        <Loader2 size={18} className="spin" style={{ color: 'var(--text-muted)' }} />
        <div className="wbc-label">Bitcoin Wallet</div>
        <style>{STYLES}</style>
      </div>
    );
  }

  // Not connected — show connect button
  if (!connected) {
    return (
      <button className="wbc-card wbc-card-action" onClick={onConnect}>
        <Wallet size={18} style={{ color: '#51b13e' }} />
        <div>
          <div className="wbc-label">Bitcoin Wallet</div>
          <div className="wbc-hint">Connect your BTCPay wallet</div>
        </div>
        <div style={{ flex: 1 }} />
        <Link size={13} style={{ color: 'var(--text-muted)' }} />
        <style>{STYLES}</style>
      </button>
    );
  }

  // Connected — show balance
  return (
    <div className="wbc-card">
      <Wallet size={18} style={{ color: '#f7931a' }} />

      <div className="wbc-balance-col">
        <div className="wbc-total">{formatBtc(total)} <span className="wbc-unit">BTC</span></div>
        <div className="wbc-breakdown">
          <span>{formatBtc(balance?.onchain.confirmed ?? 0)} on-chain</span>
          {balance?.onchain.unconfirmed ? (
            <span className="wbc-unconfirmed">+{formatBtc(balance.onchain.unconfirmed)} pending</span>
          ) : null}
          {balance?.lightning ? (
            <span className="wbc-ln"><Zap size={9} /> {formatBtc(balance.lightning.offchain)}</span>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {error && <span className="wbc-error" title={error}>!</span>}

      <button
        className="wbc-refresh"
        onClick={fetchBalance}
        disabled={refreshing}
        title="Refresh balance"
      >
        <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
      </button>

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .wbc-card { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); min-height: 52px; width: 100%; }
  .wbc-card-action { cursor: pointer; text-align: left; }
  .wbc-card-action:hover { background: var(--surface-hover); }
  .wbc-label { font-size: 13px; font-weight: 500; color: var(--text); }
  .wbc-hint { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
  .wbc-balance-col { display: flex; flex-direction: column; gap: 2px; }
  .wbc-total { font-size: 15px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .wbc-unit { font-size: 11px; font-weight: 400; color: var(--text-muted); }
  .wbc-breakdown { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .wbc-unconfirmed { color: #f59e0b; }
  .wbc-ln { display: inline-flex; align-items: center; gap: 2px; color: #f59e0b; }
  .wbc-error { width: 16px; height: 16px; border-radius: 50%; background: rgba(239,68,68,0.15); color: var(--error, #ef4444); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .wbc-refresh { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: none; border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; flex-shrink: 0; }
  .wbc-refresh:hover { background: var(--surface-hover); border-color: var(--border); color: var(--text); }
  .wbc-refresh:disabled { opacity: 0.4; cursor: default; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
