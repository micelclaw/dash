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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, RefreshCw, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocketStore } from '@/stores/websocket.store';

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'entity' | 'error' | 'done';
}

export function EntityExtractionConfig() {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const client = useWebSocketStore(s => s.client);

  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type,
    }]);
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // WebSocket event listeners
  useEffect(() => {
    if (!client) return;

    const unsub1 = client.on('extraction.started', (e) => {
      const totalJobs = (e.data.total_jobs as number) ?? 0;
      setSessionId(e.data.session_id as string);
      setTotal(totalJobs);
      setProcessed(0);
      setRunning(true);
      setLogs([]);
      addLog(`Re-indexing started: ${totalJobs} jobs queued`, 'info');
    });

    const unsub2 = client.on('extraction.progress', (e) => {
      setProcessed(e.data.processed as number);

      const domain = e.data.domain as string;
      const type = e.data.type as string;
      const entities = (e.data.entities as Array<{ name: string; type: string }>) ?? [];
      const error = e.data.error as string | undefined;

      if (error) {
        addLog(`${domain} ${type}: error — ${error}`, 'error');
      } else if (entities.length > 0) {
        const names = entities.map(en => en.name).join(', ');
        addLog(`${domain}: found ${names}`, 'entity');
      }
    });

    const unsub3 = client.on('extraction.complete', () => {
      setRunning(false);
      addLog('Re-indexing complete', 'done');
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [client, addLog]);

  if (!isPro) return null;

  const handleReExtract = async () => {
    setRunning(true);
    setLogs([]);
    setProcessed(0);
    setTotal(0);
    try {
      const res = await api.post('/graph/re-extract', {}) as any;
      const data = res.data ?? res;
      if (data.total_jobs === 0) {
        setRunning(false);
        toast.info('No records to re-index');
        addLog('No records found to re-index', 'info');
      }
    } catch {
      setRunning(false);
      toast.error('Failed to queue re-extraction');
    }
  };

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const logColor: Record<LogEntry['type'], string> = {
    info: 'var(--text-muted)',
    entity: 'var(--amber)',
    error: 'var(--red, #e55)',
    done: 'var(--green, #5b5)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-sans)' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
      }}>
        <Brain size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
            Entity extraction
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            AI extracts entities (people, projects, locations, topics) from your records and builds the knowledge graph.
          </div>
        </div>
        <button
          onClick={handleReExtract}
          disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            cursor: running ? 'not-allowed' : 'pointer',
            opacity: running ? 0.5 : 1,
          }}
        >
          <RefreshCw size={12} style={{ animation: running ? 'spin 1s linear infinite' : undefined }} />
          {running ? 'Running...' : 'Re-index all'}
        </button>
      </div>

      {/* Progress bar — visible when running or just finished */}
      {(running || logs.length > 0) && total > 0 && (
        <div style={{
          padding: '8px 16px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6, fontSize: '0.6875rem', color: 'var(--text-muted)',
          }}>
            <span>{running ? 'Processing...' : 'Complete'}</span>
            <span>{processed}/{total} ({pct}%)</span>
          </div>
          <div style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 3,
              background: running ? 'var(--amber)' : 'var(--green, #5b5)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Mini-console — visible when there are log entries */}
      {logs.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#0d0d0d',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            borderBottom: '1px solid var(--border)',
            background: '#111',
          }}>
            <Terminal size={12} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              extraction log
            </span>
          </div>
          <div style={{
            maxHeight: 200,
            overflowY: 'auto',
            padding: '8px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            lineHeight: 1.6,
          }}>
            {logs.map((entry, i) => (
              <div key={i} style={{ color: logColor[entry.type] }}>
                <span style={{ color: 'var(--text-dim)', marginRight: 8 }}>{entry.time}</span>
                {entry.text}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
