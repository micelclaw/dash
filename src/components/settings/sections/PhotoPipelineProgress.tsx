import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Cpu, Users, Database, Terminal, RefreshCw, CheckCircle, XCircle, Clock, Download, Play, Pause, Square } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useWebSocketStore } from '@/stores/websocket.store';
import { SettingSection } from '../SettingSection';

// ─── Types ──────────────────────────────────────────────

interface AiStats {
  total: number;
  processed: number;
  pending: number;
  with_description: number;
  skipped: number;
  models: {
    multimodal: { available: boolean; id: string | null; loaded: boolean };
    siglip: { available: boolean; size_mb: number };
    dinov2: { available: boolean; size_mb: number };
    musiq: { available: boolean; size_mb: number };
  };
}

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'phase' | 'error' | 'done';
}

type Phase = 'starting' | 'multimodal' | 'onnx' | 'faces' | 'post';

const PHASES: { key: Phase; label: string; icon: typeof Eye }[] = [
  { key: 'multimodal', label: 'Vision AI', icon: Eye },
  { key: 'onnx', label: 'Embeddings', icon: Cpu },
  { key: 'faces', label: 'Faces', icon: Users },
  { key: 'post', label: 'Indexing', icon: Database },
];

const PHASE_ORDER: Phase[] = ['starting', 'multimodal', 'onnx', 'faces', 'post'];

// ─── Component ──────────────────────────────────────────

export function PhotoPipelineProgress() {
  const client = useWebSocketStore(s => s.client);

  const [stats, setStats] = useState<AiStats | null>(null);
  const [running, setRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<Phase | null>(null);
  const [batchCurrent, setBatchCurrent] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reprocessing, setReprocessing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState(0);
  const [paused, setPaused] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // ─── Fetch stats ────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<{ data: AiStats }>('/photos/ai/stats');
      setStats(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Logging ────────────────────────────────────────

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-200), {
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type,
    }]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ─── WebSocket listeners ────────────────────────────

  useEffect(() => {
    if (!client) return;

    const unsub1 = client.on('photo.worker.progress', (e) => {
      const { phase, current, total, eta_seconds } = e.data as {
        file_id: string; phase: Phase; current: number; total: number; eta_seconds: number;
      };

      if (!running) setRunning(true);
      setCurrentPhase(phase);
      setBatchCurrent(current);
      setBatchTotal(total);
      setEtaSeconds(eta_seconds);

      if (phase === 'starting') {
        addLog(`Photo ${current}/${total}`, 'info');
      } else {
        addLog(`  ${phase}`, 'phase');
      }
    });

    const unsub2 = client.on('photo.worker.error', (e) => {
      const { phase, error } = e.data as { file_id: string; phase: string; error: string };
      addLog(`${phase}: ${error}`, 'error');
    });

    const unsub3 = client.on('photo.worker.complete', (e) => {
      const { photos_processed, duration_seconds } = e.data as { photos_processed: number; duration_seconds: number };
      setRunning(false);
      setCurrentPhase(null);
      addLog(`Batch complete: ${photos_processed} photos in ${duration_seconds}s`, 'done');
      fetchStats();
    });

    const unsub4 = client.on('model.download.progress', (e) => {
      const { model, percent } = e.data as { model: string; percent: number };
      setDownloading(model);
      setDownloadPct(percent);
    });

    const unsub5 = client.on('model.download.complete', (e) => {
      const { model } = e.data as { model: string };
      setDownloading(null);
      setDownloadPct(0);
      toast.success(`Model ${model} downloaded`);
      addLog(`Model ${model} downloaded`, 'done');
      fetchStats();
    });

    const unsub6 = client.on('model.download.error', (e) => {
      const { model, error } = e.data as { model: string; error: string };
      setDownloading(null);
      setDownloadPct(0);
      toast.error(`Download failed: ${error}`);
      addLog(`Download ${model}: ${error}`, 'error');
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, [client, addLog, running, fetchStats]);

  // ─── Re-process handler ─────────────────────────────

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await api.post('/photos/ai/reprocess', {}) as any;
      const data = res.data ?? res;
      toast.success(`${data.reset} photos queued for reprocessing`);
      setLogs([]);
      addLog(`Reset ${data.reset} photos — waiting for next batch...`, 'info');
      fetchStats();
    } catch {
      toast.error('Failed to queue reprocessing');
    }
    setReprocessing(false);
  };

  // ─── Pause / Resume / Abort ─────────────────────────

  const handlePauseResume = async () => {
    try {
      if (paused) {
        await api.post('/photos/ai/resume');
        setPaused(false);
        addLog('Pipeline resumed', 'info');
        toast.success('Pipeline resumed');
      } else {
        await api.post('/photos/ai/pause');
        setPaused(true);
        addLog('Pipeline paused', 'info');
        toast.success('Pipeline paused');
      }
    } catch {
      toast.error('Operation failed');
    }
  };

  const handleAbort = async () => {
    if (!confirm('Abort processing and clear the pending queue?')) return;
    try {
      const res = await api.post('/photos/ai/abort') as any;
      const cleared = res.data?.cleared ?? 0;
      setPaused(true);
      setRunning(false);
      setCurrentPhase(null);
      addLog(`Aborted — ${cleared} photos removed from queue`, 'error');
      toast.success(`Queue cleared: ${cleared} photos`);
      fetchStats();
    } catch {
      toast.error('Failed to abort');
    }
  };

  // ─── Download handler ────────────────────────────────

  const handleDownload = async (model: string) => {
    setDownloading(model);
    setDownloadPct(0);
    addLog(`Downloading ${model}...`, 'info');
    try {
      await api.post('/photos/ai/models/download', { model });
    } catch {
      setDownloading(null);
      toast.error(`Failed to start download for ${model}`);
    }
  };

  // ─── Render helpers ─────────────────────────────────

  if (!stats) return null;

  const pct = stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0;

  const phaseIndex = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1;

  const formatEta = (s: number) => {
    if (s <= 0) return '';
    if (s < 60) return `~${s}s`;
    return `~${Math.ceil(s / 60)}m`;
  };

  const logColor: Record<LogEntry['type'], string> = {
    info: 'var(--text-muted)',
    phase: 'var(--amber)',
    error: 'var(--red, #e55)',
    done: 'var(--green, #5b5)',
  };

  return (
    <SettingSection
      title="AI Pipeline"
      description="Photo processing status and model availability."
      action={
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handlePauseResume}
            title={paused ? 'Resume' : 'Pause'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: paused ? '#22c55e' : 'var(--amber)',
              cursor: 'pointer', padding: 0,
            }}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            onClick={handleAbort}
            disabled={!running && stats.pending === 0}
            title="Abort and clear queue"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--error)',
              cursor: (!running && stats.pending === 0) ? 'not-allowed' : 'pointer',
              opacity: (!running && stats.pending === 0) ? 0.4 : 1,
              padding: 0,
            }}
          >
            <Square size={12} />
          </button>
          <button
            onClick={handleReprocess}
            disabled={reprocessing || running}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              cursor: reprocessing || running ? 'not-allowed' : 'pointer',
              opacity: reprocessing || running ? 0.5 : 1,
            }}
          >
            <RefreshCw size={12} style={{ animation: reprocessing ? 'spin 1s linear infinite' : undefined }} />
            Re-process all
          </button>
        </div>
      }
    >
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--text)' },
          { label: 'Processed', value: stats.processed, color: '#22c55e' },
          { label: 'Pending', value: stats.pending, color: stats.pending > 0 ? 'var(--amber)' : 'var(--text-muted)' },
          { label: 'Described', value: stats.with_description, color: 'var(--text-dim)' },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 80px', padding: '8px 10px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: s.color, fontFamily: 'var(--font-sans)' }}>{s.value}</div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      {stats.total > 0 && (
        <div style={{ padding: '4px 0 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
            <span>{stats.pending > 0 ? `${pct}% processed` : 'All processed'}</span>
            <span>{stats.processed}/{stats.total}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 2,
              background: stats.pending > 0 ? 'var(--amber)' : '#22c55e',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Pipeline phases — visible when running */}
      {running && (
        <div style={{
          display: 'flex', gap: 6, padding: '8px 0',
          justifyContent: 'space-between',
        }}>
          {PHASES.map((p, i) => {
            const pIdx = PHASE_ORDER.indexOf(p.key);
            const isActive = currentPhase === p.key;
            const isDone = phaseIndex > pIdx;
            const color = isActive ? 'var(--amber)' : isDone ? '#22c55e' : 'var(--text-muted)';
            const bg = isActive ? 'rgba(212, 160, 23, 0.1)' : isDone ? 'rgba(34, 197, 94, 0.06)' : 'transparent';
            const Icon = p.icon;

            return (
              <div key={p.key} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px', borderRadius: 'var(--radius-sm)',
                background: bg, transition: 'all 0.3s ease',
              }}>
                <Icon size={16} style={{ color }} />
                <span style={{ fontSize: '0.625rem', color, fontWeight: isActive ? 600 : 400, fontFamily: 'var(--font-sans)' }}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch progress line */}
      {running && batchTotal > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px',
          fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
        }}>
          <Clock size={11} />
          <span>Photo {batchCurrent}/{batchTotal}</span>
          {etaSeconds > 0 && <span style={{ color: 'var(--text-dim)' }}>{formatEta(etaSeconds)} remaining</span>}
        </div>
      )}

      {/* Models */}
      <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text)', marginBottom: 6, fontFamily: 'var(--font-sans)' }}>Models</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            { name: stats.models.multimodal.id ?? 'Vision AI', key: 'multimodal', available: stats.models.multimodal.available, detail: stats.models.multimodal.available ? (stats.models.multimodal.loaded ? 'loaded' : 'downloaded') : 'not downloaded', downloadable: false },
            { name: 'SigLIP', key: 'siglip', available: stats.models.siglip.available, detail: stats.models.siglip.available ? 'visual similarity' : `${stats.models.siglip.size_mb} MB`, downloadable: true },
            { name: 'DINOv2', key: 'dinov2', available: stats.models.dinov2.available, detail: stats.models.dinov2.available ? 'visual features' : `${stats.models.dinov2.size_mb} MB`, downloadable: true },
            { name: 'LAION Aesthetic', key: 'musiq', available: stats.models.musiq.available, detail: stats.models.musiq.available ? 'aesthetic scoring' : `${stats.models.musiq.size_mb} MB`, downloadable: false },
          ].map(m => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>
              {m.available
                ? <CheckCircle size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
                : <XCircle size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              }
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{m.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', flex: 1 }}>
                {downloading === m.key ? `${downloadPct}%` : m.detail}
              </span>
              {!m.available && m.downloadable && downloading !== m.key && (
                <button
                  onClick={() => handleDownload(m.key)}
                  disabled={!!downloading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    height: 20, padding: '0 6px',
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--amber)',
                    fontSize: '0.625rem', fontWeight: 500, cursor: downloading ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)', opacity: downloading ? 0.4 : 1,
                  }}
                >
                  <Download size={10} /> Download
                </button>
              )}
              {downloading === m.key && (
                <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ height: '100%', width: `${downloadPct}%`, borderRadius: 2, background: 'var(--amber)', transition: 'width 0.3s ease' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mini-console */}
      {logs.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#0d0d0d',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          marginTop: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px',
            borderBottom: '1px solid var(--border)',
            background: '#111',
          }}>
            <Terminal size={11} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              pipeline log
            </span>
          </div>
          <div style={{
            maxHeight: 160,
            overflowY: 'auto',
            padding: '6px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.625rem',
            lineHeight: 1.6,
          }}>
            {logs.map((entry, i) => (
              <div key={i} style={{ color: logColor[entry.type] }}>
                <span style={{ color: 'var(--text-dim)', marginRight: 6 }}>{entry.time}</span>
                {entry.text}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </SettingSection>
  );
}
