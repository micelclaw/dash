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

import { useEffect, useRef, useState, useMemo } from 'react';
import { X, Search, RefreshCw, ArrowDown } from 'lucide-react';
import { useProcessesStore } from '@/stores/processes.store';

// ─── Log line color coding ──────────────────────────────

function getLogColor(line: string): string {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('CRIT'))
    return '#ef4444';
  if (upper.includes('WARN'))
    return '#f59e0b';
  if (upper.includes('DEBUG') || upper.includes('TRACE'))
    return 'var(--text-muted)';
  return 'var(--text-dim)';
}

// ─── Component ──────────────────────────────────────────

export function LogsPanel() {
  const selectedId = useProcessesStore((s) => s.selectedId);
  const processes = useProcessesStore((s) => s.processes);
  const logs = useProcessesStore((s) => s.logs);
  const logsLoading = useProcessesStore((s) => s.logsLoading);
  const fetchLogs = useProcessesStore((s) => s.fetchLogs);
  const selectProcess = useProcessesStore((s) => s.selectProcess);
  const [filter, setFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const process = processes.find((p) => p.id === selectedId);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect if user scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  const filteredLogs = useMemo(() => {
    if (!filter) return logs;
    const q = filter.toLowerCase();
    return logs.filter((line) => line.toLowerCase().includes(q));
  }, [logs, filter]);

  if (!selectedId) return null;

  return (
    <div style={{
      width: 420, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--card)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {process?.name ?? selectedId}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
            {selectedId}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => fetchLogs(selectedId)}
            disabled={logsLoading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
            title="Refresh logs"
          >
            <RefreshCw size={14} style={{ animation: logsLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => selectProcess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: '100%', height: 28, paddingLeft: 26, paddingRight: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto', padding: '8px 12px',
          fontSize: '0.6875rem', lineHeight: 1.6,
          fontFamily: 'var(--font-mono, monospace)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}
      >
        {logsLoading && filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem' }}>
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem' }}>
            {filter ? 'No matching log lines' : 'No logs available'}
          </div>
        ) : (
          filteredLogs.map((line, i) => (
            <div key={i} style={{ color: getLogColor(line), padding: '1px 0' }}>
              {line}
            </div>
          ))
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && (
        <button
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              setAutoScroll(true);
            }
          }}
          style={{
            position: 'absolute', bottom: 12, right: 12,
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--amber)', color: '#06060a',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
