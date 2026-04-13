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

// ─── StreamDebugOverlay — opt-in diagnostic for streaming bugs ─────
//
// Activated by `localStorage.setItem('studioDebugStream', '1')` and a
// page reload. Renders a small fixed-position panel in the bottom
// right corner showing live state of the WebSocket + the active
// useStudioStream instance. The "Copy to clipboard" button dumps the
// recent event buffer as JSON so the user can paste it into the bug
// report when streaming misbehaves.
//
// This component is intentionally cheap. It re-renders on every state
// change of its props but the inner refs come from the parent's hook
// instance, so React's batching keeps it cheap.

import { useEffect, useState } from 'react';
import { ClipboardCopy, Activity, X } from 'lucide-react';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { StudioStreamState, StudioStreamDebugInfo } from '../hooks/useStudioStream';

interface Props {
  state: StudioStreamState;
  debug: () => StudioStreamDebugInfo;
  projectId: string;
  phase: string;
}

export function StreamDebugOverlay({ state, debug, projectId, phase }: Props) {
  const wsStatus = useWebSocketStore((s) => s.status);
  // Force a re-render every 500ms so the event buffer view stays fresh
  // (the buffer lives in a ref, not React state).
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const dbg = debug();
  if (!dbg.enabled) return null;

  function copyDump() {
    const dump = {
      projectId,
      phase,
      wsStatus,
      streamState: {
        status: state.status,
        streamId: state.streamId,
        textLength: state.text.length,
        displayBodyLength: state.displayBody.length,
        streamingQuestionsCount: state.streamingQuestions?.length ?? null,
        tokensUsed: state.tokensUsed,
        model: state.model,
        error: state.error,
      },
      activeStreamRef: dbg.activeStreamId,
      events: dbg.events,
      timestamp: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(dump, null, 2)).catch(() => {});
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={fabStyle}
        title="Show stream debug overlay"
      >
        <Activity size={14} />
      </button>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={headerStyle}>
        <Activity size={11} style={{ color: 'var(--amber)' }} />
        <strong style={{ fontSize: '0.625rem', color: 'var(--text)' }}>
          Stream debug
        </strong>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={copyDump} style={iconBtnStyle} title="Copy dump">
          <ClipboardCopy size={10} />
        </button>
        <button type="button" onClick={() => setOpen(false)} style={iconBtnStyle} title="Hide">
          <X size={10} />
        </button>
      </div>

      <div style={rowsStyle}>
        <Row label="WS" value={wsStatus} colorize={wsStatus === 'connected' ? '#22c55e' : 'var(--danger)'} />
        <Row label="phase" value={phase} />
        <Row label="status" value={state.status} colorize={statusColor(state.status)} />
        <Row label="streamId" value={dbg.activeStreamId?.slice(0, 8) ?? '∅'} />
        <Row label="text" value={`${state.text.length} chars`} />
        <Row label="body" value={`${state.displayBody.length} chars`} />
        <Row label="qs" value={state.streamingQuestions == null ? '∅' : `${state.streamingQuestions.length}`} />
        <Row label="tokens" value={String(state.tokensUsed)} />
        {state.error && <Row label="error" value={state.error.slice(0, 30)} colorize="var(--danger)" />}
      </div>

      <div style={eventsHeader}>events ({dbg.events.length})</div>
      <div style={eventsList}>
        {dbg.events.length === 0 && (
          <div style={{ color: 'var(--text-dim)', padding: '4px 6px', fontStyle: 'italic' }}>
            no events received yet
          </div>
        )}
        {dbg.events.slice(-10).reverse().map((e, idx) => (
          <div key={`${e.ts}-${idx}`} style={eventRow}>
            <span style={{ color: 'var(--text-muted)' }}>
              {new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false }).slice(3)}
            </span>
            <span style={{ color: eventColor(e.event), flex: 1 }}>
              {e.event.replace('studio.generation.', '')}
            </span>
            {e.stream_id && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>
                {e.stream_id.slice(0, 6)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function Row({ label, value, colorize }: { label: string; value: string; colorize?: string }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: colorize ?? 'var(--text)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case 'streaming': return 'var(--amber)';
    case 'done': return '#22c55e';
    case 'error': return 'var(--danger)';
    case 'cancelled': return 'var(--text-dim)';
    default: return 'var(--text)';
  }
}

function eventColor(name: string): string {
  if (name.endsWith('.token')) return 'var(--amber)';
  if (name.endsWith('.start')) return '#3b82f6';
  if (name.endsWith('.done')) return '#22c55e';
  if (name.endsWith('.error')) return 'var(--danger)';
  return 'var(--text)';
}

// ─── Styles ─────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  right: 12,
  width: 240,
  zIndex: 1000,
  background: 'color-mix(in srgb, var(--card) 95%, transparent)',
  border: '1px solid var(--amber)',
  borderRadius: 'var(--radius-md)',
  padding: 8,
  fontFamily: 'var(--font-sans)',
  fontSize: '0.625rem',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(6px)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  paddingBottom: 4,
  borderBottom: '1px solid var(--border)',
  marginBottom: 4,
};

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  padding: 2,
};

const rowsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '2px 6px',
  marginBottom: 6,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.5625rem',
};

const eventsHeader: React.CSSProperties = {
  fontSize: '0.5rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  paddingTop: 4,
  borderTop: '1px solid var(--border)',
  marginBottom: 2,
};

const eventsList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  maxHeight: 120,
  overflowY: 'auto',
};

const eventRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: '0.5rem',
  fontFamily: 'var(--font-mono)',
  padding: '1px 0',
};

const fabStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  right: 12,
  width: 28,
  height: 28,
  zIndex: 1000,
  background: 'var(--card)',
  border: '1px solid var(--amber)',
  borderRadius: '50%',
  color: 'var(--amber)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
