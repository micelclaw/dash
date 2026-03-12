import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, CreditCard } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from './CryptoLogs';
import { WIZARD_STYLES } from './wizard-styles';

type Step = 'info' | 'installing' | 'done' | 'error';

interface Props {
  btcRunning?: boolean;
  lightningRunning?: boolean;
  onClose: () => void;
  onDone: () => void;
}

async function waitForService(service: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await api.get<{ data: { services: Array<{ name: string; running: boolean }> } }>('/crypto/status');
      const svc = res.data.services.find((s: any) => s.name === service);
      if (svc?.running) return true;
    } catch { /* ignore */ }
  }
  return false;
}

export function BtcPayInstallPanel({ btcRunning, lightningRunning, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('info');
  const [error, setError] = useState<string | null>(null);

  const canInstall = btcRunning !== false;

  const handleInstall = async () => {
    setStep('installing');
    setError(null);
    try {
      await api.post('/crypto/btcpay/start');
      await waitForService('btcpay', 120_000);
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to install BTCPay Server');
      setStep('error');
    }
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
            <CreditCard size={16} style={{ color: '#51b13e' }} />
            {step === 'info' && 'Install BTCPay Server'}
            {step === 'installing' && 'Installing BTCPay Server'}
            {step === 'done' && 'BTCPay Server Ready'}
            {step === 'error' && 'Error'}
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

          {step === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Self-hosted payment processor with built-in hot wallet. Works with pruned Bitcoin Core via RPC. Optional Lightning Network for instant payments.
              </div>

              {/* Dependencies */}
              <div>
                <div className="wizard-section-title">Dependencies</div>
                <div className="wizard-dep-row">
                  <span className="wizard-dep-dot" style={{ background: canInstall ? '#22c55e' : '#6b7280' }} />
                  <span>Bitcoin Core</span>
                  <span className="wizard-dep-label">{canInstall ? 'Running' : 'Required'}</span>
                </div>
                <div className="wizard-dep-row">
                  <span className="wizard-dep-dot" style={{ background: lightningRunning ? '#22c55e' : '#f59e0b' }} />
                  <span>Core Lightning</span>
                  <span className="wizard-dep-label">{lightningRunning ? 'Running' : 'Recommended'}</span>
                </div>
              </div>

              {!canInstall && (
                <div className="wizard-warning">
                  <AlertTriangle size={12} />
                  <span>Bitcoin Core must be running before installing BTCPay Server.</span>
                </div>
              )}

              {canInstall && !lightningRunning && (
                <div className="wizard-info">
                  Lightning is optional but recommended for instant payments with low fees.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="wizard-btn-secondary" onClick={onClose}>Cancel</button>
                <button className="wizard-btn-primary" onClick={handleInstall} disabled={!canInstall}>Install</button>
              </div>
            </div>
          )}

          {step === 'installing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <Loader2 size={32} style={{ color: '#51b13e', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                Installing BTCPay Server...
              </div>
              <div style={{ width: '100%', marginTop: 8 }}>
                <CryptoLogs service="btcpay" active tail={8} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                BTCPay Server installed successfully
              </div>
              <button className="wizard-btn-primary" onClick={onDone}>Done</button>
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
                <button className="wizard-btn-primary" onClick={() => setStep('info')}>Retry</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{WIZARD_STYLES}</style>
    </>
  );
}
