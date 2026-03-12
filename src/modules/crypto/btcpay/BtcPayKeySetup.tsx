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

import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, Key, ExternalLink } from 'lucide-react';
import { api } from '@/services/api';
import { WIZARD_STYLES } from '../shared/wizard-styles';

type Step = 'input' | 'validating' | 'done' | 'error';

interface ConnectResult {
  storeId: string;
  balance: {
    onchain: { confirmed: number; unconfirmed: number };
    lightning: { offchain: number } | null;
  };
}

interface Props {
  onClose: () => void;
  onDone: (result: ConnectResult) => void;
}

export function BtcPayKeySetup({ onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setStep('validating');
    setError(null);
    try {
      const res = await api.post<{ data: ConnectResult }>('/crypto/btcpay/wallet/connect', {
        api_key: apiKey.trim(),
      });
      setResult(res.data as ConnectResult);
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Invalid API key');
      setStep('error');
    }
  };

  const formatBtc = (sats: number) => {
    if (sats === 0) return '0';
    return sats.toFixed(8).replace(/\.?0+$/, '');
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
      />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, maxHeight: '85vh',
        background: 'rgba(17, 17, 24, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            <Key size={16} style={{ color: '#51b13e' }} />
            {step === 'input' && 'Connect Wallet'}
            {step === 'validating' && 'Connecting...'}
            {step === 'done' && 'Wallet Connected'}
            {step === 'error' && 'Connection Failed'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>

          {step === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Generate an API key in BTCPay Server to display your wallet balance here.
              </div>

              <div style={{
                padding: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div className="wizard-section-title">Steps</div>
                <ol style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  <li>Open <strong style={{ color: 'var(--text)' }}>BTCPay Server</strong> (Crypto &rarr; Apps &rarr; BTCPay)</li>
                  <li>Go to <strong style={{ color: 'var(--text)' }}>Account &rarr; Manage Account &rarr; API Keys</strong></li>
                  <li>Click <strong style={{ color: 'var(--text)' }}>Generate Key</strong></li>
                  <li>Enable <strong style={{ color: 'var(--text)' }}>View store info</strong> and <strong style={{ color: 'var(--text)' }}>View invoices</strong> permissions</li>
                  <li>Copy the key and paste it below</li>
                </ol>
                <a
                  href="http://localhost:3003"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    marginTop: 8, fontSize: '0.75rem', color: '#51b13e',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={11} /> Open BTCPay Server
                </a>
              </div>

              <div>
                <div className="wizard-section-title">API Key</div>
                <input
                  className="wizard-input"
                  type="password"
                  placeholder="Paste your BTCPay API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  autoFocus
                />
              </div>

              <div className="wizard-info">
                The key is stored locally and only used to read wallet balance. No funds can be moved with these permissions.
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="wizard-btn-secondary" onClick={onClose}>Cancel</button>
                <button className="wizard-btn-primary" onClick={handleConnect} disabled={!apiKey.trim()}>
                  Connect
                </button>
              </div>
            </div>
          )}

          {step === 'validating' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <Loader2 size={32} style={{ color: '#51b13e', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                Validating API key...
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                Wallet connected successfully
              </div>

              {/* Balance preview */}
              <div style={{
                width: '100%',
                padding: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text)', marginBottom: 6 }}>
                  <span>On-chain</span>
                  <span>{formatBtc(result.balance.onchain.confirmed)} BTC</span>
                </div>
                {result.balance.onchain.unconfirmed > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span>Unconfirmed</span>
                    <span>+{formatBtc(result.balance.onchain.unconfirmed)} BTC</span>
                  </div>
                )}
                {result.balance.lightning && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text)' }}>
                    <span>Lightning</span>
                    <span>{formatBtc(result.balance.lightning.offchain)} BTC</span>
                  </div>
                )}
              </div>

              <button className="wizard-btn-primary" onClick={() => onDone(result)}>Done</button>
            </div>
          )}

          {step === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <AlertTriangle size={32} style={{ color: 'var(--error, #ef4444)' }} />
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                {error}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="wizard-btn-secondary" onClick={onClose}>Close</button>
                <button className="wizard-btn-primary" onClick={() => setStep('input')}>Retry</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{WIZARD_STYLES}</style>
    </>
  );
}
