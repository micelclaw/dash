import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Search, RefreshCw, Play, Square, RotateCcw, FileText, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useProcessesStore } from '@/stores/processes.store';
import type { ClawProcess, OllamaLoadedModel } from '@/stores/processes.store';
import { useAuthStore } from '@/stores/auth.store';
import { LogsPanel } from './LogsPanel';

// ─── Helpers ────────────────────────────────────────────

function formatUptime(ms?: number): string {
  if (!ms) return '-';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatMemBytes(bytes: number): string {
  if (bytes === 0) return '—';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 0.1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function StatusBadge({ status }: { status: ClawProcess['status'] }) {
  const color =
    status === 'running' ? { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' }
    : status === 'error'   ? { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' }
    :                        { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' };
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px',
      borderRadius: 'var(--radius-sm)', background: color.bg, color: color.text,
      textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
    }}>
      {status}
    </span>
  );
}

// ─── Ollama models sub-panel ─────────────────────────────

function OllamaModelsPanel({ models }: { models: OllamaLoadedModel[] }) {
  const unloadOllamaModel = useProcessesStore((s) => s.unloadOllamaModel);
  const [unloading, setUnloading] = useState<string | null>(null);

  const handleUnload = async (name: string) => {
    setUnloading(name);
    try {
      await unloadOllamaModel(name);
      toast.success(`${name} unloaded`);
    } catch {
      toast.error(`Failed to unload ${name}`);
    }
    setUnloading(null);
  };

  return (
    <div style={{ padding: '10px 0 6px 4px' }}>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 600, color: 'var(--amber)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        Loaded Models
      </div>
      {models.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No models currently loaded in memory</div>
      ) : (
        <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr>
              {[['Model', 'left'], ['Params', 'left'], ['RAM', 'right'], ['VRAM', 'right'], ['', 'right']].map(([h, align]) => (
                <th key={h} style={{
                  textAlign: align as 'left' | 'right',
                  padding: '0 16px 4px 0',
                  color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const ramBytes = m.size_bytes - m.size_vram_bytes;
              const isUnloading = unloading === m.name;
              return (
                <tr key={m.name}>
                  <td style={{ padding: '2px 16px 2px 0', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </td>
                  <td style={{ padding: '2px 16px 2px 0', color: 'var(--text-muted)' }}>
                    {m.parameter_size || '—'}
                  </td>
                  <td style={{ padding: '2px 16px 2px 0', textAlign: 'right', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {formatMemBytes(ramBytes)}
                  </td>
                  <td style={{ padding: '2px 16px 2px 0', textAlign: 'right', color: m.size_vram_bytes > 0 ? 'var(--amber)' : 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {formatMemBytes(m.size_vram_bytes)}
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right' }}>
                    <button
                      onClick={() => handleUnload(m.name)}
                      disabled={isUnloading}
                      title="Unload model from memory"
                      style={{
                        background: 'none', border: '1px solid var(--border)', cursor: isUnloading ? 'default' : 'pointer',
                        color: isUnloading ? 'var(--text-muted)' : '#ef4444',
                        borderRadius: 'var(--radius-sm)', padding: '1px 8px',
                        fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
                        opacity: isUnloading ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Square size={10} />
                      {isUnloading ? 'Unloading…' : 'Unload'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Sort + filter ──────────────────────────────────────

type SortKey = 'cpu' | 'mem' | 'name' | 'pid' | 'status';

function sortProcesses(procs: ClawProcess[], sortBy: SortKey, dir: 'asc' | 'desc'): ClawProcess[] {
  const mult = dir === 'asc' ? 1 : -1;
  return [...procs].sort((a, b) => {
    switch (sortBy) {
      case 'cpu': return mult * ((a.cpu_percent ?? 0) - (b.cpu_percent ?? 0));
      case 'mem': return mult * ((a.memory_mb ?? 0) - (b.memory_mb ?? 0));
      case 'name': return mult * a.name.localeCompare(b.name);
      case 'pid': return mult * a.id.localeCompare(b.id);
      case 'status': return mult * a.status.localeCompare(b.status);
      default: return 0;
    }
  });
}

// ─── Component ──────────────────────────────────────────

export function Component() {
  const processes = useProcessesStore((s) => s.processes);
  const stats = useProcessesStore((s) => s.stats);
  const loading = useProcessesStore((s) => s.loading);
  const sortBy = useProcessesStore((s) => s.sortBy);
  const sortDir = useProcessesStore((s) => s.sortDir);
  const filter = useProcessesStore((s) => s.filter);
  const selectedId = useProcessesStore((s) => s.selectedId);
  const fetchProcesses = useProcessesStore((s) => s.fetchProcesses);
  const setSort = useProcessesStore((s) => s.setSort);
  const setFilter = useProcessesStore((s) => s.setFilter);
  const selectProcess = useProcessesStore((s) => s.selectProcess);
  const restartProcess = useProcessesStore((s) => s.restartProcess);
  const stopProcess = useProcessesStore((s) => s.stopProcess);
  const startProcess = useProcessesStore((s) => s.startProcess);
  const ollamaStatus = useProcessesStore((s) => s.ollamaStatus);
  const expandedProcessId = useProcessesStore((s) => s.expandedProcessId);
  const toggleExpandProcess = useProcessesStore((s) => s.toggleExpandProcess);
  const userRole = useAuthStore((s) => s.user?.role ?? 'user');
  const canManage = userRole === 'admin' || userRole === 'owner';
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    fetchProcesses();
    intervalRef.current = setInterval(fetchProcesses, 10_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchProcesses]);

  const filtered = useMemo(() => {
    let list = processes;
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    return sortProcesses(list, sortBy, sortDir);
  }, [processes, filter, sortBy, sortDir]);

  const handleAction = async (action: 'restart' | 'stop' | 'start', proc: ClawProcess) => {
    try {
      if (action === 'restart') await restartProcess(proc.id);
      else if (action === 'stop') await stopProcess(proc.id);
      else await startProcess(proc.id);
      toast.success(`${proc.name}: ${action} initiated`);
    } catch {
      toast.error(`Failed to ${action} ${proc.name}`);
    }
  };

  const handleRefresh = () => {
    fetchProcesses().then(() => toast.success('Refreshed')).catch(() => {});
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const thStyle = (col: SortKey): React.CSSProperties => ({
    cursor: 'pointer', userSelect: 'none',
    display: 'flex', alignItems: 'center', gap: 2,
    color: sortBy === col ? 'var(--amber)' : 'var(--text-muted)',
  });

  // Pre-compute Ollama VRAM total for the table row
  const ollamaVramMb = ollamaStatus.models.reduce((sum, m) => sum + m.size_vram_bytes, 0) / (1024 * 1024);
  const ollamaGpuPct = ollamaStatus.gpu?.gpu_percent ?? null;

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Summary bar */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)', flexWrap: 'wrap' }}>
            {[
              { label: 'Processes', value: `${stats.running}/${stats.total}` },
              { label: 'CPU', value: `${(stats.cpu_total ?? 0).toFixed(1)}%` },
              { label: 'Memory', value: `${(stats.memory_total_mb ?? 0).toFixed(0)} MB` },
              ...(ollamaStatus.gpu ? [
                { label: 'GPU', value: `${ollamaStatus.gpu.gpu_percent}%` },
                { label: 'VRAM', value: `${ollamaStatus.gpu.vram_used_mb} / ${ollamaStatus.gpu.vram_total_mb} MB` },
              ] : []),
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: item.label === 'GPU' || item.label === 'VRAM' ? 'var(--amber)' : 'var(--text)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: '0 1 260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="Filter processes..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                width: '100%', height: 32, paddingLeft: 28, paddingRight: 8,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text)',
                fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-sans)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
          <button
            onClick={handleRefresh}
            style={{
              height: 32, padding: '0 10px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 4, fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', height: 36 }}>
                <th style={{ textAlign: 'left', padding: '0 8px', fontWeight: 500 }}>
                  <div style={thStyle('name')} onClick={() => setSort('name')}>Name <SortIcon col="name" /></div>
                </th>
                <th style={{ textAlign: 'left', padding: '0 8px', fontWeight: 500, width: 140 }}>
                  <div style={thStyle('pid')} onClick={() => setSort('pid')}>ID <SortIcon col="pid" /></div>
                </th>
                <th style={{ textAlign: 'right', padding: '0 8px', fontWeight: 500, width: 70 }}>
                  <div style={{ ...thStyle('cpu'), justifyContent: 'flex-end' }} onClick={() => setSort('cpu')}>CPU <SortIcon col="cpu" /></div>
                </th>
                <th style={{ textAlign: 'right', padding: '0 8px', fontWeight: 500, width: 80 }}>
                  <div style={{ ...thStyle('mem'), justifyContent: 'flex-end' }} onClick={() => setSort('mem')}>MEM <SortIcon col="mem" /></div>
                </th>
                <th style={{ textAlign: 'right', padding: '0 8px', fontWeight: 500, width: 60, color: 'var(--text-muted)' }}>GPU</th>
                <th style={{ textAlign: 'right', padding: '0 8px', fontWeight: 500, width: 80, color: 'var(--text-muted)' }}>VRAM</th>
                <th style={{ textAlign: 'center', padding: '0 8px', fontWeight: 500, width: 80 }}>
                  <div style={{ ...thStyle('status'), justifyContent: 'center' }} onClick={() => setSort('status')}>Status <SortIcon col="status" /></div>
                </th>
                <th style={{ textAlign: 'right', padding: '0 8px', fontWeight: 500, width: 80 }}>Uptime</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isOllama = p.name === 'Ollama';
                const isExpanded = expandedProcessId === p.id;
                return (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => p.has_logs && selectProcess(p.id)}
                      style={{
                        height: 40,
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                        cursor: p.has_logs ? 'pointer' : 'default',
                        background: selectedId === p.id ? 'var(--surface-hover)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (selectedId !== p.id) e.currentTarget.style.background = 'var(--surface)'; }}
                      onMouseLeave={(e) => { if (selectedId !== p.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Name */}
                      <td style={{ padding: '0 8px', fontWeight: 500, color: 'var(--text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isOllama && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpandProcess(p.id); }}
                              title={isExpanded ? 'Collapse' : 'Show loaded models'}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: isExpanded ? 'var(--amber)' : 'var(--text-muted)',
                                padding: 2, display: 'flex', borderRadius: 'var(--radius-sm)',
                                transition: 'color 0.1s',
                              }}
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>
                          )}
                          {p.name}
                        </div>
                      </td>
                      {/* ID */}
                      <td style={{ padding: '0 8px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.id}</td>
                      {/* CPU */}
                      <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)' }}>{p.cpu_percent?.toFixed(1) ?? '-'}%</td>
                      {/* MEM */}
                      <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)' }}>{p.memory_mb?.toFixed(0) ?? '-'} MB</td>
                      {/* GPU */}
                      <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: isOllama && ollamaGpuPct !== null ? 'var(--amber)' : 'var(--text-muted)' }}>
                        {isOllama && ollamaGpuPct !== null ? `${ollamaGpuPct}%` : '—'}
                      </td>
                      {/* VRAM */}
                      <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: isOllama && ollamaVramMb > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                        {isOllama && ollamaVramMb > 0 ? `${ollamaVramMb.toFixed(0)} MB` : '—'}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '0 8px', textAlign: 'center' }}><StatusBadge status={p.status} /></td>
                      {/* Uptime */}
                      <td style={{ padding: '0 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatUptime(p.uptime)}</td>
                      {/* Actions */}
                      <td style={{ padding: '0 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                          {canManage && p.restartable && p.status === 'stopped' && (
                            <button onClick={() => handleAction('start', p)} title="Start"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}>
                              <Play size={14} />
                            </button>
                          )}
                          {canManage && p.status !== 'stopped' && (
                            <>
                              {p.restartable && (
                                <button onClick={() => handleAction('restart', p)} title="Restart"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}>
                                  <RotateCcw size={14} />
                                </button>
                              )}
                              {p.stoppable && (
                                <button onClick={() => handleAction('stop', p)} title="Stop"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}>
                                  <Square size={14} />
                                </button>
                              )}
                            </>
                          )}
                          {p.has_logs && (
                            <button onClick={() => selectProcess(p.id)} title="View logs"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}>
                              <FileText size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOllama && isExpanded && (
                      <tr>
                        <td colSpan={9} style={{
                          padding: '0 8px 8px 32px',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--surface)',
                        }}>
                          <OllamaModelsPanel models={ollamaStatus.models} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading processes...' : 'No processes found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs Panel */}
      {selectedId && <LogsPanel />}
    </div>
  );
}
