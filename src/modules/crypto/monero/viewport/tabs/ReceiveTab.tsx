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
import { Copy, Check, Plus, Loader2 } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';
import { QrCodeDisplay } from '../components/QrCodeDisplay';

interface SubAddress {
  address: string;
  label: string;
  address_index: number;
  used: boolean;
}

export function ReceiveTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [addresses, setAddresses] = useState<SubAddress[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [requestAmount, setRequestAmount] = useState('');

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    const result = await call<{ address: string; addresses: SubAddress[] }>('get_address', { account_index: 0 });
    if (result) {
      setAddresses(result.addresses ?? []);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const createSubaddress = useCallback(async () => {
    if (!newLabel.trim() && !confirm('Create subaddress without a label?')) return;
    setCreating(true);
    await call('create_address', {
      account_index: 0,
      label: newLabel.trim() || undefined,
    });
    setNewLabel('');
    setShowCreate(false);
    await fetchAddresses();
    setCreating(false);
  }, [call, newLabel, fetchAddresses]);

  const copyAddress = (addr: string, idx: number) => {
    navigator.clipboard.writeText(addr);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const selected = addresses[selectedIdx] ?? addresses[0];
  const selectedAddr = selected?.address ?? '';

  // Build monero: URI
  const amtFloat = parseFloat(requestAmount);
  const moneroUri = selectedAddr
    ? amtFloat > 0
      ? `monero:${selectedAddr}?tx_amount=${requestAmount}`
      : `monero:${selectedAddr}`
    : '';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Loading addresses...
      </div>
    );
  }

  return (
    <div className="rt-root">
      <h3 className="rt-title">Receive XMR</h3>

      <div className="rt-layout">
        {/* QR + selected address */}
        <div className="rt-qr-panel">
          <QrCodeDisplay value={moneroUri} size={180} />
          <div className="rt-selected-addr">
            <div className="rt-addr-text">{selectedAddr}</div>
            <button
              className="rt-copy-btn"
              onClick={() => copyAddress(selectedAddr, -1)}
              title="Copy address"
            >
              {copied === -1 ? <Check size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
            </button>
          </div>

          {/* Payment request amount */}
          <div className="rt-request">
            <label className="rt-label">Request Amount (optional)</label>
            <div className="rt-request-row">
              <input
                className="rt-input"
                type="number"
                step="0.000000000001"
                min="0"
                placeholder="0.000000"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
              />
              <span className="rt-unit">XMR</span>
            </div>
          </div>
        </div>

        {/* Subaddress list */}
        <div className="rt-addr-panel">
          <div className="rt-addr-header">
            <span className="rt-label">Subaddresses</span>
            <button className="rt-add-btn" onClick={() => setShowCreate(!showCreate)}>
              <Plus size={12} /> New
            </button>
          </div>

          {showCreate && (
            <div className="rt-create-row">
              <input
                className="rt-input rt-input-sm"
                placeholder="Label (optional)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSubaddress()}
              />
              <button className="rt-create-btn" onClick={createSubaddress} disabled={creating}>
                {creating ? <Loader2 size={12} className="spin" /> : 'Create'}
              </button>
            </div>
          )}

          <div className="rt-addr-list">
            {addresses.map((a, i) => (
              <button
                key={a.address_index}
                className={`rt-addr-item ${selectedIdx === i ? 'rt-addr-item-active' : ''}`}
                onClick={() => setSelectedIdx(i)}
              >
                <div className="rt-addr-item-top">
                  <span className="rt-addr-idx">#{a.address_index}</span>
                  <span className="rt-addr-item-label">{a.label || 'Unlabeled'}</span>
                  {a.used && <span className="rt-addr-used">used</span>}
                  <div style={{ flex: 1 }} />
                  <button
                    className="rt-copy-sm"
                    onClick={(e) => { e.stopPropagation(); copyAddress(a.address, i); }}
                  >
                    {copied === i ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
                  </button>
                </div>
                <div className="rt-addr-item-addr">{a.address.slice(0, 16)}...{a.address.slice(-8)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .rt-root { max-width: 720px; }
        .rt-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 20px; }
        .rt-layout { display: flex; gap: 24px; }
        @media (max-width: 640px) { .rt-layout { flex-direction: column; } }

        .rt-qr-panel { display: flex; flex-direction: column; align-items: center; gap: 12px; min-width: 220px; }
        .rt-selected-addr { display: flex; align-items: center; gap: 6px; max-width: 220px; }
        .rt-addr-text { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); word-break: break-all; line-height: 1.4; }
        .rt-copy-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 6px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; flex-shrink: 0; }
        .rt-copy-btn:hover { color: var(--text); border-color: var(--text-muted); }

        .rt-request { width: 100%; }
        .rt-request-row { display: flex; align-items: center; gap: 6px; }
        .rt-input { flex: 1; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); box-sizing: border-box; }
        .rt-input:focus { outline: none; border-color: #ff6600; }
        .rt-input-sm { font-size: 11px; padding: 5px 8px; }
        .rt-unit { font-size: 11px; color: var(--text-muted); }
        .rt-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; display: block; }

        .rt-addr-panel { flex: 1; min-width: 0; }
        .rt-addr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .rt-add-btn { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .rt-add-btn:hover { color: var(--text); border-color: var(--text-muted); }

        .rt-create-row { display: flex; gap: 6px; margin-bottom: 8px; }
        .rt-create-btn { padding: 5px 10px; background: #ff6600; color: white; border: none; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; font-family: var(--font-sans); display: flex; align-items: center; gap: 4px; }
        .rt-create-btn:disabled { opacity: 0.5; }

        .rt-addr-list { display: flex; flex-direction: column; gap: 2px; max-height: 400px; overflow-y: auto; }
        .rt-addr-item { padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; text-align: left; width: 100%; font-family: var(--font-sans); }
        .rt-addr-item:hover { border-color: var(--text-muted); }
        .rt-addr-item-active { border-color: #ff6600; background: rgba(255,102,0,0.04); }
        .rt-addr-item-top { display: flex; align-items: center; gap: 6px; font-size: 11px; }
        .rt-addr-idx { color: var(--text-muted); font-variant-numeric: tabular-nums; }
        .rt-addr-item-label { color: var(--text); font-weight: 500; }
        .rt-addr-used { font-size: 9px; color: var(--text-muted); background: var(--bg); padding: 1px 5px; border-radius: 8px; }
        .rt-addr-item-addr { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 3px; }
        .rt-copy-sm { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; display: flex; }
        .rt-copy-sm:hover { color: var(--text); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
