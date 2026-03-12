import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from '../shared/CryptoLogs';
import { WIZARD_STYLES } from '../shared/wizard-styles';

type Step = 'configure' | 'installing' | 'done' | 'error';
type WizardMode = 'install' | 'configure';

interface MoneroConfig {
  prune: boolean;
  db_sync_mode: 'safe' | 'fast' | 'fastest';
  out_peers: number;
  in_peers: number;
}

interface Props {
  mode: WizardMode;
  onClose: () => void;
  onDone: () => void;
}

const PEER_OPTIONS = [8, 16, 32, 64];

const PRUNE_OPTIONS = [
  { value: true, label: 'Pruned · ~50 GB', desc: 'Removes old blocks after verification. Recommended.', eta: 'IBD: ~2-3 days' },
  { value: false, label: 'Full Node · ~200 GB', desc: 'Complete blockchain history retained on disk.', eta: 'IBD: ~3-5 days' },
];

const DEFAULTS: MoneroConfig = {
  prune: true,
  db_sync_mode: 'safe',
  out_peers: 16,
  in_peers: 32,
};

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

export function MoneroSetupWizard({ mode, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('configure');
  const [config, setConfig] = useState<MoneroConfig>({ ...DEFAULTS });
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'configure') {
      api.get<{ data: MoneroConfig }>('/crypto/monero/config')
        .then(res => setConfig({ ...DEFAULTS, ...res.data }))
        .catch(() => {});
    }
  }, [mode]);

  const update = (partial: Partial<MoneroConfig>) =>
    setConfig(prev => ({ ...prev, ...partial }));

  const handleInstall = async () => {
    setStep('installing');
    setError(null);
    try {
      await api.post('/crypto/monerod/start', { config });
      await waitForService('monerod', 60_000);
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to install Monero Node');
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
      await api.put('/crypto/monero/config', config);
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
            <span style={{ fontSize: 16, color: '#ff6600' }}>&#9399;</span>
            {step === 'configure' && (mode === 'install' ? 'Configure Monero Node' : 'Monero Settings')}
            {step === 'installing' && (mode === 'install' ? 'Installing Monero Node' : 'Restarting Monero Node')}
            {step === 'done' && 'Monero Node Ready'}
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

              {/* Storage Mode */}
              <div>
                <div className="wizard-section-title">Storage Mode</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {PRUNE_OPTIONS.map(opt => (
                    <label key={String(opt.value)} className="wizard-radio" style={{ border: config.prune === opt.value ? '1px solid var(--amber)' : '1px solid var(--border)' }}>
                      <input
                        type="radio"
                        name="prune"
                        checked={config.prune === opt.value}
                        onChange={() => update({ prune: opt.value })}
                        style={{ accentColor: 'var(--amber)', marginTop: 2 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div className="wizard-radio-label">{opt.label}</div>
                          <div className="wizard-radio-eta">{opt.eta}</div>
                        </div>
                        <div className="wizard-radio-desc">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="wizard-info" style={{ marginTop: 8 }}>
                  Monero is independent from Bitcoin Core and can sync in parallel.
                </div>
              </div>

              {/* Sync Performance */}
              <div>
                <div className="wizard-section-title">Sync Performance</div>
                <div>
                  <div className="wizard-field-label">DB Sync Mode</div>
                  <select
                    className="wizard-select"
                    value={config.db_sync_mode}
                    onChange={e => update({ db_sync_mode: e.target.value as MoneroConfig['db_sync_mode'] })}
                  >
                    <option value="safe">Safe (crash-safe, recommended)</option>
                    <option value="fast">Fast (better performance)</option>
                    <option value="fastest">Fastest (risk of data loss on crash)</option>
                  </select>
                </div>
              </div>

              {/* Network */}
              <div>
                <div className="wizard-section-title">Network</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div className="wizard-field-label">Outbound Peers</div>
                    <select
                      className="wizard-select"
                      value={config.out_peers}
                      onChange={e => update({ out_peers: Number(e.target.value) })}
                    >
                      {PEER_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="wizard-field-label">Inbound Peers</div>
                    <select
                      className="wizard-select"
                      value={config.in_peers}
                      onChange={e => update({ in_peers: Number(e.target.value) })}
                    >
                      {PEER_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Confirm restart */}
              {confirmRestart && mode === 'configure' && (
                <div className="wizard-confirm-box">
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                    Restart Required
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    This will restart the Monero Node. Sync progress will be preserved.
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
                    <button className="wizard-btn-primary" onClick={handleInstall}>Install</button>
                  ) : (
                    <button className="wizard-btn-primary" onClick={handleConfigure}>Apply &amp; Restart</button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'installing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <Loader2 size={32} style={{ color: '#ff6600', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                {mode === 'install' ? 'Installing Monero Node...' : 'Restarting Monero Node...'}
              </div>
              <div style={{ width: '100%', marginTop: 8 }}>
                <CryptoLogs service="monerod" active tail={8} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                {mode === 'install' ? 'Monero Node installed successfully' : 'Configuration applied'}
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
