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

import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Shield, AlertTriangle, Info, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { describeError } from '@/lib/api-errors';
import { AgentSelect } from './AgentSelect';

interface AgentSandboxConfigProps {
  agentId: string;
  agentName: string;
}

type SandboxField = string | null;

interface SandboxResponse {
  data: {
    global: {
      mode: string;
      scope: string;
      workspace_access: string;
      prune?: { idle_hours?: number; max_age_days?: number };
    };
    agent: {
      mode: SandboxField;
      scope: SandboxField;
      workspace_access: SandboxField;
      prune: unknown;
    };
    openclaw_agent_id: string;
  };
}

const MODES = [
  { value: 'off',      label: 'Off',         desc: 'Run on host (no isolation)' },
  { value: 'non-main', label: 'Non-main',    desc: 'Sandbox group/channel sessions, main DM on host' },
  { value: 'all',      label: 'All sessions',desc: 'Every session in a Docker container' },
];

const SCOPES = [
  { value: 'session', label: 'Per session', desc: 'One container per chat session' },
  { value: 'agent',   label: 'Per agent',   desc: 'One container shared across this agent\'s sessions' },
  { value: 'shared',  label: 'Shared',      desc: 'One container for all sandboxed sessions' },
];

// `none` is intentionally NOT exposed: an OpenClaw agent without
// its workspace mounted cannot read SOUL.md / MEMORY.md / TOOLS.md
// — at that point it is not an agent, just a stateless LLM. The
// host filesystem is unreachable in any sandboxed mode regardless
// of this setting; only the agent's own workspace dir is mounted.
const WORKSPACE_ACCESS = [
  { value: 'rw', label: 'Read-write', desc: 'Agent workspace mounted read-write at /workspace (recommended)' },
  { value: 'ro', label: 'Read-only',  desc: 'Agent workspace mounted read-only — agent cannot update its memory' },
];

const INHERIT = '__inherit__';

function FieldRow({ label, options, current, globalValue, onChange, hint }: {
  label: string;
  options: { value: string; label: string; desc?: string }[];
  current: SandboxField;     // null = inherit, string = override
  globalValue: string;
  onChange: (v: SandboxField) => void;
  hint?: string;
}) {
  const inheriting = current === null;
  const inheritedLabel = options.find(o => o.value === globalValue)?.label ?? globalValue;
  // La opción "heredar" se modela como una entrada más del AgentSelect.
  const selOptions = [
    { value: INHERIT, label: `Usar global (${inheritedLabel})`, desc: 'Hereda de Settings → Sandbox' },
    ...options,
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', color: 'var(--text)', minWidth: 130 }}>
        {label}
        {hint && (
          <span title={hint} style={{ display: 'inline-flex', color: 'var(--text-muted)', cursor: 'help' }}>
            <Info size={12} />
          </span>
        )}
      </span>
      <AgentSelect
        value={inheriting ? INHERIT : (current as string)}
        options={selOptions}
        onChange={v => onChange(v === INHERIT ? null : v)}
        minWidth={240}
      />
    </div>
  );
}

export function AgentSandboxConfig({ agentId, agentName }: AgentSandboxConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const [globalMode, setGlobalMode] = useState('off');
  const [globalScope, setGlobalScope] = useState('session');
  const [globalWs, setGlobalWs] = useState('none');

  const [mode, setMode] = useState<SandboxField>(null);
  const [scope, setScope] = useState<SandboxField>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<SandboxField>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<SandboxResponse>(`/managed-agents/${agentId}/sandbox`);
      const d = res.data;
      setGlobalMode(d.global.mode);
      setGlobalScope(d.global.scope);
      setGlobalWs(d.global.workspace_access);
      setMode(d.agent.mode);
      setScope(d.agent.scope);
      setWorkspaceAccess(d.agent.workspace_access);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load sandbox config'));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const resetAll = () => {
    setMode(null);
    setScope(null);
    setWorkspaceAccess(null);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Send camelCase keys — the existing /gateway/sandbox-config
      // pattern keeps these untransformed end-to-end, and the new
      // per-agent endpoint follows that same convention.
      await api.patch(`/managed-agents/${agentId}/sandbox`, {
        mode,
        scope,
        workspaceAccess,
      });
      toast.success(`Sandbox saved for ${agentName}`);
      setDirty(false);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2200);
      await fetchConfig();
    } catch (err) {
      toast.error(describeError(err, 'Failed to save sandbox config'));
    } finally {
      setSaving(false);
    }
  };

  // Effective values — what OpenClaw will actually use.
  const effMode = mode ?? globalMode;
  const effWs = workspaceAccess ?? globalWs;

  // Determinism: when sandbox is on (mode != off), the host is
  // unreachable EXCEPT for the agent's own workspace dir (the only
  // thing mounted). That's the same guarantee with rw or ro — the
  // dangerous part of the host (other projects, secrets, /etc) is
  // gone. Only mode=off lets the agent see the host directly.
  const isHostIsolated = effMode !== 'off';

  if (loading) {
    return <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', padding: 12 }}>Loading sandbox config…</div>;
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} style={{ color: 'var(--amber)' }} />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Sandbox</h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={resetAll}
            disabled={mode === null && scope === null && workspaceAccess === null}
            style={{
              padding: '4px 10px', fontSize: '0.75rem',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)',
              cursor: (mode === null && scope === null && workspaceAccess === null) ? 'not-allowed' : 'pointer',
              opacity: (mode === null && scope === null && workspaceAccess === null) ? 0.5 : 1,
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
            title="Clear all overrides — this agent will inherit defaults"
          >
            <RotateCcw size={12} />
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              padding: '4px 10px', fontSize: '0.75rem',
              background: justSaved ? 'var(--success)' : dirty ? 'var(--amber)' : 'var(--surface)',
              color: justSaved ? '#fff' : dirty ? '#000' : 'var(--text-dim)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              cursor: dirty && !saving ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              transition: 'background 0.2s',
            }}
          >
            {justSaved ? <><Check size={12} /> Guardado</> : <><Save size={12} /> {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}</>}
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
        Per-agent overrides for this agent. Empty (italic) = inherits from
        Settings → Sandbox. Any <code>mode != off</code> already makes the
        host filesystem unreachable except the agent's own workspace dir.
      </p>

      {/* Determinism banner */}
      {isHostIsolated ? (
        <div style={{
          padding: '8px 10px', fontSize: '0.75rem',
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--success, #22c55e)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Shield size={14} />
          <span>Effective: <b>mode={effMode}, workspace={effWs}</b> — host filesystem unreachable except this agent's own workspace.</span>
        </div>
      ) : (
        <div style={{
          padding: '8px 10px', fontSize: '0.75rem',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid var(--amber-dim, rgba(245, 158, 11, 0.4))',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-dim)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
          <span>Effective: <b>mode=off</b> — agent runs directly on the host, can reach any path the OpenClaw process can.</span>
        </div>
      )}

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        <FieldRow label="Sandbox mode"     options={MODES}            current={mode}            globalValue={globalMode}  onChange={markDirty(setMode)}
          hint="off = corre en el host (sin aislamiento); non-main = aísla sesiones de grupo/canal; all = cada sesión en un contenedor Docker." />
        <FieldRow label="Container scope"  options={SCOPES}           current={scope}           globalValue={globalScope} onChange={markDirty(setScope)}
          hint="Cuántas sesiones comparten contenedor: por sesión, por agente, o uno compartido para todo." />
        <FieldRow label="Workspace access" options={WORKSPACE_ACCESS} current={workspaceAccess} globalValue={globalWs}    onChange={markDirty(setWorkspaceAccess)}
          hint="rw = el agente puede actualizar su memoria/ficheros; ro = solo lectura. El host sigue inalcanzable salvo el propio workspace." />
      </div>

      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingTop: 4, borderTop: '1px dashed var(--border)' }}>
        Applied at next gateway restart. To edit defaults for all agents:{' '}
        <a href="/settings/security?security_tab=isolation" style={{ color: 'var(--amber)' }}>Settings → Security → Isolation</a>.
      </div>
    </div>
  );
}
