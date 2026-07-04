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

// ─── Studio V3 A2 — Open in your own tool (BYO via MCP) ─────────────
//
// Lets a user with their OWN Claude Code / Cursor / Codex build the SAME
// project against the project's `studio-context` MCP, on their machine,
// with their own subscription (TOS-clean per ADR-12). This is **MCP,
// not ACP**: Core writes a `.mcp.json` into the project workspace; the
// editor auto-discovers it. All gating / SQL-whitelist / schema
// isolation stay enforced server-side.
//
// Redesigned (§A2 / D2): a 3-step didactic flow, the bearer token
// MASKED on screen but copied live, and a Regenerate action that rotates
// the token (destructive → warns before it lands).

import { useEffect, useState } from 'react';
import {
  X, Copy, Check, Loader2, AlertCircle, ChevronDown, ChevronRight,
  Cloud, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type ConnectInfo } from '@/stores/studio.store';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function ConnectExternalEngineModal({ projectId, onClose }: Props) {
  const fetchConnect = useStudioStore((s) => s.fetchConnect);
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  async function load(regen: boolean) {
    if (regen) setRegenerating(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchConnect(projectId);
      setInfo(data);
      if (regen) toast.message('New connection issued — re-copy the file in any editor already open.');
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      if (regen) setRegenerating(false); else setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await fetchConnect(projectId);
        if (!cancelled) setInfo(data);
      } catch (err) {
        if (!cancelled) setError(humanizeError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, fetchConnect]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const realJson = info ? buildMcpJson(info, false) : '';
  const maskedJson = info ? buildMcpJson(info, true) : '';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          width: '90vw', maxWidth: 600, maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '20px 24px 14px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{
            margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Cloud size={18} style={{ color: 'var(--amber)' }} />
            Open this project in your own tool
          </h3>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              <Loader2 size={16} className="spin" />
              Preparing the connection and writing .mcp.json into the workspace…
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px',
              background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
              border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem', color: 'var(--danger)', lineHeight: 1.5,
            }}>
              <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Content */}
          {!loading && info && (
            <>
              <Step n={1} title="Open the project folder in your editor">
                <p style={stepHint}>Point Claude Code or Cursor at this path.</p>
                <div style={copyRow}>
                  <code style={{ ...inlineCodeStyle, flex: 1, overflowX: 'auto', whiteSpace: 'nowrap', padding: '6px 8px' }}>
                    {info.workspace_path}
                  </code>
                  <CopyButton text={info.workspace_path} label="path" />
                </div>
              </Step>

              <Step n={2} title="The project tools appear on their own">
                <p style={stepHint}>
                  Your editor reads the file we wrote for you, so the tools show up with no setup.
                </p>
              </Step>

              <Step n={3} title="Build — we keep the data safe" last>
                <p style={stepHint}>
                  SQL is whitelisted and each project is schema-isolated. Every change asks you first.
                </p>
              </Step>

              {/* Config file (collapsible, token masked on screen) */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 4 }}>
                <button type="button" onClick={() => setConfigOpen((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 12px',
                    background: 'var(--surface)', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600,
                    fontFamily: 'var(--font-sans)', textAlign: 'left',
                  }}>
                  {configOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Show the config file (.mcp.json)
                </button>
                {configOpen && (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                    <p style={{ ...stepHint, margin: '0 0 8px' }}>
                      Already written to <code style={inlineCodeStyle}>{info.mcp_config_path}</code>.
                      The token is hidden here — <strong style={{ color: 'var(--text)' }}>Copy file</strong> copies the live one.
                    </p>
                    <pre style={codeBlockStyle}>{maskedJson}</pre>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <CopyButton text={realJson} label=".mcp.json" solid />
                      <span style={{ fontSize: '0.68rem', color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Check size={11} /> token included
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && info && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            padding: '14px 24px', borderTop: '1px solid var(--border)',
          }}>
            <button type="button" onClick={() => void load(true)} disabled={regenerating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', fontSize: '0.75rem', fontWeight: 500,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-dim)', borderRadius: 'var(--radius-md)',
                cursor: regenerating ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
              }}
              title="Issue a fresh token and rewrite .mcp.json (the old token stops working)">
              <RefreshCw size={12} className={regenerating ? 'spin' : undefined} />
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button type="button" onClick={onClose}
              style={{
                padding: '8px 18px', fontSize: '0.8125rem', fontWeight: 600,
                background: 'var(--amber)', color: '#000', border: 'none',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────

function Step({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: last ? 18 : 16 }}>
      <div style={{
        width: 24, height: 24, flexShrink: 0, borderRadius: '50%',
        background: 'color-mix(in srgb, var(--amber) 16%, transparent)',
        border: '1px solid var(--amber)', color: 'var(--amber)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 700,
      }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function CopyButton({ text, label, solid }: { text: string; label: string; solid?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Copied ${label} to the clipboard`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '5px 10px', fontSize: '0.7rem', fontWeight: 600,
        background: solid ? 'var(--amber)' : 'transparent',
        color: solid ? '#000' : (copied ? '#22c55e' : 'var(--text-dim)'),
        border: solid ? 'none' : '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        fontFamily: 'var(--font-sans)', flexShrink: 0,
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : (solid ? 'Copy file' : 'Copy')}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Build the `.mcp.json`. When `mask` is true the bearer is redacted for
 *  on-screen display; the copy button always uses the real one. */
function buildMcpJson(info: ConnectInfo, mask: boolean): string {
  const obj = {
    mcpServers: {
      [info.mcp_server_name]: {
        type: 'http',
        url: info.mcp_url,
        headers: {
          Authorization: mask ? 'Bearer ••• hidden •••' : `Bearer ${info.mcp_bearer}`,
        },
      },
    },
  };
  return JSON.stringify(obj, null, 2);
}

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b404\b|not[_\s-]?found/i.test(msg)) {
    return 'Project or connection endpoint not found. Make sure the project exists and you have the latest backend.';
  }
  if (/\b403\b|forbidden|permission|unauthor/i.test(msg)) {
    return 'You don\'t have permission to connect this project. Check that your session is still active.';
  }
  return `Could not prepare the connection: ${msg}`;
}

// ─── Styles ──────────────────────────────────────────────────────────

const stepHint: React.CSSProperties = {
  margin: '0 0 6px', fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.5,
};
const copyRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginTop: 2,
};
const codeBlockStyle: React.CSSProperties = {
  margin: 0, padding: '10px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontSize: '0.72rem', fontFamily: 'var(--font-mono)',
  lineHeight: 1.5, whiteSpace: 'pre', overflowX: 'auto',
};
const inlineCodeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.92em',
  background: 'var(--surface)', padding: '1px 4px',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
};
