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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Check, X, TriangleAlert, Loader2, RefreshCw, Puzzle } from 'lucide-react';
import * as gwService from '@/services/gateway.service';
import type { AcpConfig } from '@/services/gateway.service';
import { api } from '@/services/api';
import type { StudioEngineInfo } from '@/stores/studio.store';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';

const ACP_ENGINES = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
] as const;

export function StudioEnginesSection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [checking, setChecking] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [agents, setAgents] = useState<AcpConfig['agents']>({});
  const [engines, setEngines] = useState<StudioEngineInfo[]>([]);

  const loadEngines = useCallback(async () => {
    try {
      const res = await api.get<{ data: { engines: StudioEngineInfo[] } }>('/studio/engines');
      setEngines(res.data.engines ?? []);
    } catch { /* Core may not expose it yet */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await gwService.getAcpConfig();
      setEnabled(cfg.acp_enabled && cfg.acpx_enabled);
      setAgents(cfg.agents ?? {});
      setDirty(false);
      await loadEngines();
    } catch (err) {
      toast.error(describeError(err, 'Failed to load engine config'));
    } finally {
      setLoading(false);
    }
  }, [loadEngines]);
  useEffect(() => { void load(); }, [load]);

  const setAgentField = (id: string, field: 'command' | 'expected_version', value: string) => {
    setAgents((a) => ({ ...a, [id]: { ...a[id], [field]: value } }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateAcpConfig({ acp_enabled: enabled, acpx_enabled: enabled, backend: 'acpx', agents });
      toast.success('Saved — enabling acpx needs a Gateway reload (ask the owner)');
      setDirty(false);
      await loadEngines();
    } catch (err) {
      toast.error(describeError(err, 'Failed to save engine config'));
    } finally {
      setSaving(false);
    }
  };

  const check = async () => {
    setChecking(true);
    try { await loadEngines(); toast.success('Readiness refreshed'); }
    finally { setChecking(false); }
  };

  const acpEngines = engines.filter((e) => e.kind === 'acp');

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
            <code style={code}> acpx</code> runtime — install it in one click from the plugin catalog (no terminal).
          </span>
        </span>
      </label>
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
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
        <TriangleAlert size={11} /> CLI / API-key presence is set up on the server; acpx is the toggle above. Claude Code uses an API key (a Claude Pro/Max subscription can't be routed here — TOS).
      </p>

      {/* Per-engine fields */}
      <h3 style={sub}>Per-engine command</h3>
      {ACP_ENGINES.map((eng) => (
        <div key={eng.id} style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{eng.label}</div>
          <label style={fieldLabel}>Command</label>
          <input value={agents[eng.id]?.command ?? ''} placeholder={eng.id === 'claude' ? 'claude-code-acp' : 'codex'} onChange={(e) => setAgentField(eng.id, 'command', e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <label style={fieldLabel}>Expected version</label>
          <input value={agents[eng.id]?.expected_version ?? ''} placeholder=">=0.4.0" onChange={(e) => setAgentField(eng.id, 'expected_version', e.target.value)} style={input} />
          <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Writes <code style={code}>plugins.entries.acpx.config.agents.{eng.id}.command</code>
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
