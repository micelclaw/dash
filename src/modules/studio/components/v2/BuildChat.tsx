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

// ─── Studio v2 — Build conversation ────────────────────────────────
//
// Renders the live chat against the OpenCode-backed Builder agent.
// Bubbles for user/assistant/system, streaming indicator, autogrow
// textarea, send/stop buttons. Tool calls inside an assistant turn
// render as inline ToolCallCards. Text content uses ReactMarkdown for
// the same look and feel as v1 chats.

import { useEffect, useRef, useState } from 'react';
import { Send, Square, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStudioStore } from '@/stores/studio.store';
import type { ChatMessage, ChatTextPart, ChatToolPart, StreamStatus } from '../../hooks/useOpencodeStream';
import { ToolCallCard } from './ToolCallCard';

interface Props {
  projectId: string;
  status: StreamStatus;
  messages: ChatMessage[];
  activitySummary: string | null;
  silentForMs: number | null;
  /** Called by parent to re-issue start when there's no active session yet. */
  onAutoStart?: () => void;
  /** Whether to render the "send" form or hide it. v1 hides while streaming. */
  isStarted: boolean;
  /**
   * True while POST /build/start is in flight (auto-start on phase
   * entry or fallback Send). Drives the dedicated "Iniciando Build…"
   * empty state so the chat doesn't sit on a confusing static message.
   */
  starting?: boolean;
  /** Current OC session mode. Tunes the textarea placeholder so the
   *  user knows whether they're chatting to a planner or a builder. */
  mode?: 'plan' | 'build' | null;
  /** Push an optimistic user-role bubble before the API call resolves.
   *  Without this the user's text vanishes from the chat until the WS
   *  echo arrives — which can take 50-300ms and feels broken. */
  pushUserMessage?: (text: string) => void;
}

export function BuildChat({
  projectId, status, messages, activitySummary, silentForMs, onAutoStart, isStarted, starting, mode, pushUserMessage,
}: Props) {
  const sendBuildMessage = useStudioStore((s) => s.sendBuildMessage);
  const abortBuild = useStudioStore((s) => s.abortBuild);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inFlightRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-grow textarea (same pattern as v1 ImplementationChat).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [draft]);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const send = async () => {
    if (!draft.trim() || inFlightRef.current) return;
    if (!isStarted) {
      onAutoStart?.();
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    const text = draft.trim();
    setDraft('');
    // Optimistic user bubble — instant feedback. The bridge will echo
    // a `user_message_added` event with the real OC id and the dedupe
    // logic in useOpencodeStream rebrands the optim in place.
    pushUserMessage?.(text);
    try {
      await sendBuildMessage(projectId, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDraft(text); // restore so user can retry
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const stop = async () => {
    try { await abortBuild(projectId); }
    catch { /* swallow — UX feedback comes via WS */ }
  };

  const inputDisabled = status === 'running';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <strong style={{ color: 'var(--text)' }}>Studio Builder</strong>
        <span aria-hidden>·</span>
        <span style={{
          color: status === 'running' ? '#22c55e' : status === 'failed' ? 'var(--danger)' : 'var(--text-muted)',
        }}>
          {status}
        </span>
        {activitySummary && (
          <>
            <span aria-hidden>·</span>
            <Loader2 size={11} style={{ color: 'var(--amber)' }} className="spin" />
            <span style={{ color: 'var(--text-dim)' }}>{activitySummary}</span>
          </>
        )}
      </div>

      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: 14,
        display: 'flex', flexDirection: 'column', gap: 12,
        fontFamily: 'var(--font-sans)',
      }}>
        {messages.length === 0 && starting && (
          <SystemBubble>
            <Loader2 size={12} className="spin" style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Iniciando Build — materializando workspace, generando checklist y enviando la foundation al agente. Esto suele tardar ~30 s.
          </SystemBubble>
        )}
        {messages.length === 0 && !starting && !isStarted && (
          <PromptPreviewBubble projectId={projectId} />
        )}
        {messages.length === 0 && !starting && isStarted && status !== 'running' && (
          <SystemBubble>
            Builder en idle. Mándale un mensaje para pedirle un ajuste, una nueva feature, o que retome donde lo dejó.
          </SystemBubble>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {silentForMs !== null && status === 'running' && (
          <div style={{
            padding: '10px 12px',
            background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem', color: 'var(--danger)',
          }}>
            ⚠ El agente lleva {Math.floor(silentForMs / 1000)}s sin actividad — puede estar colgado. Considera Stop.
          </div>
        )}
        {error && (
          <div style={{
            padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)', fontSize: '0.75rem',
          }}>
            {error}
          </div>
        )}
      </div>

      <div style={{
        padding: 10, borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-end', gap: 6,
        background: 'var(--card)', flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={inputDisabled}
          placeholder={
            inputDisabled
              ? '(input disabled — agent is working)'
              : starting
                ? 'Iniciando Build…'
                : !isStarted
                  ? 'Pulsa Send para reintentar el arranque…'
                  : mode === 'plan'
                    ? 'Pregunta o pide ajustes al plan…'
                    : 'Pídele un ajuste, una nueva feature, o que retome…'
          }
          rows={2}
          style={{
            flex: 1, resize: 'none',
            padding: '8px 10px', fontSize: '0.8125rem',
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-sans)', lineHeight: 1.4,
            opacity: inputDisabled ? 0.6 : 1,
          }}
        />
        {status === 'running' ? (
          <button onClick={() => { void stop(); }} aria-label="Stop" style={btnDanger}>
            <Square size={12} fill="currentColor" />
          </button>
        ) : (
          <button onClick={() => { void send(); }} disabled={!draft.trim() || busy} aria-label="Send" style={!draft.trim() || busy ? btnSendDisabled : btnSend}>
            <Send size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === 'system') {
    return <SystemBubble>{partsToText(message.parts)}</SystemBubble>;
  }
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: '0.65rem', color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        <strong>{isUser ? 'Tú' : 'Studio Builder'}</strong>
        {message.streaming && <Loader2 size={10} className="spin" />}
        {message.tokensInput !== undefined && (
          <span>· {(message.tokensInput ?? 0) + (message.tokensOutput ?? 0)} tk</span>
        )}
      </div>
      <div style={{
        padding: '8px 12px', borderRadius: 'var(--radius-md)',
        background: isUser ? 'color-mix(in srgb, var(--amber) 10%, var(--card))' : 'var(--card)',
        border: `1px solid ${isUser ? 'color-mix(in srgb, var(--amber) 35%, var(--border))' : 'var(--border)'}`,
        fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.5,
      }}>
        {message.parts.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            (mensaje persistido sin contenido — solo metadata)
          </span>
        )}
        {message.parts.map((p, idx) => {
          if (p.type === 'text') {
            return (
              <div key={idx} className="markdown" style={{ wordBreak: 'break-word' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{(p as ChatTextPart).text}</ReactMarkdown>
              </div>
            );
          }
          return <ToolCallCard key={`${(p as ChatToolPart).callId}-${idx}`} part={p as ChatToolPart} />;
        })}
      </div>
    </div>
  );
}

function SystemBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: 'color-mix(in srgb, var(--text-muted) 6%, var(--card))',
      border: '1px dashed var(--border)',
      borderRadius: 'var(--radius-md)',
      fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5,
    }}>{children}</div>
  );
}

/** Empty-state preview: fetches the actual plan-mode prompt the
 *  backend will send to the agent on Start, and renders it as a system
 *  bubble so the user can read what's about to happen. */
function PromptPreviewBubble({ projectId }: { projectId: string }) {
  const fetchBuildWelcomePreview = useStudioStore((s) => s.fetchBuildWelcomePreview);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchBuildWelcomePreview(projectId);
        if (!cancelled) setPrompt(res.prompt);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, fetchBuildWelcomePreview]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.7rem', color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
      }}>
        <span style={{ fontWeight: 600 }}>Studio Builder</span>
        <span>·</span>
        <span>0 tk</span>
        <span>·</span>
        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>preview</span>
      </div>
      <div style={{
        padding: '12px 14px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--amber)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8125rem',
        color: 'var(--text-dim)',
        lineHeight: 1.55,
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {error
          ? <span style={{ color: 'var(--danger)' }}>Failed to load prompt preview: {error}</span>
          : prompt ?? <span style={{ color: 'var(--text-muted)' }}>Loading prompt…</span>}
      </div>
      <div style={{
        fontSize: '0.7rem', color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
      }}>
        This is the prompt that will be sent on Start. Click <strong>Start build</strong> in the header to dispatch it.
      </div>
    </div>
  );
}

function partsToText(parts: ChatMessage['parts']): string {
  return parts.filter((p) => p.type === 'text').map((p) => (p as ChatTextPart).text).join(' ');
}

const btnSend: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const btnSendDisabled: React.CSSProperties = {
  ...btnSend, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'not-allowed',
};
const btnDanger: React.CSSProperties = {
  padding: '8px 12px',
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
