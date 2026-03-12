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
import { X, Loader2, CheckCircle, AlertTriangle, Shield, Zap, Download, HardDrive } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from '../shared/CryptoLogs';
import { WIZARD_STYLES } from '../shared/wizard-styles';

type Step = 'configure' | 'installing' | 'done' | 'error';
type WizardMode = 'install' | 'configure';

interface BtcConfig {
  prune_mb: number;
  dbcache_mb: number;
  max_mempool_mb: number;
  threads: number;
  txindex: boolean;
  zmq_enabled: boolean;
  assumevalid: boolean;
}

interface SyncTask {
  type: 'utxo-snapshot' | 'bootstrap';
  status: 'downloading' | 'extracting' | 'loading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface Props {
  mode: WizardMode;
  initialConfig?: Partial<BtcConfig>;
  onClose: () => void;
  onDone: () => void;
}

const PRUNE_OPTIONS = [
  { value: 550, label: 'Pruned \u00B7 550 MB', desc: 'Minimum disk usage. Deletes old blocks after verification.', eta: 'IBD: ~2-4 days' },
  { value: 5000, label: 'Pruned \u00B7 5 GB', desc: 'Good balance for personal use. Retains recent blocks.', eta: 'IBD: ~2-4 days' },
  { value: 50000, label: 'Pruned \u00B7 50 GB', desc: 'More block history retained. Faster deep reorgs.', eta: 'IBD: ~2-4 days' },
  { value: 0, label: 'Full Node \u00B7 ~600 GB', desc: 'Complete blockchain + txindex. Enables Electrum Server.', eta: 'IBD: ~4-7 days' },
];

const DBCACHE_OPTIONS = [150, 300, 450, 600];
const MEMPOOL_OPTIONS = [25, 50, 100, 300];
const THREAD_OPTIONS = [1, 2, 4];

const DEFAULTS: BtcConfig = {
  prune_mb: 550, dbcache_mb: 300, max_mempool_mb: 50,
  threads: 2, txindex: false, zmq_enabled: true, assumevalid: true,
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

export function BtcSetupWizard({ mode, initialConfig, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('configure');
  const [config, setConfig] = useState<BtcConfig>({ ...DEFAULTS, ...initialConfig });
  const [configLoaded, setConfigLoaded] = useState(mode === 'install');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSyncAccel, setShowSyncAccel] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch persisted config when opening in configure mode
  useEffect(() => {
    if (mode !== 'configure') return;
    let cancelled = false;
    api.get<{ data: BtcConfig }>('/crypto/btc/config')
      .then(res => {
        if (cancelled) return;
        const persisted = (res as any).data ?? res;
        setConfig(prev => ({ ...prev, ...persisted }));
        setConfigLoaded(true);
      })
      .catch(() => { if (!cancelled) setConfigLoaded(true); });
    return () => { cancelled = true; };
  }, [mode]);

  // Sync acceleration state
  const [syncTask, setSyncTask] = useState<SyncTask | null>(null);
  const [bootstrapUrl, setBootstrapUrl] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState('');

  const isPruned = config.prune_mb > 0;

  const update = (partial: Partial<BtcConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      // Full node: auto-enable txindex; Pruned: force-disable txindex
      if ('prune_mb' in partial) {
        if (partial.prune_mb === 0) {
          next.txindex = true;
        } else {
          next.txindex = false;
        }
      }
      return next;
    });
  };

  // Poll sync task status when active
  const pollSyncTask = useCallback(async () => {
    try {
      const res = await api.get<{ data: SyncTask | null }>('/crypto/btc/sync-task');
      const task = (res.data as any) ?? null;
      setSyncTask(task);
      return task;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!syncTask || syncTask.status === 'done' || syncTask.status === 'error') return;
    const interval = setInterval(pollSyncTask, 2000);
    return () => clearInterval(interval);
  }, [syncTask, pollSyncTask]);

  const handleLoadSnapshot = async () => {
    if (!snapshotUrl) return;
    try {
      await api.post('/crypto/btc/load-snapshot', { url: snapshotUrl });
      setSyncTask({ type: 'utxo-snapshot', status: 'downloading', progress: 0 });
    } catch (err: any) {
      setSyncTask({ type: 'utxo-snapshot', status: 'error', progress: 0, error: err?.message || 'Failed to start' });
    }
  };

  const handleBootstrap = async () => {
    if (!bootstrapUrl || !bootstrapUrl.startsWith('https://')) return;
    try {
      await api.post('/crypto/btc/bootstrap', { url: bootstrapUrl });
      setSyncTask({ type: 'bootstrap', status: 'downloading', progress: 0 });
    } catch (err: any) {
      setSyncTask({ type: 'bootstrap', status: 'error', progress: 0, error: err?.message || 'Failed to start' });
    }
  };

  const handleInstall = async () => {
    setStep('installing');
    setError(null);
    try {
      await api.post('/crypto/bitcoind/start', { config });
      await waitForService('bitcoind', 60_000);
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to install Bitcoin Core');
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
      await api.put('/crypto/btc/config', config);
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to update config');
      setStep('error');
    }
  };

  const syncTaskActive = syncTask && syncTask.status !== 'done' && syncTask.status !== 'error';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
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
            <span style={{ fontSize: 18 }}>&#8383;</span>
            {step === 'configure' && (mode === 'install' ? 'Configure Bitcoin Core' : 'Bitcoin Core Settings')}
            {step === 'installing' && (mode === 'install' ? 'Installing Bitcoin Core' : 'Restarting Bitcoin Core')}
            {step === 'done' && 'Bitcoin Core Ready'}
            {step === 'error' && 'Error'}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>

          {/* ─── Loading config ─── */}
          {step === 'configure' && !configLoaded && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8 }}>
              <Loader2 size={16} className="spin" style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading configuration...</span>
            </div>
          )}

          {/* ─── Configure step ─── */}
          {step === 'configure' && configLoaded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Storage Mode */}
              <div>
                <div className="wizard-section-title">Storage Mode</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {PRUNE_OPTIONS.map(opt => (
                    <label key={opt.value} className="wizard-radio" style={{ border: config.prune_mb === opt.value ? '1px solid var(--amber)' : '1px solid var(--border)' }}>
                      <input
                        type="radio"
                        name="prune"
                        checked={config.prune_mb === opt.value}
                        onChange={() => update({ prune_mb: opt.value })}
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
                  All modes download and verify the full blockchain. Pruned modes delete old blocks after verification. Times depend on CPU, SSD, and internet speed.
                </div>
                {!isPruned && (
                  <div className="wizard-warning" style={{ marginTop: 6 }}>
                    <AlertTriangle size={12} /> Requires ~600 GB of free disk space.
                  </div>
                )}
                {isPruned && (
                  <div className="wizard-info" style={{ marginTop: 4 }}>
                    Electrum Server requires Full Node mode.
                  </div>
                )}
              </div>

              {/* Performance */}
              <div>
                <div className="wizard-section-title">Performance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <div className="wizard-field-label">DB Cache</div>
                    <select
                      className="wizard-select"
                      value={config.dbcache_mb}
                      onChange={e => update({ dbcache_mb: Number(e.target.value) })}
                    >
                      {DBCACHE_OPTIONS.map(v => <option key={v} value={v}>{v} MB</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="wizard-field-label">Mempool</div>
                    <select
                      className="wizard-select"
                      value={config.max_mempool_mb}
                      onChange={e => update({ max_mempool_mb: Number(e.target.value) })}
                    >
                      {MEMPOOL_OPTIONS.map(v => <option key={v} value={v}>{v} MB</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="wizard-field-label">Threads</div>
                    <select
                      className="wizard-select"
                      value={config.threads}
                      onChange={e => update({ threads: Number(e.target.value) })}
                    >
                      {THREAD_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sync Acceleration */}
              <div>
                <button
                  className="wizard-toggle"
                  onClick={() => setShowSyncAccel(!showSyncAccel)}
                >
                  {showSyncAccel ? '\u25BE' : '\u25B8'} Sync Acceleration
                </button>
                {showSyncAccel && (
                  <div className="wizard-advanced-box" style={{ gap: 12 }}>

                    {/* 1. Assume Valid */}
                    <div className="sa-card">
                      <div className="sa-card-header">
                        <Shield size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                        <span className="sa-card-title">Assume Valid</span>
                        <span className="sa-badge sa-badge-green">recommended</span>
                      </div>
                      <div className="sa-card-desc">
                        Skips script validation for blocks before a known-valid checkpoint. Enabled by default in Bitcoin Core. ~30-40% faster IBD.
                      </div>
                      <label className="wizard-checkbox" style={{ marginTop: 6 }}>
                        <input
                          type="checkbox"
                          checked={config.assumevalid}
                          onChange={e => update({ assumevalid: e.target.checked })}
                          style={{ accentColor: 'var(--amber)' }}
                        />
                        <div>
                          <span>Enable Assume Valid (skip old script validation)</span>
                          <span className="wizard-checkbox-note">Recommended. ~30-40% faster IBD. Uncheck only for maximum security paranoia.</span>
                        </div>
                      </label>
                    </div>

                    {/* 2. UTXO Snapshot (AssumeUTXO) */}
                    <div className="sa-card">
                      <div className="sa-card-header">
                        <Zap size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        <span className="sa-card-title">UTXO Snapshot (AssumeUTXO)</span>
                      </div>
                      <div className="sa-card-desc">
                        Load a pre-verified UTXO snapshot for instant wallet availability. Full validation continues in the background. Requires Bitcoin Core 28+.
                      </div>
                      <div className="sa-card-detail">
                        Trustless: your node re-validates everything after loading. No third-party trust needed.
                      </div>
                      {mode === 'install' && (
                        <div className="sa-card-detail" style={{ color: 'var(--text-dim)' }}>
                          Available after Bitcoin Core is installed and running.
                        </div>
                      )}
                      {mode === 'configure' && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            type="text"
                            className="wizard-select"
                            placeholder="UTXO snapshot URL (.dat)"
                            value={snapshotUrl}
                            onChange={e => setSnapshotUrl(e.target.value)}
                            style={{ width: '100%', fontSize: '0.75rem' }}
                          />
                          <button
                            className="wizard-btn-primary"
                            style={{ fontSize: '0.75rem', padding: '5px 12px', alignSelf: 'flex-start' }}
                            disabled={!snapshotUrl || !!syncTaskActive}
                            onClick={handleLoadSnapshot}
                          >
                            <Download size={12} /> Download &amp; Load
                          </button>
                        </div>
                      )}
                      {syncTask?.type === 'utxo-snapshot' && (
                        <SyncProgress task={syncTask} />
                      )}
                    </div>

                    {/* 3. Bootstrap from Snapshot */}
                    <div className="sa-card">
                      <div className="sa-card-header">
                        <Download size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span className="sa-card-title">Bootstrap from Snapshot</span>
                      </div>
                      <div className="sa-card-desc">
                        Download pre-synced blockchain data from an external source. Much faster than syncing from scratch.
                      </div>
                      <div className="sa-warning-box">
                        <AlertTriangle size={12} />
                        <div>
                          <strong>Security warning:</strong> You are trusting the data provider. A malicious snapshot could include fabricated transactions. Only use sources you fully trust.
                        </div>
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          type="text"
                          className="wizard-select"
                          placeholder="https://trusted-source.org/blockchain.tar.gz"
                          value={bootstrapUrl}
                          onChange={e => setBootstrapUrl(e.target.value)}
                          style={{ width: '100%', fontSize: '0.75rem' }}
                        />
                        <button
                          className="wizard-btn-primary"
                          style={{ fontSize: '0.75rem', padding: '5px 12px', alignSelf: 'flex-start' }}
                          disabled={!bootstrapUrl || !bootstrapUrl.startsWith('https://') || !!syncTaskActive}
                          onClick={handleBootstrap}
                        >
                          <Download size={12} /> Download &amp; Extract
                        </button>
                        {mode === 'configure' && (
                          <div className="sa-card-detail" style={{ color: 'var(--text-dim)' }}>
                            Bitcoin Core will be stopped during extraction, then restarted automatically.
                          </div>
                        )}
                      </div>
                      {syncTask?.type === 'bootstrap' && (
                        <SyncProgress task={syncTask} />
                      )}
                    </div>

                    {/* 4. Cache Optimization */}
                    <div className="sa-card">
                      <div className="sa-card-header">
                        <HardDrive size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span className="sa-card-title">Cache Optimization</span>
                      </div>
                      <div className="sa-card-desc">
                        Higher DB cache = faster initial sync. Increasing from 300 MB (default) to 600 MB can reduce IBD time by 30-40%. Only significant during initial blockchain download.
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="wizard-field-label" style={{ margin: 0, fontSize: '0.6875rem' }}>DB Cache:</span>
                        <select
                          className="wizard-select"
                          value={config.dbcache_mb}
                          onChange={e => update({ dbcache_mb: Number(e.target.value) })}
                          style={{ width: 'auto', fontSize: '0.75rem' }}
                        >
                          {DBCACHE_OPTIONS.map(v => <option key={v} value={v}>{v} MB</option>)}
                        </select>
                        {config.dbcache_mb >= 450 && (
                          <span style={{ fontSize: '0.6875rem', color: '#22c55e' }}>faster sync</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                    <label className="wizard-checkbox">
                      <input
                        type="checkbox"
                        checked={config.txindex}
                        disabled={isPruned}
                        onChange={e => update({ txindex: e.target.checked })}
                        style={{ accentColor: 'var(--amber)' }}
                      />
                      <div>
                        <span>Transaction Index (txindex)</span>
                        {isPruned && <span className="wizard-checkbox-note">Not available in pruned mode</span>}
                      </div>
                    </label>
                    <label className="wizard-checkbox">
                      <input
                        type="checkbox"
                        checked={config.zmq_enabled}
                        onChange={e => update({ zmq_enabled: e.target.checked })}
                        style={{ accentColor: 'var(--amber)' }}
                      />
                      <div>
                        <span>ZMQ Notifications</span>
                        <span className="wizard-checkbox-note">Required for Lightning Network</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Confirm restart dialog (configure mode only) */}
              {confirmRestart && mode === 'configure' && (
                <div className="wizard-confirm-box">
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                    Restart Required
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    This will restart Bitcoin Core. Sync progress will be preserved.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="wizard-btn-secondary" onClick={() => setConfirmRestart(false)}>Cancel</button>
                    <button className="wizard-btn-primary" onClick={handleConfigure}>Restart Now</button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
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

          {/* ─── Installing step ─── */}
          {step === 'installing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <Loader2 size={32} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                {mode === 'install' ? 'Installing Bitcoin Core...' : 'Restarting Bitcoin Core...'}
              </div>
              <div style={{ width: '100%', marginTop: 8 }}>
                <CryptoLogs service="bitcoind" active tail={8} />
              </div>
            </div>
          )}

          {/* ─── Done step ─── */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                {mode === 'install' ? 'Bitcoin Core installed successfully' : 'Configuration applied'}
              </div>
              <button className="wizard-btn-primary" onClick={onDone}>Done</button>
            </div>
          )}

          {/* ─── Error step ─── */}
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
      <style>{SYNC_ACCEL_STYLES}</style>
    </>
  );
}

// ─── Sync progress sub-component ──────────────────────────────────────

function SyncProgress({ task }: { task: SyncTask }) {
  const labels: Record<string, string> = {
    downloading: 'Downloading...',
    extracting: 'Extracting...',
    loading: 'Loading into Bitcoin Core...',
    done: 'Complete',
    error: 'Failed',
  };

  return (
    <div className="sa-progress" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', marginBottom: 4 }}>
        <span style={{ color: task.status === 'error' ? 'var(--error, #ef4444)' : 'var(--text-dim)' }}>
          {labels[task.status] || task.status}
        </span>
        {task.status !== 'error' && task.status !== 'done' && (
          <span style={{ color: 'var(--text-dim)' }}>{task.progress}%</span>
        )}
      </div>
      {task.status !== 'error' && (
        <div className="sa-progress-track">
          <div
            className="sa-progress-bar"
            style={{
              width: `${task.progress}%`,
              background: task.status === 'done' ? '#22c55e' : 'var(--amber)',
            }}
          />
        </div>
      )}
      {task.error && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--error, #ef4444)', marginTop: 4 }}>
          {task.error}
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const SYNC_ACCEL_STYLES = `
  .sa-card { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md, 6px); background: rgba(255,255,255,0.02); }
  .sa-card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .sa-card-title { font-size: 0.8125rem; font-weight: 500; color: var(--text); }
  .sa-card-desc { font-size: 0.6875rem; color: var(--text-dim); line-height: 1.4; }
  .sa-card-detail { font-size: 0.6875rem; color: var(--text-muted); margin-top: 4px; line-height: 1.4; font-style: italic; }
  .sa-badge { font-size: 0.5625rem; padding: 1px 6px; border-radius: 99px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
  .sa-badge-green { background: rgba(34,197,94,0.15); color: #22c55e; }
  .sa-warning-box { display: flex; gap: 6px; align-items: flex-start; margin-top: 8px; padding: 8px 10px; border-radius: var(--radius-sm, 4px); background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); font-size: 0.6875rem; color: #f59e0b; line-height: 1.4; }
  .sa-warning-box strong { color: #f59e0b; }
  .sa-progress-track { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
  .sa-progress-bar { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
`;
