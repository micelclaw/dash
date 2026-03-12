/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import { api } from '@/services/api';
import { useWalletBalance, type AccountBalance } from '../hooks/useWalletBalance';
import { useFiatPrice } from '../hooks/useFiatPrice';
import { formatRelativeTime } from '../../../shared/crypto-formatters';

interface TransferEntry {
  txid: string;
  height: number;
  timestamp: number;
  amount: number;
  fee: number;
  type: string;
  confirmations: number;
  address: string;
}

interface WalletStatus {
  rpc_reachable: boolean;
  active_wallet: string | null;
  height: number | null;
  version: number | null;
}

function picoToXmr(p: number): string {
  return (p / 1e12).toFixed(6);
}

function truncHash(h: string): string {
  if (h.length <= 18) return h;
  return `${h.slice(0, 8)}...${h.slice(-8)}`;
}

export function OverviewTab() {
  const { balance, isLoading: balLoading, refresh: refreshBalance } = useWalletBalance();
  const { convertXmr } = useFiatPrice();
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [recentTxs, setRecentTxs] = useState<TransferEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, txsRes] = await Promise.allSettled([
        api.get<{ data: WalletStatus }>('/crypto/monero-wallet/status'),
        api.post<{ data: { result: { in?: TransferEntry[]; out?: TransferEntry[] } } }>('/crypto/monero-wallet/rpc', {
          method: 'get_transfers',
          params: { in: true, out: true, pending: true, pool: true },
        }),
      ]);

      if (statusRes.status === 'fulfilled') setStatus((statusRes.value.data as any) ?? null);
      if (txsRes.status === 'fulfilled') {
        const result = (txsRes.value.data as any)?.result ?? txsRes.value.data;
        const all = [
          ...(result?.in ?? []).map((t: any) => ({ ...t, type: 'in' })),
          ...(result?.out ?? []).map((t: any) => ({ ...t, type: 'out' })),
          ...(result?.pending ?? []).map((t: any) => ({ ...t, type: 'pending' })),
          ...(result?.pool ?? []).map((t: any) => ({ ...t, type: 'pool' })),
        ];
        all.sort((a: TransferEntry, b: TransferEntry) => b.timestamp - a.timestamp);
        setRecentTxs(all.slice(0, 10));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    refreshBalance();
    fetchData();
  };

  if (loading && balLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Loading wallet data...
      </div>
    );
  }

  const totalXmr = balance?.total_xmr ?? '0.000000000000';
  const unlockedXmr = balance?.unlocked_xmr ?? '0.000000000000';
  const totalFloat = parseFloat(totalXmr);
  const fiatStr = convertXmr(totalFloat);

  return (
    <div className="ov-root">
      <div className="ov-header">
        <h3 className="ov-title">Overview</h3>
        <button className="ov-refresh" onClick={handleRefresh} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Balance card */}
      <div className="ov-balance-card">
        <div className="ov-balance-label">Total Balance</div>
        <div className="ov-balance-main">{totalXmr} <span className="ov-balance-unit">XMR</span></div>
        {fiatStr && <div className="ov-balance-fiat">{fiatStr}</div>}
        <div className="ov-balance-sub">
          Unlocked: {unlockedXmr} XMR
        </div>
      </div>

      {/* Accounts */}
      {balance && balance.accounts.length > 1 && (
        <div className="ov-section">
          <div className="ov-section-title">Accounts</div>
          <div className="ov-accounts">
            {balance.accounts.map((a: AccountBalance) => (
              <div key={a.index} className="ov-account-row">
                <span className="ov-account-label">{a.label}</span>
                <span className="ov-account-balance">{a.balance_xmr} XMR</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="ov-section">
        <div className="ov-section-title">Recent Transactions</div>
        {recentTxs.length === 0 ? (
          <div className="ov-empty">No transactions yet</div>
        ) : (
          <div className="ov-txlist">
            {recentTxs.map((tx) => {
              const isIn = tx.type === 'in' || tx.type === 'pool';
              return (
                <div key={tx.txid} className="ov-tx-row">
                  <div className="ov-tx-icon" style={{ color: isIn ? '#22c55e' : '#ef4444' }}>
                    {isIn ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                  </div>
                  <div className="ov-tx-info">
                    <div className="ov-tx-hash">{truncHash(tx.txid)}</div>
                    <div className="ov-tx-time">
                      {tx.type === 'pending' || tx.type === 'pool' ? (
                        <><Clock size={10} /> Pending</>
                      ) : (
                        formatRelativeTime(tx.timestamp)
                      )}
                      {tx.confirmations > 0 && ` · ${tx.confirmations} conf`}
                    </div>
                  </div>
                  <div className={`ov-tx-amount ${isIn ? 'ov-tx-in' : 'ov-tx-out'}`}>
                    {isIn ? '+' : '-'}{picoToXmr(tx.amount)} XMR
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wallet info */}
      <div className="ov-section">
        <div className="ov-section-title">Wallet Info</div>
        <div className="ov-info-grid">
          <div className="ov-info-item">
            <span className="ov-info-label">Wallet</span>
            <span className="ov-info-value">{status?.active_wallet ?? '-'}</span>
          </div>
          <div className="ov-info-item">
            <span className="ov-info-label">Height</span>
            <span className="ov-info-value">{status?.height?.toLocaleString() ?? '-'}</span>
          </div>
          <div className="ov-info-item">
            <span className="ov-info-label">RPC Version</span>
            <span className="ov-info-value">{status?.version ?? '-'}</span>
          </div>
          <div className="ov-info-item">
            <span className="ov-info-label">Status</span>
            <span className="ov-info-value" style={{ color: status?.rpc_reachable ? '#22c55e' : '#ef4444' }}>
              {status?.rpc_reachable ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .ov-root { max-width: 720px; }
        .ov-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .ov-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0; }
        .ov-refresh { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 6px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; }
        .ov-refresh:hover { color: var(--text); border-color: var(--text-muted); }

        .ov-balance-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 20px; font-variant-numeric: tabular-nums; }
        .ov-balance-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .ov-balance-main { font-size: 24px; font-weight: 600; color: var(--text); }
        .ov-balance-unit { font-size: 13px; font-weight: 400; color: var(--text-muted); }
        .ov-balance-fiat { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
        .ov-balance-sub { font-size: 12px; color: var(--text-dim); margin-top: 8px; border-top: 1px solid var(--border); padding-top: 8px; }

        .ov-section { margin-bottom: 20px; }
        .ov-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .ov-empty { font-size: 12px; color: var(--text-muted); font-style: italic; padding: 12px 0; }

        .ov-accounts { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .ov-account-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 12px; }
        .ov-account-row:last-child { border-bottom: none; }
        .ov-account-label { color: var(--text); }
        .ov-account-balance { color: var(--text-muted); font-variant-numeric: tabular-nums; }

        .ov-txlist { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .ov-tx-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
        .ov-tx-row:last-child { border-bottom: none; }
        .ov-tx-icon { display: flex; align-items: center; }
        .ov-tx-info { flex: 1; min-width: 0; }
        .ov-tx-hash { font-size: 12px; color: var(--text); font-family: var(--font-mono); }
        .ov-tx-time { font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 3px; margin-top: 1px; }
        .ov-tx-amount { font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ov-tx-in { color: #22c55e; }
        .ov-tx-out { color: #ef4444; }

        .ov-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .ov-info-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: var(--surface); }
        .ov-info-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .ov-info-value { font-size: 12px; color: var(--text); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
