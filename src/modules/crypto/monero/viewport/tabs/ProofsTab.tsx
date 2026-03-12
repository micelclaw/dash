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
import { Copy, Check, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';

type ProofType = 'tx' | 'spend' | 'reserve';
type Mode = 'generate' | 'verify';

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function ProofsTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [mode, setMode] = useState<Mode>('generate');
  const [proofType, setProofType] = useState<ProofType>('tx');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate state
  const [txid, setTxid] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [allBalance, setAllBalance] = useState(true);
  const [accountIndex, setAccountIndex] = useState(0);
  const [generatedProof, setGeneratedProof] = useState<string | null>(null);

  // Verify state
  const [vTxid, setVTxid] = useState('');
  const [vAddress, setVAddress] = useState('');
  const [vMessage, setVMessage] = useState('');
  const [vSignature, setVSignature] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    received?: number;
    total?: number;
    spent?: number;
    confirmations?: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const resetResults = () => {
    setGeneratedProof(null);
    setVerifyResult(null);
    setError(null);
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Generate ---
  const generateProof = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGeneratedProof(null);

    try {
      if (proofType === 'tx') {
        if (!txid.trim()) { setError('TX ID is required'); return; }
        if (!address.trim()) { setError('Address is required'); return; }
        const result = await call<{ signature: string }>('get_tx_proof', {
          txid: txid.trim(),
          address: address.trim(),
          message: message.trim() || undefined,
        });
        if (result?.signature) setGeneratedProof(result.signature);
        else setError('No proof returned');
      } else if (proofType === 'spend') {
        if (!txid.trim()) { setError('TX ID is required'); return; }
        const result = await call<{ signature: string }>('get_spend_proof', {
          txid: txid.trim(),
          message: message.trim() || undefined,
        });
        if (result?.signature) setGeneratedProof(result.signature);
        else setError('No proof returned');
      } else if (proofType === 'reserve') {
        const params: Record<string, unknown> = {
          all: allBalance,
          message: message.trim() || undefined,
        };
        if (!allBalance) {
          params.account_index = accountIndex;
          if (amount.trim()) params.amount = Math.round(parseFloat(amount) * 1e12);
        }
        const result = await call<{ signature: string }>('get_reserve_proof', params);
        if (result?.signature) setGeneratedProof(result.signature);
        else setError('No proof returned');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate proof');
    } finally {
      setLoading(false);
    }
  }, [call, proofType, txid, address, message, amount, allBalance, accountIndex]);

  // --- Verify ---
  const verifyProof = useCallback(async () => {
    setLoading(true);
    setError(null);
    setVerifyResult(null);

    try {
      if (proofType === 'tx') {
        if (!vTxid.trim() || !vAddress.trim() || !vSignature.trim()) {
          setError('TX ID, address, and signature are required');
          return;
        }
        const result = await call<{ good: boolean; received: number; confirmations: number }>('check_tx_proof', {
          txid: vTxid.trim(),
          address: vAddress.trim(),
          message: vMessage.trim() || undefined,
          signature: vSignature.trim(),
        });
        if (result) setVerifyResult({ valid: result.good, received: result.received, confirmations: result.confirmations });
        else setError('No result returned');
      } else if (proofType === 'spend') {
        if (!vTxid.trim() || !vSignature.trim()) {
          setError('TX ID and signature are required');
          return;
        }
        const result = await call<{ good: boolean }>('check_spend_proof', {
          txid: vTxid.trim(),
          message: vMessage.trim() || undefined,
          signature: vSignature.trim(),
        });
        if (result) setVerifyResult({ valid: result.good });
        else setError('No result returned');
      } else if (proofType === 'reserve') {
        if (!vAddress.trim() || !vSignature.trim()) {
          setError('Address and signature are required');
          return;
        }
        const result = await call<{ good: boolean; total: number; spent: number }>('check_reserve_proof', {
          address: vAddress.trim(),
          message: vMessage.trim() || undefined,
          signature: vSignature.trim(),
        });
        if (result) setVerifyResult({ valid: result.good, total: result.total, spent: result.spent });
        else setError('No result returned');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }, [call, proofType, vTxid, vAddress, vMessage, vSignature]);

  const picoToXmr = (p: number) => (p / 1e12).toFixed(6);

  return (
    <div className="pr-root">
      <h3 className="pr-title">Proofs</h3>

      {/* Mode toggle */}
      <div className="pr-mode-row">
        <button className={`pr-mode-btn ${mode === 'generate' ? 'pr-mode-active' : ''}`} onClick={() => { setMode('generate'); resetResults(); }}>
          Generate
        </button>
        <button className={`pr-mode-btn ${mode === 'verify' ? 'pr-mode-active' : ''}`} onClick={() => { setMode('verify'); resetResults(); }}>
          Verify
        </button>
      </div>

      {/* Proof type selector */}
      <div className="pr-type-row">
        {(['tx', 'spend', 'reserve'] as ProofType[]).map((t) => (
          <button
            key={t}
            className={`pr-type-btn ${proofType === t ? 'pr-type-active' : ''}`}
            onClick={() => { setProofType(t); resetResults(); }}
          >
            {t === 'tx' ? 'Transaction' : t === 'spend' ? 'Spend' : 'Reserve'}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="pr-desc">
        {mode === 'generate' ? (
          proofType === 'tx' ? 'Prove that a payment was made to a specific address.' :
          proofType === 'spend' ? 'Prove that you are the sender of a transaction.' :
          'Prove that you hold a certain amount of XMR in reserve.'
        ) : (
          proofType === 'tx' ? 'Verify that a payment was made to a specific address.' :
          proofType === 'spend' ? 'Verify that someone was the sender of a transaction.' :
          'Verify that someone holds a certain reserve of XMR.'
        )}
      </div>

      {mode === 'generate' ? (
        <div className="pr-form">
          {/* TX Proof: txid + address + message */}
          {proofType === 'tx' && (
            <>
              <div className="pr-field">
                <label className="pr-label">Transaction ID</label>
                <input className="pr-input" placeholder="64-character tx hash" value={txid} onChange={(e) => setTxid(e.target.value)} spellCheck={false} />
              </div>
              <div className="pr-field">
                <label className="pr-label">Recipient Address</label>
                <input className="pr-input" placeholder="Monero address" value={address} onChange={(e) => setAddress(e.target.value)} spellCheck={false} />
              </div>
            </>
          )}

          {/* Spend Proof: txid + message */}
          {proofType === 'spend' && (
            <div className="pr-field">
              <label className="pr-label">Transaction ID</label>
              <input className="pr-input" placeholder="64-character tx hash" value={txid} onChange={(e) => setTxid(e.target.value)} spellCheck={false} />
            </div>
          )}

          {/* Reserve Proof: all/account + amount + message */}
          {proofType === 'reserve' && (
            <>
              <div className="pr-field">
                <label className="pr-label">Scope</label>
                <div className="pr-check-row">
                  <label className="pr-check">
                    <input type="checkbox" checked={allBalance} onChange={(e) => setAllBalance(e.target.checked)} />
                    Prove entire balance
                  </label>
                </div>
              </div>
              {!allBalance && (
                <>
                  <div className="pr-field">
                    <label className="pr-label">Account Index</label>
                    <input className="pr-input pr-input-sm" type="number" min="0" value={accountIndex} onChange={(e) => setAccountIndex(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="pr-field">
                    <label className="pr-label">Amount (XMR, optional)</label>
                    <input className="pr-input pr-input-sm" type="number" step="0.000001" min="0" placeholder="0.000000" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </>
              )}
            </>
          )}

          {/* Common: message */}
          <div className="pr-field">
            <label className="pr-label">Message (optional)</label>
            <input className="pr-input" placeholder="Optional message to include in proof" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <button className="pr-btn pr-btn-primary" onClick={generateProof} disabled={loading}>
            {loading ? <><Loader2 size={13} className="spin" /> Generating...</> : 'Generate Proof'}
          </button>

          {/* Generated proof output */}
          {generatedProof && (
            <div className="pr-result pr-result-success">
              <div className="pr-result-header">
                <ShieldCheck size={14} style={{ color: '#22c55e' }} />
                <span>Proof Generated</span>
                <div style={{ flex: 1 }} />
                <button className="pr-copy-btn" onClick={() => handleCopy(generatedProof)}>
                  {copied ? <><Check size={11} style={{ color: '#22c55e' }} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="pr-proof-text">{generatedProof}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="pr-form">
          {/* TX Proof verify: txid + address + message + signature */}
          {proofType === 'tx' && (
            <>
              <div className="pr-field">
                <label className="pr-label">Transaction ID</label>
                <input className="pr-input" placeholder="64-character tx hash" value={vTxid} onChange={(e) => setVTxid(e.target.value)} spellCheck={false} />
              </div>
              <div className="pr-field">
                <label className="pr-label">Address</label>
                <input className="pr-input" placeholder="Monero address" value={vAddress} onChange={(e) => setVAddress(e.target.value)} spellCheck={false} />
              </div>
            </>
          )}

          {/* Spend Proof verify: txid + message + signature */}
          {proofType === 'spend' && (
            <div className="pr-field">
              <label className="pr-label">Transaction ID</label>
              <input className="pr-input" placeholder="64-character tx hash" value={vTxid} onChange={(e) => setVTxid(e.target.value)} spellCheck={false} />
            </div>
          )}

          {/* Reserve Proof verify: address + message + signature */}
          {proofType === 'reserve' && (
            <div className="pr-field">
              <label className="pr-label">Address</label>
              <input className="pr-input" placeholder="Monero address of the prover" value={vAddress} onChange={(e) => setVAddress(e.target.value)} spellCheck={false} />
            </div>
          )}

          {/* Common: message */}
          <div className="pr-field">
            <label className="pr-label">Message (optional)</label>
            <input className="pr-input" placeholder="Same message used when generating" value={vMessage} onChange={(e) => setVMessage(e.target.value)} />
          </div>

          {/* Signature / proof string */}
          <div className="pr-field">
            <label className="pr-label">Proof Signature</label>
            <textarea className="pr-textarea" placeholder="Paste the proof string here..." value={vSignature} onChange={(e) => setVSignature(e.target.value)} rows={4} spellCheck={false} />
          </div>

          <button className="pr-btn pr-btn-primary" onClick={verifyProof} disabled={loading}>
            {loading ? <><Loader2 size={13} className="spin" /> Verifying...</> : 'Verify Proof'}
          </button>

          {/* Verify result */}
          {verifyResult && (
            <div className={`pr-result ${verifyResult.valid ? 'pr-result-success' : 'pr-result-fail'}`}>
              <div className="pr-result-header">
                {verifyResult.valid ? (
                  <><ShieldCheck size={14} style={{ color: '#22c55e' }} /><span>Proof Valid</span></>
                ) : (
                  <><ShieldAlert size={14} style={{ color: '#ef4444' }} /><span>Proof Invalid</span></>
                )}
              </div>
              {verifyResult.valid && (
                <div className="pr-result-details">
                  {verifyResult.received !== undefined && (
                    <div className="pr-detail-row">
                      <span className="pr-detail-label">Received</span>
                      <span>{picoToXmr(verifyResult.received)} XMR</span>
                    </div>
                  )}
                  {verifyResult.confirmations !== undefined && (
                    <div className="pr-detail-row">
                      <span className="pr-detail-label">Confirmations</span>
                      <span>{verifyResult.confirmations}</span>
                    </div>
                  )}
                  {verifyResult.total !== undefined && (
                    <div className="pr-detail-row">
                      <span className="pr-detail-label">Total Reserve</span>
                      <span>{picoToXmr(verifyResult.total)} XMR</span>
                    </div>
                  )}
                  {verifyResult.spent !== undefined && (
                    <div className="pr-detail-row">
                      <span className="pr-detail-label">Spent</span>
                      <span>{picoToXmr(verifyResult.spent)} XMR</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="pr-error">
          <ShieldAlert size={13} /> {error}
        </div>
      )}

      <style>{`
        .pr-root { max-width: 600px; }
        .pr-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 16px; }

        .pr-mode-row { display: flex; gap: 4px; margin-bottom: 12px; }
        .pr-mode-btn { flex: 1; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; font-size: 12px; font-family: var(--font-sans); font-weight: 500; }
        .pr-mode-btn:hover { border-color: var(--text-muted); }
        .pr-mode-active { border-color: #ff6600; color: #ff6600; background: rgba(255,102,0,0.05); }

        .pr-type-row { display: flex; gap: 4px; margin-bottom: 12px; }
        .pr-type-btn { padding: 5px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .pr-type-btn:hover { border-color: var(--text-muted); }
        .pr-type-active { border-color: #ff6600; color: #ff6600; background: rgba(255,102,0,0.05); }

        .pr-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.4; }

        .pr-form { display: flex; flex-direction: column; gap: 12px; }
        .pr-field { display: flex; flex-direction: column; gap: 3px; }
        .pr-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .pr-input { padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); box-sizing: border-box; }
        .pr-input:focus { outline: none; border-color: #ff6600; }
        .pr-input-sm { max-width: 200px; }
        .pr-textarea { padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 11px; font-family: var(--font-mono); resize: vertical; box-sizing: border-box; }
        .pr-textarea:focus { outline: none; border-color: #ff6600; }

        .pr-check-row { display: flex; align-items: center; gap: 8px; }
        .pr-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
        .pr-check input { accent-color: #ff6600; }

        .pr-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 12px; font-family: var(--font-sans); cursor: pointer; border: none; align-self: flex-start; }
        .pr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pr-btn-primary { background: #ff6600; color: white; }
        .pr-btn-primary:hover:not(:disabled) { background: #e65c00; }

        .pr-result { margin-top: 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .pr-result-success { border-color: rgba(34,197,94,0.3); }
        .pr-result-fail { border-color: rgba(239,68,68,0.3); }
        .pr-result-header { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--surface); font-size: 12px; font-weight: 500; color: var(--text); }
        .pr-proof-text { padding: 10px 12px; font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); word-break: break-all; line-height: 1.5; background: var(--bg); max-height: 160px; overflow-y: auto; }
        .pr-copy-btn { display: flex; align-items: center; gap: 4px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 8px; color: var(--text-muted); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .pr-copy-btn:hover { color: var(--text); border-color: var(--text-muted); }

        .pr-result-details { padding: 8px 12px; background: var(--bg); }
        .pr-detail-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: var(--text-dim); }
        .pr-detail-label { color: var(--text-muted); font-size: 11px; }

        .pr-error { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-sm); color: #ef4444; font-size: 12px; margin-top: 8px; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
