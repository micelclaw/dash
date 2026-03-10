import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from './CryptoLogs';
import { WIZARD_STYLES } from './wizard-styles';

type Step = 'configure' | 'installing' | 'done' | 'error';
type WizardMode = 'install' | 'configure';

interface LightningConfig {
  log_level: 'debug' | 'info' | 'unusual' | 'broken';
  alias: string;
  fee_base_msat: number;
  fee_per_satoshi: number;
  network: 'bitcoin' | 'testnet' | 'regtest';
}

interface Props {
  mode: WizardMode;
  btcRunning?: boolean;
  onClose: () => void;
  onDone: () => void;
}

const FEE_BASE_OPTIONS = [100, 500, 1000, 5000];
const FEE_RATE_OPTIONS = [1, 10, 50, 100];

const DEFAULTS: LightningConfig = {
  log_level: 'info',
  alias: '',
  fee_base_msat: 1000,
  fee_per_satoshi: 10,
  network: 'bitcoin',
};

export function LightningSetupWizard({ mode, btcRunning, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('configure');
  const [config, setConfig] = useState<LightningConfig>({ ...DEFAULTS });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing config in configure mode
  useEffect(() => {
    if (mode === 'configure') {
      api.get<{ data: LightningConfig }>('/crypto/lightning/config')
        .then(res => setConfig({ ...DEFAULTS, ...res.data }))
        .catch(() => {});
    }
  }, [mode]);

  const update = (partial: Partial<LightningConfig>) =>
    setConfig(prev => ({ ...prev, ...partial }));

  const canInstall = btcRunning !== false; // undefined = unknown, treat as ok

  const handleInstall = async () => {
    setStep('installing');
    setError(null);
    try {
      await api.post('/crypto/lightning/start', { config });
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to install Core Lightning');
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
      await api.put('/crypto/lightning/config', config);
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
            <Zap size={16} style={{ color: '#f59e0b' }} />
            {step === 'configure' && (mode === 'install' ? 'Configure Core Lightning' : 'Lightning Settings')}
            {step === 'installing' && (mode === 'install' ? 'Installing Core Lightning' : 'Restarting Core Lightning')}
            {step === 'done' && 'Core Lightning Ready'}
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

              {/* Dependency check */}
              {!canInstall && mode === 'install' && (
                <div className="wizard-warning" style={{ padding: 8, background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-sm)' }}>
                  <AlertTriangle size={12} />
                  <span>Bitcoin Core must be running. Lightning connects to it for blockchain data.</span>
                </div>
              )}

              {/* Network */}
              <div>
                <div className="wizard-section-title">Network</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(['bitcoin', 'testnet', 'regtest'] as const).map(net => (
                    <label key={net} className="wizard-radio" style={{ border: config.network === net ? '1px solid var(--amber)' : '1px solid var(--border)' }}>
                      <input
                        type="radio"
                        name="network"
                        checked={config.network === net}
                        onChange={() => update({ network: net })}
                        style={{ accentColor: 'var(--amber)', marginTop: 2 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div className="wizard-radio-label">
                          {net === 'bitcoin' ? 'Bitcoin Mainnet' : net === 'testnet' ? 'Testnet' : 'Regtest'}
                        </div>
                        <div className="wizard-radio-desc">
                          {net === 'bitcoin' && 'Real Bitcoin network with real funds.'}
                          {net === 'testnet' && 'Test network for development. No real value.'}
                          {net === 'regtest' && 'Local regression testing network.'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Node Identity */}
              <div>
                <div className="wizard-section-title">Node Identity</div>
                <div className="wizard-field-label">Alias (optional, max 32 chars)</div>
                <input
                  className="wizard-input"
                  type="text"
                  value={config.alias}
                  maxLength={32}
                  placeholder="my-lightning-node"
                  onChange={e => update({ alias: e.target.value })}
                />
                <div className="wizard-info" style={{ marginTop: 4 }}>
                  Public name visible to other Lightning nodes.
                </div>
              </div>

              {/* Fee Policy */}
              <div>
                <div className="wizard-section-title">Fee Policy</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div className="wizard-field-label">Base Fee (msat)</div>
                    <select
                      className="wizard-select"
                      value={config.fee_base_msat}
                      onChange={e => update({ fee_base_msat: Number(e.target.value) })}
                    >
                      {FEE_BASE_OPTIONS.map(v => <option key={v} value={v}>{v} msat</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="wizard-field-label">Fee Rate (ppm)</div>
                    <select
                      className="wizard-select"
                      value={config.fee_per_satoshi}
                      onChange={e => update({ fee_per_satoshi: Number(e.target.value) })}
                    >
                      {FEE_RATE_OPTIONS.map(v => <option key={v} value={v}>{v} ppm</option>)}
                    </select>
                  </div>
                </div>
                <div className="wizard-info" style={{ marginTop: 4 }}>
                  Fees charged for routing payments through your node.
                </div>
              </div>

              {/* Advanced */}
              <div>
                <button
                  className="wizard-toggle"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? '\u25BE' : '\u25B8'} Advanced
                </button>
                {showAdvanced && (
                  <div className="wizard-advanced-box">
                    <div>
                      <div className="wizard-field-label">Log Level</div>
                      <select
                        className="wizard-select"
                        value={config.log_level}
                        onChange={e => update({ log_level: e.target.value as LightningConfig['log_level'] })}
                      >
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="unusual">Unusual</option>
                        <option value="broken">Broken</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm restart */}
              {confirmRestart && mode === 'configure' && (
                <div className="wizard-confirm-box">
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                    Restart Required
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    This will restart Core Lightning. Channel state will be preserved.
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
                {mode === 'install' ? 'Installing Core Lightning...' : 'Restarting Core Lightning...'}
              </div>
              <div style={{ width: '100%', marginTop: 8 }}>
                <CryptoLogs service="lightning" active tail={8} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                {mode === 'install' ? 'Core Lightning installed successfully' : 'Configuration applied'}
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
