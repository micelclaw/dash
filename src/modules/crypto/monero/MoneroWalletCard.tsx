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

import { useNavigate } from 'react-router';
import { ExternalLink, Loader2, Wallet, AlertCircle } from 'lucide-react';

interface WalletStatus {
  rpc_reachable: boolean;
  active_wallet: string | null;
  height: number | null;
  version: number | null;
}

interface BalanceData {
  total_xmr: string;
  unlocked_xmr: string;
}

interface Props {
  monerodRunning: boolean;
  walletStatus: WalletStatus | null;
  walletBalance: BalanceData | null;
  fiatPrice: number | null;
}

export function MoneroWalletCard({ monerodRunning, walletStatus, walletBalance, fiatPrice }: Props) {
  const navigate = useNavigate();

  const rpcUp = walletStatus?.rpc_reachable ?? false;
  const hasWallet = rpcUp && !!walletStatus?.active_wallet;
  const dotColor = hasWallet ? '#22c55e' : rpcUp ? '#f59e0b' : '#6b7280';
  const loading = monerodRunning && walletStatus === null;

  const totalXmr = walletBalance?.total_xmr ?? '0.000000000000';
  const unlockedXmr = walletBalance?.unlocked_xmr ?? '0.000000000000';
  const totalFloat = parseFloat(totalXmr);
  const fiatStr = fiatPrice && totalFloat > 0
    ? `≈ $${(totalFloat * fiatPrice).toFixed(2)}`
    : null;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: dotColor }} />
        <span style={{ fontSize: 11, color: '#ff6600' }}>&#9399;</span>
        <span className="crypto-card-title">Monero Wallet</span>
        <div style={{ flex: 1 }} />
        <button className="crypto-btn-sm" onClick={() => navigate('/crypto/monero/wallet')} title="Open Wallet">
          <ExternalLink size={12} />
        </button>
      </div>

      <div className="crypto-card-body">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
            <Loader2 size={14} className="spin" /> Checking wallet...
          </div>
        ) : !monerodRunning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11 }}>
            <AlertCircle size={12} /> Monero Node must be running first
          </div>
        ) : !rpcUp ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Wallet size={12} /> Wallet RPC not running
            </div>
            <div style={{ fontStyle: 'italic' }}>Start from the wallet viewport</div>
          </div>
        ) : !hasWallet ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Wallet size={12} style={{ color: '#f59e0b' }} /> RPC connected — no wallet open
            </div>
            <button
              className="crypto-btn-sm"
              style={{ marginTop: 4 }}
              onClick={() => navigate('/crypto/monero/wallet')}
            >
              Open Wallet →
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              {walletStatus!.active_wallet}
            </div>
            <div className="mwc-balance">
              <div className="mwc-amount">
                {totalXmr} <span className="mwc-unit">XMR</span>
              </div>
              <div className="mwc-label">Unlocked: {unlockedXmr}</div>
              {fiatStr && <div className="mwc-fiat">{fiatStr}</div>}
            </div>
          </>
        )}
      </div>

      <style>{`
        .mwc-balance { font-variant-numeric: tabular-nums; }
        .mwc-amount { font-size: 15px; font-weight: 600; color: var(--text); }
        .mwc-unit { font-size: 11px; font-weight: 400; color: var(--text-muted); }
        .mwc-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .mwc-fiat { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}
