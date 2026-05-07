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

import { useEffect, useRef } from 'react';
import { Brain, Pause, Play, RefreshCw, Square, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import * as graphSvc from '@/services/graph.service';
import { useAuthStore } from '@/stores/auth.store';
import { useExtractionStore, type ExtractionLogEntry } from '@/stores/extraction.store';

export function EntityExtractionConfig() {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');

  const running = useExtractionStore(s => s.running);
  const paused = useExtractionStore(s => s.paused);
  const processed = useExtractionStore(s => s.processed);
  const total = useExtractionStore(s => s.total);
  const logs = useExtractionStore(s => s.logs);
  const fetchStatus = useExtractionStore(s => s.fetchStatus);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch current extraction status on mount (recovers state after navigation)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isPro) return null;

  const handleReExtract = async () => {
    useExtractionStore.setState({ running: true, logs: [], processed: 0, total: 0 });
    try {
      const { total_jobs } = await graphSvc.reExtractAll();
      if (total_jobs === 0) {
        useExtractionStore.setState({ running: false });
        toast.info('No records to re-index');
        useExtractionStore.getState().addLog('No records found to re-index');
      }
    } catch (err: any) {
      useExtractionStore.setState({ running: false });
      if (err?.status === 409 || err?.response?.status === 409) {
        toast.error('Extraction already running');
      } else {
        toast.error('Failed to queue re-extraction');
      }
    }
  };

  const handlePause = async () => {
    try {
      await graphSvc.pauseExtraction();
    } catch { toast.error('Failed to pause'); }
  };

  const handleResume = async () => {
    try {
      await graphSvc.resumeExtraction();
    } catch { toast.error('Failed to resume'); }
  };

  const handleStop = async () => {
    try {
      await graphSvc.stopExtraction();
    } catch { toast.error('Failed to stop'); }
  };

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const logColor: Record<ExtractionLogEntry['type'], string> = {
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
        <div style={{ display: 'flex', gap: 4 }}>
          {running && (
            <>
              <button
                onClick={paused ? handleResume : handlePause}
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
                onClick={handleStop}
                title="Stop extraction"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--error)',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <Square size={12} />
              </button>
            </>
          )}
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
            <span>{running ? (paused ? 'Paused' : 'Processing...') : 'Complete'}</span>
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
