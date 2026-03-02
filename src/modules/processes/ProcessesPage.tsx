import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Search, RefreshCw, Play, Square, RotateCcw, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { useProcessesStore } from '@/stores/processes.store';
import type { ClawProcess } from '@/stores/processes.store';
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

function StatusBadge({ status }: { status: ClawProcess['status'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    running: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    stopped: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
    error:   { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  };
  const c = colors[status] ?? colors.stopped;
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px',
      borderRadius: 'var(--radius-sm)', background: c.bg, color: c.text,
      textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
    }}>
      {status}
    </span>
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
  const userRole = useAuthStore((s) => s.user?.role ?? 'user');
  const canManage = userRole === 'admin' || userRole === 'owner';
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

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

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const thStyle = (col: SortKey): React.CSSProperties => ({
    cursor: 'pointer', userSelect: 'none',
    display: 'flex', alignItems: 'center', gap: 2,
    color: sortBy === col ? 'var(--amber)' : 'var(--text-muted)',
  });

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
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>{item.value}</span>
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
            onClick={fetchProcesses}
            disabled={loading}
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
                <th style={{ textAlign: 'center', padding: '0 8px', fontWeight: 500, width: 80 }}>
                  <div style={{ ...thStyle('status'), justifyContent: 'center' }} onClick={() => setSort('status')}>Status <SortIcon col="status" /></div>
                </th>
                <th style={{ textAlign: 'right', padding: '0 8px', fontWeight: 500, width: 80 }}>Uptime</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => p.has_logs && selectProcess(p.id)}
                  style={{
                    height: 40,
                    borderBottom: '1px solid var(--border)',
                    cursor: p.has_logs ? 'pointer' : 'default',
                    background: selectedId === p.id ? 'var(--surface-hover)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (selectedId !== p.id) e.currentTarget.style.background = 'var(--surface)'; }}
                  onMouseLeave={(e) => { if (selectedId !== p.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '0 8px', fontWeight: 500, color: 'var(--text)' }}>{p.name}</td>
                  <td style={{ padding: '0 8px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.id}</td>
                  <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)' }}>{p.cpu_percent?.toFixed(1) ?? '-'}%</td>
                  <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)' }}>{p.memory_mb?.toFixed(0) ?? '-'} MB</td>
                  <td style={{ padding: '0 8px', textAlign: 'center' }}><StatusBadge status={p.status} /></td>
                  <td style={{ padding: '0 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatUptime(p.uptime)}</td>
                  <td style={{ padding: '0 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                      {canManage && p.status === 'stopped' && (
                        <button
                          onClick={() => handleAction('start', p)}
                          title="Start"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {canManage && p.status !== 'stopped' && (
                        <>
                          <button
                            onClick={() => handleAction('restart', p)}
                            title="Restart"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handleAction('stop', p)}
                            title="Stop"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}
                          >
                            <Square size={14} />
                          </button>
                        </>
                      )}
                      {p.has_logs && (
                        <button
                          onClick={() => selectProcess(p.id)}
                          title="View logs"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}
                        >
                          <FileText size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
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
