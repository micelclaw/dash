import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Copy, Check, Upload, Download, Shield, AlertTriangle } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';

interface MultisigStatus {
  multisig: boolean;
  ready: boolean;
  threshold: number;
  total: number;
}

type SetupStep = 'prepare' | 'make' | 'exchange' | 'done';

export function MultisigTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [status, setStatus] = useState<MultisigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Setup wizard
  const [setupActive, setSetupActive] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('prepare');
  const [myInfo, setMyInfo] = useState('');
  const [othersInfo, setOthersInfo] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [totalSigners, setTotalSigners] = useState(3);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [exchangeRoundsLeft, setExchangeRoundsLeft] = useState(0);

  // Signing
  const [signingData, setSigningData] = useState('');
  const [signResult, setSignResult] = useState<string | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const result = await call<MultisigStatus>('is_multisig', {});
    if (result) setStatus(result);
    setLoading(false);
  }, [call]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Step 1: prepare_multisig
  const prepareMultisig = useCallback(async () => {
    setSetupLoading(true);
    setSetupError(null);
    const result = await call<{ multisig_info: string }>('prepare_multisig', {});
    if (rpc.pendingConfirmation) {
      setSetupLoading(false);
      return;
    }
    if (result?.multisig_info) {
      setMyInfo(result.multisig_info);
      setSetupStep('make');
    } else {
      setSetupError(rpc.error || 'Failed to prepare multisig');
    }
    setSetupLoading(false);
  }, [call, rpc.error]);

  // Step 2: make_multisig
  const makeMultisig = useCallback(async () => {
    const infoArr = othersInfo.split('\n').map((s) => s.trim()).filter(Boolean);
    if (infoArr.length < 1) {
      setSetupError('Paste at least one other participant\'s info');
      return;
    }
    setSetupLoading(true);
    setSetupError(null);

    const result = await call<{ multisig_info: string; address?: string }>('make_multisig', {
      multisig_info: infoArr,
      threshold,
    });

    if (rpc.pendingConfirmation) {
      setSetupLoading(false);
      return; // confirmation dialog will handle it
    }

    if (result) {
      if (result.multisig_info) {
        // Extra round needed
        setMyInfo(result.multisig_info);
        setOthersInfo('');
        setExchangeRoundsLeft((prev) => prev + 1);
        setSetupStep('exchange');
      } else if (result.address) {
        setSetupStep('done');
        fetchStatus();
      }
    } else {
      setSetupError(rpc.error || 'make_multisig failed');
    }
    setSetupLoading(false);
  }, [call, othersInfo, threshold, fetchStatus]);

  // Step 3: exchange_multisig_keys (may need multiple rounds)
  const exchangeKeys = useCallback(async () => {
    const infoArr = othersInfo.split('\n').map((s) => s.trim()).filter(Boolean);
    if (infoArr.length < 1) {
      setSetupError('Paste other participants\' info for this round');
      return;
    }
    setSetupLoading(true);
    setSetupError(null);

    const result = await call<{ multisig_info: string; address?: string }>('exchange_multisig_keys', {
      multisig_info: infoArr,
    });

    if (rpc.pendingConfirmation) {
      setSetupLoading(false);
      return;
    }

    if (result) {
      if (result.address) {
        // Finalized
        setSetupStep('done');
        fetchStatus();
      } else if (result.multisig_info) {
        // Another round
        setMyInfo(result.multisig_info);
        setOthersInfo('');
        setExchangeRoundsLeft((prev) => prev + 1);
      }
    } else {
      setSetupError(rpc.error || 'exchange_multisig_keys failed');
    }
    setSetupLoading(false);
  }, [call, othersInfo, fetchStatus]);

  // Export multisig info
  const exportMultisigInfo = useCallback(async () => {
    const result = await call<{ info: string }>('export_multisig_info', {});
    if (result?.info) {
      const blob = new Blob([result.info], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `multisig-info-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [call]);

  // Import multisig info
  const importMultisigInfo = useCallback(async (file: File) => {
    const text = await file.text();
    const infoArr = text.split('\n').map((s) => s.trim()).filter(Boolean);
    await call('import_multisig_info', { info: infoArr });
    if (rpc.pendingConfirmation) return; // confirmation dialog will handle it
    fetchStatus();
  }, [call, fetchStatus]);

  // Sign multisig tx
  const signMultisig = useCallback(async () => {
    if (!signingData.trim()) return;
    setSigningLoading(true);
    setSigningError(null);
    setSignResult(null);

    const result = await call<{ tx_data_hex: string; tx_hash_list: string[] }>('sign_multisig', {
      tx_data_hex: signingData.trim(),
    });

    if (rpc.pendingConfirmation) {
      setSigningLoading(false);
      return;
    }

    if (result?.tx_data_hex) {
      setSignResult(result.tx_data_hex);
    } else {
      setSigningError(rpc.error || 'Signing failed');
    }
    setSigningLoading(false);
  }, [call, signingData]);

  // Submit signed multisig tx
  const submitMultisig = useCallback(async () => {
    if (!signResult) return;
    setSigningLoading(true);
    setSigningError(null);

    const result = await call<{ tx_hash_list: string[] }>('submit_multisig', {
      tx_data_hex: signResult,
    });

    if (rpc.pendingConfirmation) {
      setSigningLoading(false);
      return;
    }

    if (result?.tx_hash_list?.length) {
      setSigningError(null);
      setSignResult(null);
      setSigningData('');
      alert(`Submitted! TX hash(es): ${result.tx_hash_list.join(', ')}`);
    } else {
      setSigningError(rpc.error || 'Submission failed');
    }
    setSigningLoading(false);
  }, [call, signResult]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Checking multisig status...
      </div>
    );
  }

  return (
    <div className="ms-root">
      <h3 className="ms-title">Multisig</h3>

      {/* Status */}
      <div className="ms-status-card">
        <Shield size={16} style={{ color: status?.multisig ? '#22c55e' : 'var(--text-muted)' }} />
        <div>
          {status?.multisig ? (
            <>
              <div className="ms-status-text">
                {status.threshold}-of-{status.total} Multisig
                {status.ready ? ' (Ready)' : ' (Setup incomplete)'}
              </div>
              <div className="ms-status-sub">
                Requires {status.threshold} signatures out of {status.total} participants
              </div>
            </>
          ) : (
            <>
              <div className="ms-status-text">Standard Wallet</div>
              <div className="ms-status-sub">This wallet is not configured for multisig</div>
            </>
          )}
        </div>
      </div>

      {/* Warning */}
      <div className="ms-warning">
        <AlertTriangle size={13} />
        <span>Multisig setup is irreversible. Once converted, a wallet cannot be changed back. Use a dedicated wallet for multisig.</span>
      </div>

      {/* If already multisig: show signing + export/import */}
      {status?.multisig && status.ready && (
        <>
          {/* Export/Import info for signing rounds */}
          <div className="ms-section">
            <div className="ms-section-title">Sync Multisig Info</div>
            <div className="ms-section-desc">
              Before creating or signing transactions, sync info with other participants.
            </div>
            <div className="ms-btn-row">
              <button className="ms-btn ms-btn-secondary" onClick={exportMultisigInfo}>
                <Download size={12} /> Export Info
              </button>
              <button className="ms-btn ms-btn-secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={12} /> Import Info
              </button>
              <input ref={fileRef} type="file" accept=".txt" hidden onChange={(e) => e.target.files?.[0] && importMultisigInfo(e.target.files[0])} />
            </div>
          </div>

          {/* Sign multisig tx */}
          <div className="ms-section">
            <div className="ms-section-title">Sign Transaction</div>
            <div className="ms-field">
              <label className="ms-label">Transaction Data (hex)</label>
              <textarea
                className="ms-textarea"
                placeholder="Paste unsigned or partially-signed multisig tx hex..."
                value={signingData}
                onChange={(e) => setSigningData(e.target.value)}
                rows={4}
                spellCheck={false}
              />
            </div>
            <div className="ms-btn-row">
              <button className="ms-btn ms-btn-primary" onClick={signMultisig} disabled={signingLoading || !signingData.trim()}>
                {signingLoading ? <><Loader2 size={12} className="spin" /> Signing...</> : 'Sign'}
              </button>
              {signResult && (
                <button className="ms-btn ms-btn-primary" onClick={submitMultisig} disabled={signingLoading}>
                  Submit to Network
                </button>
              )}
            </div>

            {signResult && (
              <div className="ms-result">
                <div className="ms-result-header">
                  <span>Signed Transaction</span>
                  <button className="ms-copy-btn" onClick={() => handleCopy(signResult)}>
                    {copied ? <><Check size={11} style={{ color: '#22c55e' }} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <div className="ms-result-text">{signResult.slice(0, 200)}...</div>
              </div>
            )}

            {signingError && (
              <div className="ms-error"><AlertTriangle size={12} /> {signingError}</div>
            )}
          </div>
        </>
      )}

      {/* Setup wizard (only if not yet multisig) */}
      {!status?.multisig && (
        <>
          {!setupActive ? (
            <button className="ms-btn ms-btn-primary" onClick={() => setSetupActive(true)}>
              Begin Multisig Setup
            </button>
          ) : (
            <div className="ms-setup">
              <div className="ms-section-title">Setup Wizard</div>

              {/* Step indicators */}
              <div className="ms-steps">
                {(['prepare', 'make', 'exchange', 'done'] as SetupStep[]).map((s, i) => (
                  <div key={s} className={`ms-step ${setupStep === s ? 'ms-step-active' : i < ['prepare', 'make', 'exchange', 'done'].indexOf(setupStep) ? 'ms-step-done' : ''}`}>
                    <div className="ms-step-num">{i + 1}</div>
                    <span>{s === 'prepare' ? 'Prepare' : s === 'make' ? 'Create' : s === 'exchange' ? 'Exchange' : 'Done'}</span>
                  </div>
                ))}
              </div>

              {setupStep === 'prepare' && (
                <div className="ms-setup-content">
                  <div className="ms-field">
                    <label className="ms-label">Threshold (M)</label>
                    <input className="ms-input ms-input-sm" type="number" min={2} max={totalSigners} value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) || 2)} />
                  </div>
                  <div className="ms-field">
                    <label className="ms-label">Total Signers (N)</label>
                    <input className="ms-input ms-input-sm" type="number" min={2} max={16} value={totalSigners} onChange={(e) => setTotalSigners(parseInt(e.target.value) || 3)} />
                  </div>
                  <div className="ms-section-desc">
                    This creates a {threshold}-of-{totalSigners} multisig wallet. You need {threshold} out of {totalSigners} signatures to spend.
                  </div>
                  <button className="ms-btn ms-btn-primary" onClick={prepareMultisig} disabled={setupLoading}>
                    {setupLoading ? <><Loader2 size={12} className="spin" /> Preparing...</> : 'Prepare Multisig Info'}
                  </button>
                </div>
              )}

              {setupStep === 'make' && (
                <div className="ms-setup-content">
                  <div className="ms-section-desc">
                    Share your info string below with all other participants. Then paste their info strings (one per line).
                  </div>
                  <div className="ms-field">
                    <label className="ms-label">Your Multisig Info</label>
                    <div className="ms-info-box">
                      <div className="ms-info-text">{myInfo}</div>
                      <button className="ms-copy-btn" onClick={() => handleCopy(myInfo)}>
                        {copied ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                  <div className="ms-field">
                    <label className="ms-label">Other Participants' Info (one per line)</label>
                    <textarea
                      className="ms-textarea"
                      placeholder="Paste each participant's info on a separate line..."
                      value={othersInfo}
                      onChange={(e) => setOthersInfo(e.target.value)}
                      rows={4}
                      spellCheck={false}
                    />
                  </div>
                  <button className="ms-btn ms-btn-primary" onClick={makeMultisig} disabled={setupLoading}>
                    {setupLoading ? <><Loader2 size={12} className="spin" /> Creating...</> : 'Create Multisig'}
                  </button>
                </div>
              )}

              {setupStep === 'exchange' && (
                <div className="ms-setup-content">
                  <div className="ms-section-desc">
                    Additional key exchange round {exchangeRoundsLeft} required. Share the updated info and paste others' responses.
                  </div>
                  <div className="ms-field">
                    <label className="ms-label">Your Updated Info</label>
                    <div className="ms-info-box">
                      <div className="ms-info-text">{myInfo}</div>
                      <button className="ms-copy-btn" onClick={() => handleCopy(myInfo)}>
                        {copied ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                  <div className="ms-field">
                    <label className="ms-label">Others' Updated Info (one per line)</label>
                    <textarea
                      className="ms-textarea"
                      placeholder="Paste each participant's info..."
                      value={othersInfo}
                      onChange={(e) => setOthersInfo(e.target.value)}
                      rows={4}
                      spellCheck={false}
                    />
                  </div>
                  <button className="ms-btn ms-btn-primary" onClick={exchangeKeys} disabled={setupLoading}>
                    {setupLoading ? <><Loader2 size={12} className="spin" /> Exchanging...</> : 'Exchange Keys'}
                  </button>
                </div>
              )}

              {setupStep === 'done' && (
                <div className="ms-setup-content" style={{ textAlign: 'center', padding: '24px 0' }}>
                  <Shield size={32} style={{ color: '#22c55e', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Multisig Setup Complete</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Your wallet is now a {threshold}-of-{totalSigners} multisig wallet.
                  </div>
                </div>
              )}

              {setupError && (
                <div className="ms-error"><AlertTriangle size={12} /> {setupError}</div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        .ms-root { max-width: 640px; }
        .ms-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 16px; }

        .ms-status-card { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 12px; }
        .ms-status-text { font-size: 13px; font-weight: 500; color: var(--text); }
        .ms-status-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

        .ms-warning { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2); border-radius: var(--radius-sm); color: #f59e0b; font-size: 11px; line-height: 1.4; margin-bottom: 16px; }

        .ms-section { margin-bottom: 20px; }
        .ms-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .ms-section-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.4; }

        .ms-field { margin-bottom: 10px; }
        .ms-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px; }
        .ms-input { padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); box-sizing: border-box; }
        .ms-input:focus { outline: none; border-color: #ff6600; }
        .ms-input-sm { max-width: 120px; }
        .ms-textarea { width: 100%; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 11px; font-family: var(--font-mono); resize: vertical; box-sizing: border-box; }
        .ms-textarea:focus { outline: none; border-color: #ff6600; }

        .ms-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .ms-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: var(--radius-sm); font-size: 12px; font-family: var(--font-sans); cursor: pointer; border: none; }
        .ms-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ms-btn-primary { background: #ff6600; color: white; }
        .ms-btn-primary:hover:not(:disabled) { background: #e65c00; }
        .ms-btn-secondary { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
        .ms-btn-secondary:hover:not(:disabled) { background: var(--surface-hover); }

        .ms-info-box { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .ms-info-text { flex: 1; font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); word-break: break-all; line-height: 1.5; }
        .ms-copy-btn { display: flex; align-items: center; gap: 4px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 6px; color: var(--text-muted); cursor: pointer; font-size: 11px; font-family: var(--font-sans); flex-shrink: 0; }
        .ms-copy-btn:hover { color: var(--text); border-color: var(--text-muted); }

        .ms-result { margin-top: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .ms-result-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--surface); font-size: 12px; font-weight: 500; color: var(--text); }
        .ms-result-text { padding: 8px 12px; font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); word-break: break-all; background: var(--bg); }

        .ms-setup { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; background: var(--surface); }
        .ms-setup-content { margin-top: 16px; }

        .ms-steps { display: flex; gap: 4px; }
        .ms-step { display: flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: 11px; color: var(--text-muted); border-radius: var(--radius-sm); }
        .ms-step-num { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; }
        .ms-step-active { color: #ff6600; }
        .ms-step-active .ms-step-num { border-color: #ff6600; background: rgba(255,102,0,0.1); color: #ff6600; }
        .ms-step-done { color: #22c55e; }
        .ms-step-done .ms-step-num { border-color: #22c55e; background: rgba(34,197,94,0.1); color: #22c55e; }

        .ms-error { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-sm); color: #ef4444; font-size: 12px; margin-top: 10px; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
