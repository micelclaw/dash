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

import { useState, useCallback } from 'react';
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { useFiatPrice } from '../hooks/useFiatPrice';

const PRIORITIES = [
  { value: 0, label: 'Default', desc: 'Normal fee' },
  { value: 1, label: 'Low', desc: 'Slower, cheaper' },
  { value: 2, label: 'Medium', desc: 'Balanced' },
  { value: 3, label: 'High', desc: 'Fast, expensive' },
];

type Stage = 'form' | 'preview' | 'confirming' | 'success' | 'error';

interface FeePreview {
  fee: number;
  amount: number;
}

interface TxResult {
  tx_hash: string;
  fee: number;
  amount: number;
}

function picoToXmr(p: number): string {
  return (p / 1e12).toFixed(12);
}

function xmrToPico(xmr: string): number {
  const val = parseFloat(xmr);
  if (isNaN(val) || val <= 0) return 0;
  return Math.round(val * 1e12);
}

function isValidAddress(addr: string): boolean {
  // Monero addresses: 95 chars (standard) or 106 chars (integrated)
  return /^[48][1-9A-HJ-NP-Za-km-z]{94,105}$/.test(addr);
}

export function SendTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const { balance, refresh: refreshBalance } = useWalletBalance();
  const { convertXmr } = useFiatPrice();

  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [priority, setPriority] = useState(0);
  const [accountIndex, setAccountIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('form');
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);

  const amountPico = xmrToPico(amount);
  const amountFloat = parseFloat(amount) || 0;
  const fiatStr = convertXmr(amountFloat);
  const addressValid = address.length === 0 || isValidAddress(address);

  const estimateFee = useCallback(async () => {
    if (!amountPico || !isValidAddress(address)) return;

    setEstimating(true);
    try {
      const result = await call<any>('transfer', {
        destinations: [{ amount: amountPico, address }],
        account_index: accountIndex,
        priority,
        do_not_relay: true,
        get_tx_key: false,
      });

      // If transfer requires confirmation (it's a transfer method), the rpc.call
      // will set pendingConfirmation. We need the dry-run fee instead.
      // Actually, do_not_relay still goes through confirmation. Let's handle both cases.
      if (result && typeof result === 'object' && 'fee' in result) {
        setFeePreview({ fee: (result as any).fee, amount: amountPico });
        setStage('preview');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Fee estimation failed');
      setStage('error');
    } finally {
      setEstimating(false);
    }
  }, [call, address, amountPico, accountIndex, priority]);

  const sendTransaction = useCallback(async () => {
    setStage('confirming');
    setErrorMsg(null);

    const result = await call<any>('transfer', {
      destinations: [{ amount: amountPico, address }],
      account_index: accountIndex,
      priority,
      get_tx_key: true,
    });

    // If confirmation is required, the dialog will handle it
    if (rpc.pendingConfirmation) return;

    if (result && typeof result === 'object' && 'tx_hash' in result) {
      setTxResult({ tx_hash: result.tx_hash, fee: result.fee, amount: amountPico });
      setStage('success');
      refreshBalance();
    } else if (rpc.error) {
      setErrorMsg(rpc.error);
      setStage('error');
    }
  }, [call, address, amountPico, accountIndex, priority, refreshBalance]);

  const reset = () => {
    setAddress('');
    setAmount('');
    setPriority(0);
    setStage('form');
    setFeePreview(null);
    setTxResult(null);
    setErrorMsg(null);
  };

  // Success view
  if (stage === 'success' && txResult) {
    return (
      <div className="st-root">
        <div className="st-success-card">
          <CheckCircle size={32} style={{ color: '#22c55e' }} />
          <div className="st-success-title">Transaction Sent</div>
          <div className="st-success-amount">{picoToXmr(txResult.amount)} XMR</div>
          <div className="st-success-detail">
            <span className="st-label">TX Hash</span>
            <span className="st-value st-mono">{txResult.tx_hash}</span>
          </div>
          <div className="st-success-detail">
            <span className="st-label">Fee</span>
            <span className="st-value">{picoToXmr(txResult.fee)} XMR</span>
          </div>
          <button className="st-btn st-btn-primary" onClick={reset}>Send Another</button>
        </div>
        <style>{STYLES}</style>
      </div>
    );
  }

  return (
    <div className="st-root">
      <h3 className="st-title">Send XMR</h3>

      {/* Address */}
      <div className="st-field">
        <label className="st-label">Destination Address</label>
        <input
          className={`st-input ${address && !addressValid ? 'st-input-error' : ''}`}
          placeholder="4... or 8... Monero address"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setStage('form'); }}
          spellCheck={false}
        />
        {address && !addressValid && (
          <div className="st-field-error">Invalid Monero address</div>
        )}
      </div>

      {/* Amount */}
      <div className="st-field">
        <label className="st-label">Amount</label>
        <div className="st-amount-row">
          <input
            className="st-input st-input-amount"
            type="number"
            step="0.000000000001"
            min="0"
            placeholder="0.000000"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setStage('form'); }}
          />
          <span className="st-amount-unit">XMR</span>
        </div>
        {fiatStr && amountFloat > 0 && (
          <div className="st-field-hint">≈ {fiatStr}</div>
        )}
        {balance && (
          <div className="st-field-hint">
            Available: {balance.unlocked_xmr} XMR
            <button className="st-link" onClick={() => setAmount(balance.unlocked_xmr)}>Max</button>
          </div>
        )}
      </div>

      {/* Account selector */}
      {balance && balance.accounts.length > 1 && (
        <div className="st-field">
          <label className="st-label">From Account</label>
          <select
            className="st-select"
            value={accountIndex}
            onChange={(e) => setAccountIndex(parseInt(e.target.value))}
          >
            {balance.accounts.map((a) => (
              <option key={a.index} value={a.index}>
                {a.label} ({a.balance_xmr} XMR)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Priority */}
      <div className="st-field">
        <label className="st-label">Priority</label>
        <div className="st-priority-row">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              className={`st-priority-btn ${priority === p.value ? 'st-priority-active' : ''}`}
              onClick={() => setPriority(p.value)}
              title={p.desc}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fee preview */}
      {stage === 'preview' && feePreview && (
        <div className="st-preview">
          <div className="st-preview-row">
            <span className="st-label">Amount</span>
            <span>{picoToXmr(feePreview.amount)} XMR</span>
          </div>
          <div className="st-preview-row">
            <span className="st-label">Fee</span>
            <span>{picoToXmr(feePreview.fee)} XMR</span>
          </div>
          <div className="st-preview-row st-preview-total">
            <span className="st-label">Total</span>
            <span>{picoToXmr(feePreview.amount + feePreview.fee)} XMR</span>
          </div>
        </div>
      )}

      {/* Error */}
      {stage === 'error' && errorMsg && (
        <div className="st-error">
          <AlertCircle size={13} /> {errorMsg}
        </div>
      )}

      {/* Actions */}
      <div className="st-actions">
        {stage === 'form' && (
          <button
            className="st-btn st-btn-secondary"
            onClick={estimateFee}
            disabled={!amountPico || !isValidAddress(address) || estimating}
          >
            {estimating ? <><Loader2 size={13} className="spin" /> Estimating...</> : 'Preview Fee'}
          </button>
        )}
        {stage === 'preview' && (
          <>
            <button className="st-btn st-btn-ghost" onClick={() => setStage('form')}>Back</button>
            <button className="st-btn st-btn-primary" onClick={sendTransaction} disabled={rpc.isLoading}>
              {rpc.isLoading ? <><Loader2 size={13} className="spin" /> Sending...</> : <><Send size={13} /> Send</>}
            </button>
          </>
        )}
        {stage === 'error' && (
          <button className="st-btn st-btn-secondary" onClick={() => setStage('form')}>Try Again</button>
        )}
      </div>

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .st-root { max-width: 520px; }
  .st-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 20px; }

  .st-field { margin-bottom: 16px; }
  .st-label { display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
  .st-input { width: 100%; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 13px; font-family: var(--font-sans); box-sizing: border-box; }
  .st-input:focus { outline: none; border-color: #ff6600; }
  .st-input-error { border-color: #ef4444 !important; }
  .st-field-error { font-size: 11px; color: #ef4444; margin-top: 3px; }
  .st-field-hint { font-size: 11px; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 6px; }
  .st-link { background: none; border: none; color: #ff6600; cursor: pointer; font-size: 11px; padding: 0; text-decoration: underline; font-family: var(--font-sans); }

  .st-amount-row { display: flex; align-items: center; gap: 8px; }
  .st-input-amount { flex: 1; }
  .st-amount-unit { font-size: 12px; color: var(--text-muted); font-weight: 500; }

  .st-select { width: 100%; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); }

  .st-priority-row { display: flex; gap: 4px; }
  .st-priority-btn { flex: 1; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
  .st-priority-btn:hover { border-color: var(--text-muted); color: var(--text); }
  .st-priority-active { border-color: #ff6600; color: #ff6600; background: rgba(255,102,0,0.05); }

  .st-preview { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 16px; font-variant-numeric: tabular-nums; }
  .st-preview-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-dim); padding: 4px 0; }
  .st-preview-total { font-weight: 600; color: var(--text); border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px; }

  .st-error { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-sm); color: #ef4444; font-size: 12px; margin-bottom: 16px; }

  .st-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .st-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 12px; font-family: var(--font-sans); cursor: pointer; border: none; }
  .st-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .st-btn-primary { background: #ff6600; color: white; }
  .st-btn-primary:hover:not(:disabled) { background: #e65c00; }
  .st-btn-secondary { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
  .st-btn-secondary:hover:not(:disabled) { background: var(--surface-hover); }
  .st-btn-ghost { background: none; border: 1px solid var(--border); color: var(--text-muted); }
  .st-btn-ghost:hover { color: var(--text); border-color: var(--text-muted); }

  .st-success-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center; }
  .st-success-title { font-size: 16px; font-weight: 500; color: var(--text); }
  .st-success-amount { font-size: 20px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .st-success-detail { display: flex; flex-direction: column; gap: 2px; }
  .st-value { font-size: 12px; color: var(--text); }
  .st-mono { font-family: var(--font-mono); font-size: 11px; word-break: break-all; max-width: 400px; }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
