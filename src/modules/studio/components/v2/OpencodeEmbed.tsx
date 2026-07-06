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
// Hybrid-governed (D1) + progressive disclosure (D5). OpenCode's own web
// UI renders the build conversation inside an iframe (its native composer
// HIDDEN by the embed proxy); Core owns the input (the box below → POST
// /build/turn) so plan/build gating + caps stay enforced server-side.
//
// MODO GUIADO (default, non-technical): the technical iframe stays behind
// a curtain — the panel shows a plain-language narrative ("Lo estoy
// construyendo…" + milestone count). "Ver cómo lo hace por dentro" pulls
// the curtain (MODO PRO) to reveal the native OpenCode UI. The choice
// persists (useStudioMode). If the embed can't be reached we degrade to
// the classic dash chat (`fallback`).

import { useEffect, useRef, useState } from 'react';
import { Send, Square, Loader2, AlertCircle, RefreshCw, Eye, ChevronLeft, Cpu } from 'lucide-react';
import { useStudioStore } from '@/stores/studio.store';
import type { StreamStatus } from '../../hooks/useOpencodeStream';
import type { StudioMode } from '../../hooks/useStudioMode';

interface Props {
  projectId: string;
  status: StreamStatus;
  /** Current OC session mode — tunes the input placeholder. */
  mode?: 'plan' | 'build' | null;
  /** Whether a build session exists. When false, Send (re)starts it. */
  isStarted: boolean;
  /** True while POST /build/start is in flight. */
  starting?: boolean;
  /** Build checklist — drives the human "milestones" count in Guided mode. */
  checklist?: { status: string }[];
  /** Guided/Pro view mode — owned by BuildPhase so it governs the WHOLE
   *  screen (left pane + this embed), not just this panel. Controlled. */
  studioMode: StudioMode;
  onStudioModeChange: (m: StudioMode) => void;
  /** Re-issue start when there's no active session yet. */
  onAutoStart?: () => void;
  /** Classic dash chat, rendered if the embed can't be reached. */
  fallback?: React.ReactNode;
  /** Which engine runs the build. Server-side ACP engines (Claude Code /
   *  Codex) have NO embeddable web UI, so we render the `fallback`
   *  BuildChat directly (fed by the ACP relay's studio.opencode.* events)
   *  + an engine badge — never the OpenCode iframe. Default 'opencode'. */
  engine?: string;
}

type Phase = 'loading' | 'ready' | 'error';

const ACP_ENGINE_LABEL: Record<string, string> = {
  acp_claude: 'Claude Code',
  acp_codex: 'Codex',
};

export function OpencodeEmbed({ projectId, status, mode, isStarted, starting, checklist, studioMode, onStudioModeChange, onAutoStart, fallback, engine }: Props) {
  const fetchOpencodeEmbed = useStudioStore((s) => s.fetchOpencodeEmbed);
  const sendBuildMessage = useStudioStore((s) => s.sendBuildMessage);
  const abortBuild = useStudioStore((s) => s.abortBuild);
  const setStudioMode = onStudioModeChange;

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inFlightRef = useRef(false);
  // M11: when the user sends before a session exists, we queue the text here
  // and auto-flush it once the session is live — instead of dropping it.
  const pendingSendRef = useRef<string | null>(null);

  const isAcp = engine === 'acp_claude' || engine === 'acp_codex';

  // ─── Open (or re-open) the embed ──────────────────────────────
  useEffect(() => {
    // ACP engines have no embeddable web UI — the BuildChat fallback
    // renders their relayed stream, so never fetch an embed URL.
    if (isAcp) { setPhase('ready'); return; }
    let cancelled = false;
    setPhase('loading');
    setEmbedError(null);
    void (async () => {
      try {
        const res = await fetchOpencodeEmbed(projectId);
        if (cancelled) return;
        // S5: when the dash itself is being accessed REMOTELY (a non-loopback
        // host — e.g. a `.claw` domain over WireGuard), the local
        // `http://127.0.0.1:<port>` iframe is unreachable; use the TLS
        // subdomain URL if the backend offered one. Local-first otherwise.
        const host = window.location.hostname;
        const isRemoteClient = host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]';
        setEmbedUrl(isRemoteClient && res.embed_url_remote ? res.embed_url_remote : res.embed_url);
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setEmbedError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, fetchOpencodeEmbed, attempt, isAcp]);

  // Auto-grow textarea.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [draft]);

  const doSend = async (text: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setSendError(null);
    try {
      await sendBuildMessage(projectId, text);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
      setDraft((d) => d || text); // restore so the user can retry
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || inFlightRef.current) return;
    if (!isStarted) {
      // Queue the message and (re)start the session. The effect below sends
      // it as soon as the session is live. The draft stays visible as
      // feedback that something's happening (M11 — no silent drop).
      pendingSendRef.current = text;
      onAutoStart?.();
      return;
    }
    setDraft('');
    await doSend(text);
  };

  // M11: flush a queued message once the session comes up.
  useEffect(() => {
    if (!isStarted) return;
    const pending = pendingSendRef.current;
    if (pending && !inFlightRef.current) {
      pendingSendRef.current = null;
      setDraft('');
      void doSend(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarted]);

  const stop = async () => {
    try { await abortBuild(projectId); } catch { /* feedback via WS */ }
  };

  const inputDisabled = status === 'running';
  const guided = studioMode === 'guided';
  const human = friendlyStatus(status, isStarted, !!starting, checklist);
  const acpLabel = ACP_ENGINE_LABEL[engine ?? ''] ?? 'Server engine';
  // The classic BuildChat brings its OWN composer — don't render ours twice.
  // It is the Pro body for ACP engines (no embeddable web UI) and the
  // degradation path when the OpenCode embed can't be reached.
  const usingFallbackChat = !guided && !!fallback && (isAcp || phase === 'error');

  // ─── SINGLE render branch (Guided parity for every engine) ────────
  // Header (status + Guided/Pro toggle + ACP badge) and the Guided curtain
  // render for ALL engines; only the Pro body differs (iframe vs BuildChat).

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header strip — always visible, every engine */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
        background: 'var(--card)', flexShrink: 0,
      }}>
        <strong style={{ color: 'var(--text)' }}>Studio Builder</strong>
        {isAcp && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--amber) 40%, var(--border))',
            color: 'var(--text)', fontWeight: 600,
          }}>
            <Cpu size={11} style={{ color: 'var(--amber)' }} />
            {acpLabel} · runs on your server
          </span>
        )}
        <span aria-hidden>·</span>
        <span style={{
          color: status === 'running' ? '#22c55e' : status === 'failed' ? 'var(--danger)' : 'var(--text-muted)',
        }}>{status}</span>
        <div style={{ flex: 1 }} />
        {/* Guided / Pro toggle (progressive disclosure) */}
        <div style={modeSwitch} role="group" aria-label="View mode">
          <button onClick={() => setStudioMode('guided')} style={modeBtn(guided)} aria-pressed={guided}>Guided</button>
          <button onClick={() => setStudioMode('pro')} style={modeBtn(!guided)} aria-pressed={!guided}>Pro</button>
        </div>
      </div>

      {/* Body — Guided curtain / Pro iframe / Pro BuildChat */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'var(--surface)' }}>
        {/* GUIDED: the curtain — plain-language narrative for EVERY engine.
            The technical view lives behind it; the toggle pulls it back. */}
        {guided && (
          <div style={guidedCard}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>{human.icon}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{human.title}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxWidth: 420, textAlign: 'center', lineHeight: 1.5 }}>
              {human.sub}
            </div>
            {status === 'running' && (
              <Loader2 size={16} className="spin" style={{ color: 'var(--amber)' }} />
            )}
            <button onClick={() => setStudioMode('pro')} style={seeDevBtn}>
              <Eye size={13} /> See how it works under the hood
            </button>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              (technical detail — you don't need to understand it)
            </div>
          </div>
        )}

        {/* PRO + ACP engine: the classic BuildChat renders the relayed
            stream (same studio.opencode.* events) — no iframe exists. */}
        {!guided && isAcp && fallback && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {fallback}
          </div>
        )}

        {/* PRO + OpenCode: the native OpenCode UI (composer hidden). */}
        {!guided && !isAcp && (
          <>
            {phase === 'loading' && (
              <div style={centerStyle}>
                <Loader2 size={18} className="spin" style={{ color: 'var(--amber)' }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Opening the editor…</span>
              </div>
            )}
            {phase === 'error' && (fallback ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{
                  padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: '0.7rem', color: 'var(--text-dim)',
                  background: 'color-mix(in srgb, var(--danger) 8%, var(--card))',
                  borderBottom: '1px solid var(--border)', flexShrink: 0,
                }}>
                  <AlertCircle size={12} style={{ color: 'var(--danger)' }} />
                  <span>Couldn't open the native OpenCode editor — using the classic view.</span>
                  <button onClick={() => setAttempt((a) => a + 1)} style={retryBtn} aria-label="Retry">
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>{fallback}</div>
              </div>
            ) : (
              <div style={centerStyle}>
                <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', maxWidth: 360, textAlign: 'center' }}>
                  Couldn't open the editor: {embedError}
                </span>
                <button onClick={() => setAttempt((a) => a + 1)} style={retryBtn}>
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            ))}
            {phase === 'ready' && embedUrl && (
              <>
                <iframe
                  key={embedUrl}
                  src={embedUrl}
                  title="OpenCode"
                  allow="clipboard-read; clipboard-write"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                />
                <button onClick={() => setStudioMode('guided')} style={backToGuidedPill}>
                  <ChevronLeft size={12} /> Simple view
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Core-owned input — Core keeps ownership of the prompt (D1).
          Hidden only when the classic BuildChat (own composer) is the body. */}
      {!usingFallbackChat && (
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
                  ? '(the agent is working…)'
                  : starting
                    ? 'Starting Build…'
                    : !isStarted
                      ? 'Press send to start the Build…'
                      : mode === 'plan'
                        ? 'Ask a question or request changes to the plan…'
                        : 'Ask for a tweak, a new feature, or to pick things back up…'
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
      )}
    </div>
  );
}

/** Map the technical session status to a plain-language line (Guided mode). */
function friendlyStatus(
  status: StreamStatus,
  isStarted: boolean,
  starting: boolean,
  checklist?: { status: string }[],
): { icon: string; title: string; sub: string } {
  const total = checklist?.length ?? 0;
  const done = checklist?.filter((c) => c.status === 'done').length ?? 0;
  const milestones = total > 0 ? `${done} of ${total} steps done` : '';
  if (starting) {
    return { icon: '🛠️', title: 'Getting your app ready…', sub: 'I\'m setting up the workspace and the plan. Just a moment.' };
  }
  if (status === 'running') {
    return { icon: '🛠️', title: 'Building your app…', sub: milestones || 'The Builder is working — you\'ll see it progress.' };
  }
  if (status === 'failed') {
    return { icon: '⚠️', title: 'I hit a snag', sub: 'Check the technical detail to see what happened, or ask me to retry below.' };
  }
  if (!isStarted) {
    return { icon: '✨', title: 'Ready to start', sub: 'Type what you want below, or approve the plan so it starts building.' };
  }
  return {
    icon: '✅',
    title: 'Paused, ready for you',
    sub: milestones ? `${milestones} · ask me for the next thing below.` : 'Ask me for a tweak or the next step below.',
  };
}

const centerStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 10,
};
const guidedCard: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
  background: 'var(--surface)', textAlign: 'center',
};
const seeDevBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', fontSize: '0.78rem', marginTop: 4,
  background: 'var(--card)', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const backToGuidedPill: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 2,
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '4px 9px', fontSize: '0.68rem',
  background: 'color-mix(in srgb, var(--card) 92%, transparent)', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)', backdropFilter: 'blur(2px)',
};
const modeSwitch: React.CSSProperties = {
  display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', overflow: 'hidden',
};
const modeBtn = (active: boolean): React.CSSProperties => ({
  padding: '3px 10px', fontSize: '0.68rem', fontWeight: active ? 700 : 500,
  background: active ? 'var(--amber)' : 'transparent',
  color: active ? '#000' : 'var(--text-dim)',
  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
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
