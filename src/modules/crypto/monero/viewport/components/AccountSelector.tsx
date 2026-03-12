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
import { ChevronDown, Plus, KeyRound, Wallet } from 'lucide-react';
import { api } from '@/services/api';

interface WalletsResponse {
  wallets: string[];
  active: string | null;
}

interface Props {
  onWalletChange?: (wallet: string) => void;
  onCreateNew?: () => void;
  onRestoreFromSeed?: () => void;
}

export function AccountSelector({ onWalletChange, onCreateNew, onRestoreFromSeed }: Props) {
  const [wallets, setWallets] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: WalletsResponse }>('/crypto/monero-wallet/wallets');
      const data = res.data as any;
      setWallets(data.wallets ?? []);
      setActive(data.active ?? null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="mw-selector">
      <button className="mw-selector-btn" onClick={() => setOpen(!open)}>
        <Wallet size={12} />
        <span className="mw-selector-label">{active ?? 'No wallet'}</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div className="mw-selector-dropdown">
          {wallets.length === 0 && (
            <div className="mw-selector-empty">No wallets found</div>
          )}
          {wallets.map((w) => (
            <button
              key={w}
              className={`mw-selector-item ${w === active ? 'mw-selector-item-active' : ''}`}
              onClick={() => {
                setOpen(false);
                if (w !== active) onWalletChange?.(w);
              }}
            >
              {w}
              {w === active && <span className="mw-selector-dot" />}
            </button>
          ))}
          <div className="mw-selector-divider" />
          <button className="mw-selector-action" onClick={() => { setOpen(false); onCreateNew?.(); }}>
            <Plus size={12} /> Create New Wallet
          </button>
          <button className="mw-selector-action" onClick={() => { setOpen(false); onRestoreFromSeed?.(); }}>
            <KeyRound size={12} /> Restore from Seed
          </button>
        </div>
      )}

      <style>{`
        .mw-selector { position: relative; }
        .mw-selector-btn {
          display: flex; align-items: center; gap: 6px; padding: 5px 8px;
          background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
          color: var(--text); cursor: pointer; font-size: 11px; font-family: var(--font-sans);
          width: 100%; min-width: 0;
        }
        .mw-selector-btn:hover { border-color: var(--text-muted); }
        .mw-selector-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
        .mw-selector-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 50; padding: 4px;
          max-height: 240px; overflow-y: auto;
        }
        .mw-selector-empty { padding: 8px; font-size: 11px; color: var(--text-muted); text-align: center; }
        .mw-selector-item {
          display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px;
          background: none; border: none; color: var(--text-dim); cursor: pointer;
          font-size: 11px; font-family: var(--font-sans); border-radius: var(--radius-sm); text-align: left;
        }
        .mw-selector-item:hover { background: var(--surface-hover); color: var(--text); }
        .mw-selector-item-active { color: #ff6600; }
        .mw-selector-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; margin-left: auto; }
        .mw-selector-divider { height: 1px; background: var(--border); margin: 4px 0; }
        .mw-selector-action {
          display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px;
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          font-size: 11px; font-family: var(--font-sans); border-radius: var(--radius-sm); text-align: left;
        }
        .mw-selector-action:hover { background: var(--surface-hover); color: var(--text); }
      `}</style>
    </div>
  );
}
