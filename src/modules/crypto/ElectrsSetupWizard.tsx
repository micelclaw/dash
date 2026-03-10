import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from './CryptoLogs';
import { WIZARD_STYLES } from './wizard-styles';

type Step = 'configure' | 'installing' | 'done' | 'error';
type WizardMode = 'install' | 'configure';

interface ElectrsConfig {
  log_filters: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

interface Props {
  mode: WizardMode;
  btcFullNode?: boolean; // true if BTC is prune=0 + txindex=1
  onClose: () => void;
  onDone: () => void;
}

const DEFAULTS: ElectrsConfig = { log_filters: 'INFO' };

export function ElectrsSetupWizard({ mode, btcFullNode, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('configure');
  const [config, setConfig] = useState<ElectrsConfig>({ ...DEFAULTS });
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'configure') {
      api.get<{ data: ElectrsConfig }>('/crypto/electrs/config')
        .then(res => setConfig({ ...DEFAULTS, ...res.data }))
        .catch(() => {});
    }
  }, [mode]);

  const canInstall = btcFullNode !== false;

  const handleInstall = async () => {
    setStep('installing');
    setError(null);
    try {
      await api.post('/crypto/electrs/start', { config });
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to install Electrum Server');
      setStep('error');
    }
  };

  const handleConfigure = async () => {
    if (!confirmRestart) {
      setConfirmRestart(true);
      return;
    }
    setStep('installing');
    setError(null);
    try {
      await api.put('/crypto/electrs/config', config);
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to update config');
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
        width: 480, maxHeight: '85vh',
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
            <span style={{ fontSize: 16 }}>&#9889;</span>
            {step === 'configure' && (mode === 'install' ? 'Install Electrum Server' : 'Electrs Settings')}
            {step === 'installing' && (mode === 'install' ? 'Installing Electrum Server' : 'Restarting Electrum Server')}
            {step === 'done' && 'Electrum Server Ready'}
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

          {step === 'configure' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Requirements banner */}
              <div style={{
                padding: 12,
                background: !canInstall && mode === 'install' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${!canInstall && mode === 'install' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                  Requirements
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Electrum Server indexes the full Bitcoin blockchain directly from disk. It requires Bitcoin Core configured as a <strong style={{ color: 'var(--text)' }}>full node</strong> with:
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <li><code style={{ color: 'var(--text)' }}>prune=0</code> — Full blockchain (no pruning)</li>
                  <li><code style={{ color: 'var(--text)' }}>txindex=1</code> — Transaction index enabled</li>
                </ul>
                {!canInstall && mode === 'install' && (
                  <div className="wizard-error-banner" style={{ marginTop: 8 }}>
                    <AlertTriangle size={12} />
                    <span>Bitcoin Core is not configured as a full node. Update Bitcoin Core settings first.</span>
                  </div>
                )}
              </div>

              {/* Log Level */}
              <div>
                <div className="wizard-section-title">Log Level</div>
                <select
                  className="wizard-select"
                  value={config.log_filters}
                  onChange={e => setConfig({ log_filters: e.target.value as ElectrsConfig['log_filters'] })}
                >
                  <option value="DEBUG">Debug</option>
                  <option value="INFO">Info (default)</option>
                  <option value="WARN">Warn</option>
                  <option value="ERROR">Error</option>
                </select>
              </div>

              <div className="wizard-info">
                Electrs will build its own index of the Bitcoin blockchain. Initial indexing may take several hours.
              </div>

              {/* Confirm restart */}
              {confirmRestart && mode === 'configure' && (
                <div className="wizard-confirm-box">
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                    Restart Required
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    This will restart Electrum Server. Index will be preserved.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="wizard-btn-secondary" onClick={() => setConfirmRestart(false)}>Cancel</button>
                    <button className="wizard-btn-primary" onClick={handleConfigure}>Restart Now</button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!confirmRestart && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="wizard-btn-secondary" onClick={onClose}>Cancel</button>
                  {mode === 'install' ? (
                    <button className="wizard-btn-primary" onClick={handleInstall} disabled={!canInstall}>Install</button>
                  ) : (
                    <button className="wizard-btn-primary" onClick={handleConfigure}>Apply &amp; Restart</button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'installing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <Loader2 size={32} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                {mode === 'install' ? 'Installing Electrum Server...' : 'Restarting Electrum Server...'}
              </div>
              <div style={{ width: '100%', marginTop: 8 }}>
                <CryptoLogs service="electrs" active tail={8} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                {mode === 'install' ? 'Electrum Server installed successfully' : 'Configuration applied'}
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
                <button className="wizard-btn-primary" onClick={() => setStep('configure')}>Retry</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{WIZARD_STYLES}</style>
    </>
  );
}
