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

import { useState, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n';
import { Upload, Download, Loader2, CheckCircle, AlertCircle, HardDrive, Wifi, WifiOff, ArrowRight } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';

type Step = 'export-unsigned' | 'import-signed' | 'export-key-images' | 'import-key-images';

export function ColdSigningTab() {
  const { t } = useI18n();
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeAction, setActiveAction] = useState<Step | null>(null);

  const reset = () => {
    setError(null);
    setSuccess(null);
  };

  // Export unsigned tx (view-only wallet creates the tx)
  const exportUnsignedTx = useCallback(async () => {
    setLoading(true);
    reset();
    try {
      const result = await call<{ unsigned_txset: string }>('export_unsigned_tx', {});
      if (result?.unsigned_txset) {
        const blob = new Blob([result.unsigned_txset], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unsigned-tx-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccess(t('crypto.wallet.unsignedExported'));
      } else {
        setError(t('crypto.wallet.noUnsignedData'));
      }
    } catch (err: any) {
      setError(err?.message || t('crypto.wallet.exportUnsignedFailed'));
    } finally {
      setLoading(false);
    }
  }, [call, t]);

  // Import signed tx (view-only wallet submits)
  const importSignedTx = useCallback(async (file: File) => {
    setLoading(true);
    reset();
    try {
      const text = await file.text();
      const result = await call<{ tx_hash_list: string[] }>('submit_transfer', {
        tx_data_hex: text.trim(),
      });
      // submit_transfer requires confirmation — the dialog will handle it
      if (rpc.pendingConfirmation) return;
      if (result?.tx_hash_list?.length) {
        setSuccess(t('crypto.wallet.transactionSubmitted', { hashes: result.tx_hash_list.join(', ') }));
      } else {
        setError(rpc.error || t('crypto.wallet.submitSignedFailed'));
      }
    } catch (err: any) {
      setError(err?.message || t('crypto.wallet.importSignedFailed'));
    } finally {
      setLoading(false);
    }
  }, [call, t]);

  // Export key images (for view-only wallet balance sync)
  const exportKeyImages = useCallback(async () => {
    setLoading(true);
    reset();
    try {
      const result = await call<{ signed_key_images: Array<{ key_image: string; signature: string }> }>('export_key_images', { all: true });
      if (result?.signed_key_images?.length) {
        const blob = new Blob([JSON.stringify(result.signed_key_images, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `key-images-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccess(t('crypto.wallet.exportedKeyImages', { count: result.signed_key_images.length }));
      } else {
        setError(t('crypto.wallet.noKeyImages'));
      }
    } catch (err: any) {
      setError(err?.message || t('crypto.wallet.exportKeyImagesFailed'));
    } finally {
      setLoading(false);
    }
  }, [call, t]);

  // Import key images (view-only wallet imports to track spent outputs)
  const importKeyImages = useCallback(async (file: File) => {
    setLoading(true);
    reset();
    try {
      const text = await file.text();
      const keyImages = JSON.parse(text);
      const result = await call<{ height: number; spent: number; unspent: number }>('import_key_images', {
        signed_key_images: keyImages,
      });
      // import_key_images requires confirmation — the dialog will handle it
      if (rpc.pendingConfirmation) return;
      if (result) {
        setSuccess(t('crypto.wallet.importedKeyImages', { height: result.height, spent: (result.spent / 1e12).toFixed(6), unspent: (result.unspent / 1e12).toFixed(6) }));
      } else {
        setError(rpc.error || t('crypto.wallet.importKeyImagesFailed'));
      }
    } catch (err: any) {
      setError(err?.message || t('crypto.wallet.importKeyImagesFailed'));
    } finally {
      setLoading(false);
    }
  }, [call, t]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAction) return;
    if (activeAction === 'import-signed') importSignedTx(file);
    else if (activeAction === 'import-key-images') importKeyImages(file);
    e.target.value = '';
  };

  const triggerFileInput = (action: Step) => {
    setActiveAction(action);
    fileRef.current?.click();
  };

  return (
    <div className="cs-root">
      <h3 className="cs-title">{t('crypto.wallet.coldSigning')}</h3>

      {/* Workflow guide */}
      <div className="cs-guide">
        <div className="cs-guide-title">{t('crypto.wallet.coldGuide')}</div>
        <div className="cs-workflow">
          <div className="cs-wf-step">
            <div className="cs-wf-icon"><Wifi size={14} /></div>
            <div className="cs-wf-label">{t('crypto.wallet.viewOnlyWallet')}</div>
            <div className="cs-wf-desc">{t('crypto.wallet.createsUnsignedTx')}</div>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div className="cs-wf-step">
            <div className="cs-wf-icon"><WifiOff size={14} /></div>
            <div className="cs-wf-label">{t('crypto.wallet.coldWallet')}</div>
            <div className="cs-wf-desc">{t('crypto.wallet.signsOffline')}</div>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div className="cs-wf-step">
            <div className="cs-wf-icon"><Wifi size={14} /></div>
            <div className="cs-wf-label">{t('crypto.wallet.viewOnlyWallet')}</div>
            <div className="cs-wf-desc">{t('crypto.wallet.broadcastsSignedTx')}</div>
          </div>
        </div>
      </div>

      {/* Transaction signing */}
      <div className="cs-section">
        <div className="cs-section-title">{t('crypto.wallet.transactionSigning')}</div>
        <div className="cs-cards">
          <div className="cs-card">
            <div className="cs-card-header">
              <Download size={14} />
              <span>{t('crypto.wallet.exportUnsignedTx')}</span>
            </div>
            <div className="cs-card-desc">
              {t('crypto.wallet.unsignedTxHelp')}
            </div>
            <button className="cs-btn cs-btn-primary" onClick={exportUnsignedTx} disabled={loading}>
              {loading ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
              {t('crypto.wallet.exportUnsignedTx')}
            </button>
          </div>

          <div className="cs-card">
            <div className="cs-card-header">
              <Upload size={14} />
              <span>{t('crypto.wallet.importSignedTx')}</span>
            </div>
            <div className="cs-card-desc">
              {t('crypto.wallet.signedTxHelp')}
            </div>
            <button className="cs-btn cs-btn-primary" onClick={() => triggerFileInput('import-signed')} disabled={loading}>
              {loading ? <Loader2 size={12} className="spin" /> : <Upload size={12} />}
              {t('crypto.wallet.importSignedTx')}
            </button>
          </div>
        </div>
      </div>

      {/* Key images */}
      <div className="cs-section">
        <div className="cs-section-title">{t('crypto.wallet.keyImages')}</div>
        <div className="cs-section-desc">
          {t('crypto.wallet.keyImagesHelp')}
        </div>
        <div className="cs-cards">
          <div className="cs-card">
            <div className="cs-card-header">
              <HardDrive size={14} />
              <span>{t('crypto.wallet.exportKeyImages')}</span>
            </div>
            <div className="cs-card-desc">
              {t('crypto.wallet.exportFromCold')}
            </div>
            <button className="cs-btn cs-btn-secondary" onClick={exportKeyImages} disabled={loading}>
              {loading ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
              {t('crypto.wallet.export')}
            </button>
          </div>

          <div className="cs-card">
            <div className="cs-card-header">
              <HardDrive size={14} />
              <span>{t('crypto.wallet.importKeyImages')}</span>
            </div>
            <div className="cs-card-desc">
              {t('crypto.wallet.importToViewOnly')}
            </div>
            <button className="cs-btn cs-btn-secondary" onClick={() => triggerFileInput('import-key-images')} disabled={loading}>
              {loading ? <Loader2 size={12} className="spin" /> : <Upload size={12} />}
              {t('crypto.wallet.import')}
            </button>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".txt,.json,.hex" hidden onChange={handleFileSelect} />

      {/* Feedback */}
      {success && (
        <div className="cs-feedback cs-feedback-success">
          <CheckCircle size={13} /> {success}
        </div>
      )}
      {error && (
        <div className="cs-feedback cs-feedback-error">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <style>{`
        .cs-root { max-width: 700px; }
        .cs-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 16px; }

        .cs-guide { padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 20px; }
        .cs-guide-title { font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .cs-workflow { display: flex; align-items: center; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .cs-wf-step { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 100px; }
        .cs-wf-icon { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
        .cs-wf-label { font-size: 11px; font-weight: 500; color: var(--text); }
        .cs-wf-desc { font-size: 10px; color: var(--text-muted); }

        .cs-section { margin-bottom: 20px; }
        .cs-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .cs-section-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.4; }

        .cs-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 560px) { .cs-cards { grid-template-columns: 1fr; } }
        .cs-card { padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 8px; }
        .cs-card-header { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--text); }
        .cs-card-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; flex: 1; }

        .cs-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: var(--radius-sm); font-size: 12px; font-family: var(--font-sans); cursor: pointer; border: none; align-self: flex-start; }
        .cs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cs-btn-primary { background: #ff6600; color: white; }
        .cs-btn-primary:hover:not(:disabled) { background: #e65c00; }
        .cs-btn-secondary { background: var(--bg); border: 1px solid var(--border); color: var(--text); }
        .cs-btn-secondary:hover:not(:disabled) { background: var(--surface-hover); }

        .cs-feedback { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: var(--radius-sm); font-size: 12px; line-height: 1.4; margin-top: 4px; }
        .cs-feedback-success { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2); color: #22c55e; }
        .cs-feedback-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
