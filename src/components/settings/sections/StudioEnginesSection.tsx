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

// ─── Settings → AI & Agents → Studio Engines (§A4) ──────────────────
// Configure/inspect the server-side ACP engines (Claude Code / Codex via
// the acpx runtime) that Claw Studio can delegate a build to. Admin-only
// (inherits requireAdmin). Enabling acpx also needs `@openclaw/acpx`
// installed on the server + a Gateway reload — surfaced honestly here.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Check, X, TriangleAlert, Loader2, RefreshCw, Puzzle } from 'lucide-react';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { useStudioEngines } from '@/modules/studio/hooks/useStudioEngines';

const ACP_ENGINES = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
] as const;

/** Masked placeholder for an already-set API key (matches the Core sentinel).
 *  Sending it back unchanged tells Core to preserve the stored key. */
const KEY_SENTINEL = '••••••••';

type AcpAgentsState = Record<string, { command?: string; expected_version?: string; api_key?: string }>;

export function StudioEnginesSection() {
  const navigate = useNavigate();
  // `?focus=acp_claude|acp_codex` (the picker's Configure CTA) → scroll+focus
  // that engine's API-key field once loaded.
  const [searchParams] = useSearchParams();
  const focusEngine = searchParams.get('focus'); // 'acp_claude' | 'acp_codex' | null
  const keyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusedOnce = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [checking, setChecking] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [agents, setAgents] = useState<AcpAgentsState>({});
  const [showReload, setShowReload] = useState(false);
  // Shared engine list + readiness — refreshes on focus/visibility, so
  // coming back from the plugin catalog updates the grid without F5.
  const { engines, refresh: refreshEngines } = useStudioEngines();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await gwService.getAcpConfig();
      setEnabled(cfg.acp_enabled && cfg.acpx_enabled);
      // Map the masked read shape → local state; show the sentinel where a key
      // is already stored so the input renders as "set" without leaking it.
      const mapped: AcpAgentsState = {};
      for (const [id, a] of Object.entries(cfg.agents ?? {})) {
        mapped[id] = { command: a.command, expected_version: a.expected_version, api_key: a.has_api_key ? KEY_SENTINEL : '' };
      }
      setAgents(mapped);
      setDirty(false);
      await refreshEngines();
    } catch (err) {
      toast.error(describeError(err, 'Failed to load engine config'));
    } finally {
      setLoading(false);
    }
  }, [refreshEngines]);
  useEffect(() => { void load(); }, [load]);

  const setAgentField = (id: string, field: 'command' | 'expected_version' | 'api_key', value: string) => {
    setAgents((a) => ({ ...a, [id]: { ...a[id], [field]: value } }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateAcpConfig({ acp_enabled: enabled, acpx_enabled: enabled, backend: 'acpx', agents });
      toast.success('Saved');
      setDirty(false);
      // Toggling acpx only lands on the next Gateway reload — offer the
      // button right here instead of a passive "ask the owner" note.
      if (enabled) setShowReload(true);
      await refreshEngines();
    } catch (err) {
      toast.error(describeError(err, 'Failed to save engine config'));
    } finally {
      setSaving(false);
    }
  };

  const check = async () => {
    setChecking(true);
    try { await refreshEngines(); toast.success('Readiness refreshed'); }
    finally { setChecking(false); }
  };

  const acpEngines = engines.filter((e) => e.kind === 'acp');
  // The runtime story: only nag about the plugin catalog / OpenClaw version
  // while acpx or the harness are actually missing. With everything installed
  // (the common post-setup state) the ONLY thing left is the API key.
  const runtimeMissing = acpEngines.length === 0
    || acpEngines.some((e) => !e.detail.acpx_enabled || !e.detail.cli_installed);

  // Focus the requested engine's key field (deep-link from the picker).
  useEffect(() => {
    if (focusedOnce.current || loading || !focusEngine) return;
    const agentId = focusEngine === 'acp_claude' ? 'claude' : focusEngine === 'acp_codex' ? 'codex' : null;
    if (!agentId) return;
    const el = keyRefs.current[agentId];
    if (el) {
      focusedOnce.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.focus(), 350);
    }
  }, [loading, focusEngine]);

  return (
    <SectionShell
      title="Studio Engines"
      description="Server-side engines (Claude Code / Codex) that Claw Studio can delegate a build to."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      appliesAt="gateway-restart"
    >
      {/* Enable toggle */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
        <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setDirty(true); }} style={{ marginTop: 2 }} />
        <span>
          <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Enable server-side engines (acpx)</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.5 }}>
            Runs Claude Code / Codex on this server for Studio builds. Needs the
            <code style={code}> acpx</code> runtime — install it from the plugin catalog (no terminal),
            then reload the Gateway (button appears after saving).
          </span>
        </span>
      </label>
      {showReload && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 8,
          background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
          border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem', color: 'var(--text)',
        }}>
          <span style={{ flex: 1 }}>Reload the Gateway so the acpx runtime picks up the change.</span>
          <button
            type="button"
            onClick={() => { void gwService.restartGateway().then(() => { toast.success('Gateway reloading…'); setShowReload(false); }).catch((err) => toast.error(describeError(err, 'Reload failed'))); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              fontSize: '0.75rem', fontWeight: 600, background: 'var(--amber)', color: '#000',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <RefreshCw size={13} /> Reload Gateway
          </button>
        </div>
      )}
      {/* Runtime setup nag — ONLY while acpx / the harness are missing.
          Once everything is installed (the common post-setup state), the
          only thing left is the API key, and saying anything else is noise. */}
      {runtimeMissing ? (
        <>
          <button
            type="button"
            onClick={() => navigate('/micelhub?tab=plugins&focus=acpx')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
              padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600,
              background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
              border: '1px solid var(--amber)', color: 'var(--amber)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <Puzzle size={13} /> Set up the ACP engine in the Plugin catalog
          </button>
          <div style={{
            display: 'flex', gap: 8, padding: '8px 10px', marginBottom: 16,
            background: 'color-mix(in srgb, var(--amber) 7%, transparent)',
            border: '1px solid color-mix(in srgb, var(--amber) 30%, var(--border))',
            borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5,
          }}>
            <TriangleAlert size={13} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <span>
              The <code style={code}>acpx</code> runtime needs <b>OpenClaw ≥ 2026.6.11</b>. If the install
              fails with a version error, upgrade OpenClaw first. Meanwhile you can use Claude Code / Codex
              today via <b>Bring your own tool</b> — open the project in your own editor from the build screen.
            </span>
          </div>
        </>
      ) : (
        <div style={{
          display: 'flex', gap: 8, padding: '8px 10px', marginBottom: 16, alignItems: 'center',
          background: 'color-mix(in srgb, #22c55e 8%, transparent)',
          border: '1px solid color-mix(in srgb, #22c55e 40%, var(--border))',
          borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5,
        }}>
          <Check size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
          <span>
            The <code style={code}>acpx</code> runtime and the engine harnesses are installed and
            loaded — <b>just add the API key below</b> to finish.
          </span>
        </div>
      )}

      {/* Readiness grid */}
      <h3 style={sub}>Engine readiness</h3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ ...gridRow, background: 'var(--surface)', fontWeight: 600, color: 'var(--text-dim)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          <div>Engine</div><div>CLI</div><div>Auth</div><div>acpx</div><div>Status</div>
        </div>
        {acpEngines.length === 0 && (
          <div style={{ padding: 12, fontSize: '0.78rem', color: 'var(--text-dim)' }}>Restart Core to load engine readiness.</div>
        )}
        {acpEngines.map((e) => (
          <div key={e.id} style={{ ...gridRow, borderTop: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text)', fontWeight: 500 }}>{e.label}</div>
            <TriBool v={e.detail.cli_installed} />
            <TriBool v={e.detail.vendor_auth} />
            <TriBool v={e.detail.acpx_enabled} />
            <div style={{ fontSize: '0.75rem', color: e.ready ? '#22c55e' : 'var(--amber)' }}>
              {e.ready ? 'Ready to use' : (e.reason ?? 'Requires setup')}
              {!e.detail.cli_installed && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => navigate('/micelhub?tab=plugins&focus=acpx')}
                    style={{
                      padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--amber)', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit',
                    }}
                  >
                    Install from the catalog →
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
        <TriangleAlert size={11} /> An engine turns <b>Ready</b> when acpx is on, its harness is installed,
        and its API key is set below. The harness ships with acpx; add the key to finish.
        Claude Code / Codex use an API key — a Claude Pro/Max subscription can't be routed here (TOS).
      </p>

      {/* Per-engine fields */}
      <h3 style={sub}>Per-engine setup</h3>
      {ACP_ENGINES.map((eng) => (
        <div key={eng.id} style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{eng.label}</div>
          <label style={fieldLabel}>{eng.id === 'claude' ? 'Anthropic API key' : 'OpenAI API key'}</label>
          <input
            ref={(el) => { keyRefs.current[eng.id] = el; }}
            type="password"
            autoComplete="off"
            value={agents[eng.id]?.api_key ?? ''}
            placeholder={eng.id === 'claude' ? 'sk-ant-…' : 'sk-…'}
            onChange={(e) => setAgentField(eng.id, 'api_key', e.target.value)}
            style={{ ...input, marginBottom: 8 }}
          />
          <label style={fieldLabel}>Command <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — defaults to the acpx-bundled harness)</span></label>
          <input value={agents[eng.id]?.command ?? ''} placeholder={eng.id === 'claude' ? 'claude-agent-acp' : 'codex-acp'} onChange={(e) => setAgentField(eng.id, 'command', e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <label style={fieldLabel}>Expected version</label>
          <input value={agents[eng.id]?.expected_version ?? ''} placeholder=">=0.4.0" onChange={(e) => setAgentField(eng.id, 'expected_version', e.target.value)} style={input} />
          <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            The key is injected into the harness as <code style={code}>{eng.id === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'}</code> and
            stored in a Core-owned file on this server (<code style={code}>~/.config/micelclaw/acp-engines.json</code>,
            permissions 600) — never in openclaw.json, never shown back.
          </p>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button onClick={check} disabled={checking} style={btnGhost}>
          {checking ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Check readiness
        </button>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Re-queries status. Restarts nothing.</span>
      </div>
    </SectionShell>
  );
}

function TriBool({ v }: { v: boolean | null }) {
  if (v === null || v === undefined) return <div style={{ color: 'var(--text-muted)' }}>—</div>;
  return v
    ? <div style={{ color: '#22c55e' }}><Check size={14} /></div>
    : <div style={{ color: '#ef4444' }}><X size={14} /></div>;
}

const gridRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1.4fr 0.5fr 0.5fr 0.5fr 1.6fr',
  padding: '8px 12px', alignItems: 'center', fontSize: '0.8rem', gap: 6,
};
const sub: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 5, fontWeight: 500 };
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: '0.8rem',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text)', fontFamily: 'var(--font-mono)', outline: 'none',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: '0.8rem', fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const code: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.9em', background: 'var(--surface)', padding: '1px 4px', borderRadius: 3, color: 'var(--text)',
};

export default StudioEnginesSection;
