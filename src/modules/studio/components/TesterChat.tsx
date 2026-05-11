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

// ─── TesterChat — Studio Tester conversational sidebar ──────────────
//
// Lives in TestingPhase. The user types questions ("verifica que crear
// ubicación funciona", "¿qué pasa si meto un nombre con tildes?") and
// the Tester replies with diagnoses and retry suggestions.
//
// v1 is text-only — no tool calls, no autonomous execution. The user
// drives action via the UI (Run all tests button, the live preview
// iframe). The Tester just advises.

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, FlaskConical, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { useStudioStore, type StudioTestMessage } from '@/stores/studio.store';
import { useWebSocketStore } from '@/stores/websocket.store';

interface Props { projectId: string; }

interface PendingAssistant {
  streamId: string;
  text: string;
  toolCalls: ToolCallSummary[];
}

interface ToolCallSummary {
  tool: string;
  input: unknown;
  status: number;
  ms: number;
  error?: string | null;
}

export function TesterChat({ projectId }: Props) {
  const fetchTestMessages = useStudioStore((s) => s.fetchTestMessages);
  const sendTestMessage = useStudioStore((s) => s.sendTestMessage);

  const [messages, setMessages] = useState<StudioTestMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<PendingAssistant | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inFlightRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const client = useWebSocketStore((s) => s.client);

  function clearInFlight() {
    inFlightRef.current = false;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }
  function bumpWatchdog() {
    lastActivityRef.current = Date.now();
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      if (!inFlightRef.current) return;
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= 85_000) {
        setError('El Tester no respondió a tiempo. Refresca y vuelve a intentarlo.');
        toast.error('Timeout: el Tester dejó de responder');
        setStreaming(null);
        setBusy(false);
        clearInFlight();
      }
    }, 90_000);
  }
  useEffect(() => () => clearInFlight(), []);

  // Auto-grow the input as the user types, capped at 240px.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [draft]);

  // Initial history load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchTestMessages(projectId);
        if (!cancelled) setMessages(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load history');
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, fetchTestMessages]);

  // WS subscription — studio.test.* for streaming + final message
  useEffect(() => {
    if (!client) return;
    const handle = (event: { event: string; data: Record<string, unknown> }) => {
      const data = event.data ?? {};
      if (data.project_id !== projectId) return;

      switch (event.event) {
        case 'studio.test.start':
          setStreaming({ streamId: String(data.stream_id ?? ''), text: '', toolCalls: [] });
          bumpWatchdog();
          break;
        case 'studio.test.token': {
          const token = String(data.token ?? '');
          setStreaming((prev) => {
            if (!prev) return { streamId: String(data.stream_id ?? ''), text: token, toolCalls: [] };
            if (prev.streamId !== data.stream_id) return prev;
            return { ...prev, text: prev.text + token };
          });
          bumpWatchdog();
          break;
        }
        case 'studio.test.tool': {
          const tc: ToolCallSummary = {
            tool: String(data.tool ?? 'unknown'),
            input: data.input,
            status: typeof data.status === 'number' ? data.status : 0,
            ms: typeof data.ms === 'number' ? data.ms : 0,
            error: typeof data.error === 'string' ? data.error : null,
          };
          setStreaming((prev) => {
            if (!prev) return prev;
            return { ...prev, toolCalls: [...prev.toolCalls, tc] };
          });
          break;
        }
        case 'studio.test.message': {
          const messageId = String(data.message_id ?? '');
          const content = String(data.content ?? '');
          const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls : null;
          setMessages((prev) => [...prev, {
            id: messageId,
            role: 'assistant',
            content,
            tool_calls: toolCalls,
            created_at: new Date().toISOString(),
          }]);
          setStreaming(null);
          setBusy(false);
          clearInFlight();
          break;
        }
        case 'studio.test.error': {
          setError(String(data.error ?? 'Tester error'));
          setStreaming(null);
          setBusy(false);
          clearInFlight();
          break;
        }
      }
    };
    const unsub = client.on('studio.test.*', handle);
    return unsub;
  }, [client, projectId]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streaming?.text]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setBusy(true);
    // Optimistic user message
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: optimisticId,
      role: 'user',
      content: trimmed,
      tool_calls: null,
      created_at: new Date().toISOString(),
    }]);
    setDraft('');
    bumpWatchdog();
    try {
      await sendTestMessage(projectId, trimmed);
      // Final assistant message arrives via WS — busy gets cleared there.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setBusy(false);
      clearInFlight();
      toast.error('Tester no respondió. Inténtalo de nuevo.');
    }
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <FlaskConical size={14} style={{ color: 'var(--amber)' }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
          Studio Tester
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
          read-only · no escribe código
        </span>
      </div>

      <div ref={scrollRef} style={scrollStyle}>
        {messages.length === 0 && !streaming && (
          <div style={emptyStateStyle}>
            <FlaskConical size={28} style={{ color: 'var(--amber)', marginBottom: 12 }} />
            <p style={{ margin: '0 0 8px', fontSize: '0.875rem', color: 'var(--text)' }}>
              Pregunta lo que quieras verificar
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Ejemplos:<br />
              "¿Qué debería probar de esta app?"<br />
              "El endpoint /weather/madrid devuelve algo raro, ¿qué hago?"<br />
              "¿Está todo listo para empaquetar?"
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {streaming && (
          <div style={assistantBubble}>
            <div style={bubbleLabel}>Studio Tester</div>
            <div className="studio-md-preview" style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
              <ReactMarkdown>{stripToolBlocks(streaming.text) || '…'}</ReactMarkdown>
            </div>
            {streaming.toolCalls.map((tc, i) => (
              <ToolCallCard key={i} call={tc} />
            ))}
          </div>
        )}

        {error && (
          <div style={errorBubble}>
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </div>

      <div style={inputAreaStyle}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={busy ? 'Tester pensando…' : 'Pregunta al Tester…'}
          disabled={busy}
          rows={2}
          style={textareaStyle(busy)}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={busy || draft.trim().length === 0}
          style={sendBtn(busy || draft.trim().length === 0)}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {busy ? 'Pensando' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: StudioTestMessage }) {
  const isUser = message.role === 'user';
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls as ToolCallSummary[] : [];
  return (
    <div style={isUser ? userBubble : assistantBubble}>
      <div style={bubbleLabel}>{isUser ? 'Tú' : 'Studio Tester'}</div>
      {isUser ? (
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {message.content}
        </div>
      ) : (
        <>
          <div className="studio-md-preview" style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
            <ReactMarkdown>{stripToolBlocks(message.content)}</ReactMarkdown>
          </div>
          {toolCalls.map((tc, i) => (
            <ToolCallCard key={i} call={tc} />
          ))}
        </>
      )}
    </div>
  );
}

// Strip <<<TOOL: ...>>> ... <<<END>>> blocks from rendered content —
// the structured calls are shown separately as cards.
function stripToolBlocks(text: string): string {
  return text.replace(/<<<TOOL:[\s\S]*?<<<END>>>\s*/g, '').trim();
}

function ToolCallCard({ call }: { call: ToolCallSummary }) {
  const [expanded, setExpanded] = useState(false);
  const input = call.input as { method?: string; path?: string; body?: unknown } | undefined;
  const method = input?.method ?? '?';
  const path = input?.path ?? '';
  const ok = !call.error && call.status >= 200 && call.status < 400;
  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      style={{
        marginTop: 8,
        padding: '6px 10px',
        background: 'var(--surface)',
        border: `1px solid ${ok ? 'var(--border)' : 'color-mix(in srgb, var(--danger) 40%, var(--border))'}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-mono, monospace)',
        cursor: 'pointer',
        color: 'var(--text-dim)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: ok ? '#22c55e' : 'var(--danger)' }}>⚡</span>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{call.tool}</span>
        <span>· {method} {path}</span>
        <span style={{ flex: 1 }} />
        {call.error
          ? <span style={{ color: 'var(--danger)' }}>error</span>
          : <span style={{ color: ok ? '#22c55e' : 'var(--amber)' }}>{call.status} · {call.ms}ms</span>
        }
      </div>
      {expanded && (
        <pre style={{
          margin: '6px 0 0', padding: 6,
          background: 'var(--card)',
          borderRadius: 4, overflow: 'auto', maxHeight: 240,
          fontSize: '0.625rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          color: 'var(--text)',
        }}>
{call.error
  ? `error: ${call.error}`
  : JSON.stringify(call, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  height: '100%',
  minHeight: 0, // critical: lets the inner scroll area shrink below content height
  background: 'var(--surface)',
  borderLeft: '1px solid var(--border)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--card)',
};
const scrollStyle: React.CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto',
  padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const emptyStateStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  height: '100%', padding: 24, textAlign: 'center',
  color: 'var(--text-dim)',
};
const userBubble: React.CSSProperties = {
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: '8px 12px',
  background: 'color-mix(in srgb, var(--amber) 12%, var(--card))',
  border: '1px solid color-mix(in srgb, var(--amber) 30%, var(--border))',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
};
const assistantBubble: React.CSSProperties = {
  alignSelf: 'flex-start',
  maxWidth: '95%',
  padding: '8px 12px',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
};
const bubbleLabel: React.CSSProperties = {
  fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600,
};
const errorBubble: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  alignSelf: 'flex-start', maxWidth: '95%',
  padding: '6px 10px',
  background: 'color-mix(in srgb, var(--danger) 8%, var(--surface))',
  border: '1px solid color-mix(in srgb, var(--danger) 30%, var(--border))',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--danger)', fontSize: '0.75rem',
};
const inputAreaStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
  background: 'var(--card)',
  padding: 10,
  display: 'flex', flexDirection: 'column', gap: 6,
};
const textareaStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: 8,
  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
  background: disabled ? 'var(--surface)' : 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  resize: 'none' as const,
  overflowY: 'auto' as const,
  minHeight: 56,
  maxHeight: 240,
  outline: 'none',
  opacity: disabled ? 0.6 : 1,
});
const sendBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  alignSelf: 'flex-end',
  padding: '6px 14px',
  background: disabled ? 'var(--surface)' : 'var(--amber)',
  color: disabled ? 'var(--text-muted)' : '#1a1a1a',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
