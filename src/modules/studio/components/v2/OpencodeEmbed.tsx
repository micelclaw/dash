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

// ─── Studio v3 — Build chat = embedded OpenCode native UI ───────────
//
// Hybrid-governed (D1): OpenCode's own web UI renders the build
// conversation inside an iframe (its native composer is HIDDEN by the
// per-project embed proxy), and Core owns the input — the box below the
// iframe calls `sendBuildMessage` (POST /build/turn), so plan/build
// gating + token caps stay enforced server-side. The iframe URL comes
// from `GET /studio/projects/:id/opencode-embed` (same launcher pattern
// as FinanceEmbed). If the embed can't be reached, we degrade to the
// classic dash chat (`fallback`).

import { useEffect, useRef, useState } from 'react';
import { Send, Square, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useStudioStore } from '@/stores/studio.store';
import type { StreamStatus } from '../../hooks/useOpencodeStream';

interface Props {
  projectId: string;
  status: StreamStatus;
  /** Current OC session mode — tunes the input placeholder. */
  mode?: 'plan' | 'build' | null;
  /** Whether a build session exists. When false, Send (re)starts it. */
  isStarted: boolean;
  /** True while POST /build/start is in flight. */
  starting?: boolean;
  /** Re-issue start when there's no active session yet. */
  onAutoStart?: () => void;
  /** Classic dash chat, rendered if the embed can't be reached. */
  fallback?: React.ReactNode;
}

type Phase = 'loading' | 'ready' | 'error';

export function OpencodeEmbed({ projectId, status, mode, isStarted, starting, onAutoStart, fallback }: Props) {
  const fetchOpencodeEmbed = useStudioStore((s) => s.fetchOpencodeEmbed);
  const sendBuildMessage = useStudioStore((s) => s.sendBuildMessage);
  const abortBuild = useStudioStore((s) => s.abortBuild);

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inFlightRef = useRef(false);

  // ─── Open (or re-open) the embed ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setEmbedError(null);
    void (async () => {
      try {
        const res = await fetchOpencodeEmbed(projectId);
        if (cancelled) return;
        setEmbedUrl(res.embed_url);
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setEmbedError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, fetchOpencodeEmbed, attempt]);

  // Auto-grow textarea.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [draft]);

  const send = async () => {
    if (!draft.trim() || inFlightRef.current) return;
    if (!isStarted) { onAutoStart?.(); return; }
    inFlightRef.current = true;
    setBusy(true);
    setSendError(null);
    const text = draft.trim();
    setDraft('');
    try {
      await sendBuildMessage(projectId, text);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
      setDraft(text); // restore so the user can retry
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const stop = async () => {
    try { await abortBuild(projectId); } catch { /* feedback via WS */ }
  };

  // ─── Degrade to the classic chat if the embed isn't reachable ─
  if (phase === 'error' && fallback) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{
          padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.7rem', color: 'var(--text-dim)',
          background: 'color-mix(in srgb, var(--danger) 8%, var(--card))',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <AlertCircle size={12} style={{ color: 'var(--danger)' }} />
          <span>No se pudo abrir el editor nativo de OpenCode — usando la vista clásica.</span>
          <button onClick={() => setAttempt((a) => a + 1)} style={retryBtn} aria-label="Reintentar">
            <RefreshCw size={11} /> Reintentar
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>{fallback}</div>
      </div>
    );
  }

  const inputDisabled = status === 'running';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header strip */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <strong style={{ color: 'var(--text)' }}>Studio Builder</strong>
        <span aria-hidden>·</span>
        <span style={{ color: 'var(--text-muted)' }}>OpenCode</span>
        <span aria-hidden>·</span>
        <span style={{
          color: status === 'running' ? '#22c55e' : status === 'failed' ? 'var(--danger)' : 'var(--text-muted)',
        }}>{status}</span>
      </div>

      {/* Native OpenCode UI (composer hidden by the embed proxy) */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'var(--surface)' }}>
        {phase === 'loading' && (
          <div style={centerStyle}>
            <Loader2 size={18} className="spin" style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Abriendo el editor…</span>
          </div>
        )}
        {phase === 'error' && (
          <div style={centerStyle}>
            <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', maxWidth: 360, textAlign: 'center' }}>
              No se pudo abrir el editor: {embedError}
            </span>
            <button onClick={() => setAttempt((a) => a + 1)} style={retryBtn}>
              <RefreshCw size={12} /> Reintentar
            </button>
          </div>
        )}
        {phase === 'ready' && embedUrl && (
          <iframe
            key={embedUrl}
            src={embedUrl}
            title="OpenCode"
            allow="clipboard-read; clipboard-write"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
        )}
      </div>

      {/* Core-owned input — Core keeps ownership of the prompt (D1) */}
      <div style={{
        padding: 10, borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 6,
        background: 'var(--card)', flexShrink: 0,
      }}>
        {sendError && (
          <div style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{sendError}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            disabled={inputDisabled}
            placeholder={
              inputDisabled
                ? '(el agente está trabajando…)'
                : starting
                  ? 'Iniciando Build…'
                  : !isStarted
                    ? 'Pulsa enviar para arrancar el Build…'
                    : mode === 'plan'
                      ? 'Pregunta o pide ajustes al plan…'
                      : 'Pídele un ajuste, una nueva feature, o que retome…'
            }
            rows={2}
            style={{
              flex: 1, resize: 'none', padding: '8px 10px', fontSize: '0.8125rem',
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
            <button onClick={() => { void send(); }} disabled={!draft.trim() || busy} aria-label="Send"
              style={!draft.trim() || busy ? btnSendDisabled : btnSend}>
              <Send size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 10,
};
const retryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', fontSize: '0.7rem',
  background: 'var(--surface)', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const btnSend: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const btnSendDisabled: React.CSSProperties = {
  ...btnSend, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'not-allowed',
};
const btnDanger: React.CSSProperties = {
  padding: '8px 12px', background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

export default OpencodeEmbed;
