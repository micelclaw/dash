import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle, Square, Clapperboard, Download, Film, Tv, Music, BookOpen, Search, ListPlus, Music2, Library, Headphones } from 'lucide-react';
import { api } from '@/services/api';
import { WIZARD_STYLES } from '../crypto/shared/wizard-styles';

type Step = 'select' | 'review' | 'installing' | 'cancelling' | 'done' | 'error';

interface AppOption {
  name: string;
  display_name: string;
  description: string;
  ram_mb: number;
  group: 'consumer' | 'producer' | 'support';
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
}

const ALL_APPS: AppOption[] = [
  // Consumers
  { name: 'jellyfin',       display_name: 'Jellyfin',       description: 'Stream movies, TV, and music',           ram_mb: 2048, group: 'consumer', icon: Clapperboard, color: '#a855f7' },
  { name: 'navidrome',      display_name: 'Navidrome',      description: 'Personal music server (Subsonic-compatible)', ram_mb: 256, group: 'consumer', icon: Music2, color: '#0ea5e9' },
  { name: 'calibreweb',     display_name: 'Calibre Web',    description: 'eBook library and reader',               ram_mb: 192,  group: 'consumer', icon: Library, color: '#8b5cf6' },
  { name: 'audiobookshelf', display_name: 'Audiobookshelf', description: 'Audiobook and podcast server',           ram_mb: 256,  group: 'consumer', icon: Headphones, color: '#4ade80' },
  // Producers
  { name: 'qbittorrent',    display_name: 'qBittorrent',    description: 'Torrent download client',                ram_mb: 256,  group: 'producer', icon: Download, color: '#2196f3' },
  { name: 'radarr',         display_name: 'Radarr',         description: 'Automated movie downloads',              ram_mb: 384,  group: 'producer', icon: Film, color: '#ffc230' },
  { name: 'sonarr',         display_name: 'Sonarr',         description: 'Automated TV series downloads',          ram_mb: 384,  group: 'producer', icon: Tv, color: '#35c5f4' },
  { name: 'lidarr',         display_name: 'Lidarr',         description: 'Automated music downloads',              ram_mb: 384,  group: 'producer', icon: Music, color: '#1db954' },
  { name: 'readarr',        display_name: 'Readarr',        description: 'Automated book downloads',               ram_mb: 384,  group: 'producer', icon: BookOpen, color: '#8b5cf6' },
  // Support
  { name: 'jackett',        display_name: 'Jackett',        description: 'Torrent indexer proxy for Servarr',      ram_mb: 256,  group: 'support', icon: Search, color: '#e74c3c' },
  { name: 'jellyseerr',     display_name: 'Jellyseerr',     description: 'Media request manager for Jellyfin',     ram_mb: 256,  group: 'support', icon: ListPlus, color: '#a855f7' },
];

const RECOMMENDED = ['jellyfin', 'qbittorrent'];

interface Props {
  installedApps: string[];
  onClose: () => void;
  onDone: () => void;
}

interface InstallProgress {
  app: string;
  status: 'pending' | 'installing' | 'done' | 'error' | 'cancelled' | 'reverting';
  error?: string;
}

export function MultimediaSetupWizard({ installedApps, onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const name of RECOMMENDED) {
      if (!installedApps.includes(name)) initial.add(name);
    }
    return initial;
  });
  const [autoWire, setAutoWire] = useState(true);
  const [progress, setProgress] = useState<InstallProgress[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const toggleApp = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const availableApps = ALL_APPS.filter(a => !installedApps.includes(a.name));
  const totalRam = ALL_APPS.filter(a => selected.has(a.name)).reduce((sum, a) => sum + a.ram_mb, 0);
  const hasServarr = ['radarr', 'sonarr', 'lidarr', 'readarr'].some(n => selected.has(n));

  // ─── Elapsed timer during install ────────────────────────
  useEffect(() => {
    if (!currentApp || step !== 'installing') return;
    const appInfo = ALL_APPS.find(a => a.name === currentApp);
    const label = appInfo?.display_name ?? currentApp;
    const start = Date.now();

    const id = setInterval(() => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (elapsed > 0 && elapsed % 10 === 0) {
        setLogs(prev => [...prev, `  ⏳ ${label} — pulling image... (${elapsed}s)`]);
      }
    }, 5_000);

    return () => clearInterval(id);
  }, [currentApp, step]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ─── Sequential install with cancel support ──────────────
  const handleInstall = useCallback(async () => {
    const apps = Array.from(selected);
    cancelledRef.current = false;
    setStep('installing');
    setGlobalError(null);
    setLogs([]);
    setProgress(apps.map(app => ({ app, status: 'pending' })));

    const completedApps: string[] = [];

    for (let i = 0; i < apps.length; i++) {
      if (cancelledRef.current) break;

      const appName = apps[i];
      const appInfo = ALL_APPS.find(a => a.name === appName);
      const label = appInfo?.display_name ?? appName;
      setCurrentApp(appName);

      // Synthetic progress message
      setLogs(prev => [...prev, `▶ Installing ${label}...`, `  Pulling Docker image and creating container...`]);

      // Mark current as installing
      setProgress(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: 'installing' } : p
      ));

      try {
        const res = await api.post<{ data: { success: boolean; error: string | null; logs?: string[] } }>(
          `/multimedia/${appName}/install`,
        );
        if (cancelledRef.current) break;

        // Append compose output from backend
        const backendLogs = res.data.logs ?? [];
        if (backendLogs.length) {
          setLogs(prev => [...prev, ...backendLogs.map(l => `  ${l}`)]);
        }

        if (res.data.success) {
          completedApps.push(appName);
          setLogs(prev => [...prev, `✓ ${label} installed successfully`]);
          setProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, status: 'done' } : p
          ));
        } else {
          setLogs(prev => [...prev, `✗ ${label} failed: ${res.data.error ?? 'Unknown error'}`]);
          setProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, status: 'error', error: res.data.error ?? 'Failed' } : p
          ));
        }
      } catch (err: any) {
        if (cancelledRef.current) break;
        setLogs(prev => [...prev, `✗ ${label} failed: ${err?.message ?? 'Unknown error'}`]);
        setProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'error', error: err?.message ?? 'Failed' } : p
        ));
      }
    }

    if (cancelledRef.current) {
      // Revert completed apps
      await revertApps(completedApps, apps);
      return;
    }

    // Autowire if requested
    if (autoWire && hasServarr) {
      setCurrentApp(null);
      setLogs(prev => [...prev, '--- Auto-wiring Servarr connections ---']);
      try {
        await api.post('/multimedia/autowire');
        setLogs(prev => [...prev, 'Auto-wire complete']);
      } catch {
        setLogs(prev => [...prev, 'Auto-wire failed (services still installed, can be configured manually)']);
      }
    }

    setCurrentApp(null);

    // Check final state
    setProgress(prev => {
      const allOk = prev.every(p => p.status === 'done');
      const anyError = prev.some(p => p.status === 'error');
      if (allOk) {
        setStep('done');
      } else if (anyError) {
        const failed = prev.filter(p => p.status === 'error').map(p => p.app).join(', ');
        setGlobalError(`Some services failed: ${failed}`);
        setStep('error');
      } else {
        setStep('done');
      }
      return prev;
    });
  }, [selected, autoWire, hasServarr]);

  // ─── Cancel + revert ─────────────────────────────────────
  const revertApps = async (completedApps: string[], allApps: string[]) => {
    setStep('cancelling');
    setLogs(['Cancelling installation...']);

    // Mark remaining as cancelled, completed ones as reverting
    setProgress(prev => prev.map(p => {
      if (completedApps.includes(p.app) && p.status === 'done') return { ...p, status: 'reverting' as const };
      if (p.status === 'pending' || p.status === 'installing') return { ...p, status: 'cancelled' as const };
      return p;
    }));

    // Uninstall completed apps in reverse order
    for (let i = completedApps.length - 1; i >= 0; i--) {
      const appName = completedApps[i];
      setCurrentApp(appName);
      setLogs(prev => [...prev, `Removing ${appName}...`]);
      try {
        await api.post(`/multimedia/${appName}/uninstall`);
        setProgress(prev => prev.map(p =>
          p.app === appName ? { ...p, status: 'cancelled' } : p
        ));
        setLogs(prev => [...prev, `${appName} removed`]);
      } catch {
        setLogs(prev => [...prev, `Failed to remove ${appName} (may need manual cleanup)`]);
      }
    }

    setCurrentApp(null);
    setLogs(prev => [...prev, 'Installation cancelled and reverted.']);
    setGlobalError('Installation cancelled by user. All installed services have been removed.');
    setStep('error');
  };

  const handleCancel = () => {
    cancelledRef.current = true;
  };

  const groupLabel = (group: string) => {
    if (group === 'consumer') return 'Media Servers';
    if (group === 'producer') return 'Downloads & Automation';
    return 'Indexers & Requests';
  };

  // ─── Log panel ───────────────────────────────────────────
  const logPanel = (
    <div style={{
      marginTop: 10, width: '100%',
      maxHeight: 200, minHeight: 60, overflow: 'auto',
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '8px 10px',
      fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5,
      lineHeight: 1.7, color: 'var(--text-muted)',
    }}>
      {logs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Waiting for output...</div>
      ) : logs.map((line, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={step !== 'installing' && step !== 'cancelling' ? onClose : undefined}
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
        width: 540, maxHeight: '85vh',
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
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            {step === 'select' && 'Setup Multimedia Suite'}
            {step === 'review' && 'Review Installation'}
            {step === 'installing' && 'Installing Services...'}
            {step === 'cancelling' && 'Cancelling...'}
            {step === 'done' && 'Setup Complete'}
            {step === 'error' && 'Setup Error'}
          </div>
          {step !== 'installing' && step !== 'cancelling' && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>

          {/* ─── Select step ─── */}
          {step === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {availableApps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  All services are already installed.
                </div>
              ) : (
                <>
                  {(['consumer', 'producer', 'support'] as const).map(group => {
                    const apps = availableApps.filter(a => a.group === group);
                    if (apps.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="wizard-section-title">{groupLabel(group)}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {apps.map(app => (
                            <label
                              key={app.name}
                              className="wizard-radio"
                              style={{ border: selected.has(app.name) ? '1px solid var(--amber)' : '1px solid var(--border)' }}
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(app.name)}
                                onChange={() => toggleApp(app.name)}
                                style={{ accentColor: 'var(--amber)', marginTop: 2 }}
                              />
                              <app.icon size={16} style={{ color: app.color, flexShrink: 0, marginTop: 1 }} />
                              <div style={{ flex: 1 }}>
                                <div className="wizard-radio-label">{app.display_name}</div>
                                <div className="wizard-radio-desc">{app.description}</div>
                              </div>
                              <div className="wizard-radio-eta">~{app.ram_mb} MB</div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
                    <span>Selected: {selected.size} services</span>
                    <span>Est. peak RAM: ~{totalRam} MB</span>
                  </div>

                  {hasServarr && (
                    <label className="wizard-checkbox">
                      <input
                        type="checkbox"
                        checked={autoWire}
                        onChange={e => setAutoWire(e.target.checked)}
                        style={{ accentColor: 'var(--amber)' }}
                      />
                      <div>
                        <span>Auto-configure connections</span>
                        <span className="wizard-checkbox-note">Wire Servarr apps to qBittorrent &amp; Jackett automatically</span>
                      </div>
                    </label>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button className="wizard-btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                      className="wizard-btn-primary"
                      disabled={selected.size === 0}
                      onClick={() => setStep('review')}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Review step ─── */}
          {step === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="wizard-section-title">Services to Install</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ALL_APPS.filter(a => selected.has(a.name)).map(app => (
                  <div key={app.name} className="wizard-dep-row">
                    <app.icon size={14} style={{ color: app.color }} />
                    <span>{app.display_name}</span>
                    <span className="wizard-dep-label">~{app.ram_mb} MB</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Total peak RAM: ~{totalRam} MB
                {autoWire && hasServarr && ' · Auto-wire enabled'}
              </div>

              <div className="wizard-info">
                Services will be installed sequentially. Media directories will be created automatically at /data/media/.
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="wizard-btn-secondary" onClick={() => setStep('select')}>Back</button>
                <button className="wizard-btn-primary" onClick={handleInstall}>Install {selected.size} Services</button>
              </div>
            </div>
          )}

          {/* ─── Installing / Cancelling step ─── */}
          {(step === 'installing' || step === 'cancelling') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Loader2 size={18} style={{ color: step === 'cancelling' ? 'var(--error)' : 'var(--amber)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-dim)', flex: 1 }}>
                  {step === 'cancelling' ? 'Cancelling and reverting...' : `Installing ${currentApp ? ALL_APPS.find(a => a.name === currentApp)?.display_name ?? currentApp : ''}...`}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {progress.filter(p => p.status === 'done').length}/{progress.length}
                </span>
              </div>

              {progress.map(p => {
                const app = ALL_APPS.find(a => a.name === p.app);
                const statusColor =
                  p.status === 'done' ? '#22c55e' :
                  p.status === 'error' ? '#ef4444' :
                  p.status === 'installing' ? '#f59e0b' :
                  p.status === 'reverting' ? '#f59e0b' :
                  p.status === 'cancelled' ? '#6b7280' :
                  '#3a3a50';
                const statusLabel =
                  p.status === 'pending' ? 'Pending' :
                  p.status === 'installing' ? 'Installing...' :
                  p.status === 'done' ? 'Done' :
                  p.status === 'error' ? (p.error ?? 'Failed') :
                  p.status === 'reverting' ? 'Reverting...' :
                  'Cancelled';
                return (
                  <div key={p.app} className="wizard-dep-row">
                    {p.status === 'installing' || p.status === 'reverting' ? (
                      <Loader2 size={10} style={{ color: statusColor, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                    ) : (
                      <span className="wizard-dep-dot" style={{ background: statusColor }} />
                    )}
                    <span style={{ color: p.status === 'cancelled' ? 'var(--text-muted)' : 'var(--text)' }}>
                      {app?.display_name ?? p.app}
                    </span>
                    <span className="wizard-dep-label" style={{ color: statusColor }}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}

              {logPanel}

              {step === 'installing' && !cancelledRef.current && (
                <button
                  className="wizard-btn-secondary"
                  onClick={handleCancel}
                  style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--error)', borderColor: 'var(--error)' }}
                >
                  <Square size={12} />
                  Cancel &amp; Revert
                </button>
              )}
            </div>
          )}

          {/* ─── Done step ─── */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <CheckCircle size={32} style={{ color: '#22c55e' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                All services installed successfully
              </div>
              {autoWire && hasServarr && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Cross-service connections configured automatically
                </div>
              )}
              <button className="wizard-btn-primary" onClick={onDone}>Done</button>
            </div>
          )}

          {/* ─── Error step ─── */}
          {step === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <AlertTriangle size={32} style={{ color: 'var(--error, #ef4444)' }} />
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                {globalError}
              </div>
              {progress.length > 0 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {progress.map(p => {
                    const app = ALL_APPS.find(a => a.name === p.app);
                    const dotColor =
                      p.status === 'done' ? '#22c55e' :
                      p.status === 'cancelled' ? '#6b7280' :
                      '#ef4444';
                    return (
                      <div key={p.app} className="wizard-dep-row">
                        <span className="wizard-dep-dot" style={{ background: dotColor }} />
                        <span>{app?.display_name ?? p.app}</span>
                        <span className="wizard-dep-label" style={{ color: dotColor }}>
                          {p.status === 'done' ? 'OK' : p.status === 'cancelled' ? 'Cancelled' : p.error ?? 'Failed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {logPanel}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="wizard-btn-secondary" onClick={onClose}>Close</button>
                <button className="wizard-btn-primary" onClick={() => { setStep('select'); setProgress([]); setLogs([]); setGlobalError(null); }}>Retry</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{WIZARD_STYLES}</style>
    </>
  );
}
