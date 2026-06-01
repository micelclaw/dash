/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * AgentBootstrapConfig (F3.2) — per-agent override of OpenClaw
 * 2026.5.14+ bootstrap budget fields:
 *
 *   - contextInjection:        when to inject SOUL/USER/TOOLS/MEMORY
 *                              into the system prompt
 *                              ('always' | 'continuation-skip' | 'never')
 *   - bootstrapMaxChars:       per-file truncation cap
 *   - bootstrapTotalMaxChars:  combined cap across all bootstrap files
 *
 * Empty / null = inherit from agents.defaults. Patches go through
 * /managed-agents/:id/bootstrap which rebuilds the agents.list entry
 * (same array-merge gotcha as the sandbox endpoint).
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { describeError } from '@/lib/api-errors';

interface AgentBootstrapConfigProps {
  agentId: string;
  agentName: string;
}

type ContextInjection = 'always' | 'continuation-skip' | 'never';

interface BootstrapResponse {
  data: {
    global: {
      context_injection: ContextInjection;
      bootstrap_max_chars: number | null;
      bootstrap_total_max_chars: number | null;
    };
    agent: {
      context_injection: ContextInjection | null;
      bootstrap_max_chars: number | null;
      bootstrap_total_max_chars: number | null;
    };
    openclaw_agent_id: string;
  };
}

const INJECTION_OPTIONS: Array<{ value: ContextInjection; label: string; desc: string }> = [
  {
    value: 'always',
    label: 'Always',
    desc: 'Inject SOUL/USER/TOOLS/MEMORY at every turn',
  },
  {
    value: 'continuation-skip',
    label: 'Skip on continuation',
    desc: 'Inject once per session — skip for continuation turns',
  },
  {
    value: 'never',
    label: 'Never',
    desc: 'Skip bootstrap entirely (agent runs without SOUL/MEMORY)',
  },
];

const INHERIT = '__inherit__';

function InjectionRow({
  current,
  globalValue,
  onChange,
}: {
  current: ContextInjection | null;
  globalValue: ContextInjection;
  onChange: (v: ContextInjection | null) => void;
}) {
  const inheriting = current === null;
  const value = inheriting ? INHERIT : current;
  const inheritedLabel = INJECTION_OPTIONS.find((o) => o.value === globalValue)?.label ?? globalValue;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', minWidth: 150 }}>Context injection</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === INHERIT ? null : (e.target.value as ContextInjection))}
        style={{
          padding: '4px 8px',
          fontSize: '0.75rem',
          minWidth: 280,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: inheriting ? 'var(--text-dim)' : 'var(--text)',
          fontStyle: inheriting ? 'italic' : 'normal',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        <option value={INHERIT}>Use global default ({inheritedLabel})</option>
        {INJECTION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} — {o.desc}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberRow({
  label,
  current,
  globalValue,
  placeholder,
  onChange,
}: {
  label: string;
  current: number | null;
  globalValue: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  const inheriting = current === null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', minWidth: 150 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={500}
          value={current ?? ''}
          placeholder={
            globalValue !== null
              ? `Global: ${globalValue.toLocaleString()}`
              : `Use global default (${placeholder})`
          }
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onChange(null);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n) && n > 0) onChange(Math.floor(n));
          }}
          style={{
            padding: '4px 8px',
            fontSize: '0.75rem',
            minWidth: 200,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: inheriting ? 'var(--text-dim)' : 'var(--text)',
            fontStyle: inheriting ? 'italic' : 'normal',
            fontFamily: 'var(--font-mono, monospace)',
            textAlign: 'right',
          }}
        />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>chars</span>
      </div>
    </div>
  );
}

export function AgentBootstrapConfig({ agentId, agentName }: AgentBootstrapConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [globalCi, setGlobalCi] = useState<ContextInjection>('always');
  const [globalMax, setGlobalMax] = useState<number | null>(null);
  const [globalTotal, setGlobalTotal] = useState<number | null>(null);

  const [contextInjection, setContextInjection] = useState<ContextInjection | null>(null);
  const [bootstrapMaxChars, setBootstrapMaxChars] = useState<number | null>(null);
  const [bootstrapTotalMaxChars, setBootstrapTotalMaxChars] = useState<number | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BootstrapResponse>(`/managed-agents/${agentId}/bootstrap`);
      const d = res.data;
      setGlobalCi(d.global.context_injection);
      setGlobalMax(d.global.bootstrap_max_chars);
      setGlobalTotal(d.global.bootstrap_total_max_chars);
      setContextInjection(d.agent.context_injection);
      setBootstrapMaxChars(d.agent.bootstrap_max_chars);
      setBootstrapTotalMaxChars(d.agent.bootstrap_total_max_chars);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load bootstrap config'));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const allInheriting =
    contextInjection === null && bootstrapMaxChars === null && bootstrapTotalMaxChars === null;

  const resetAll = () => {
    setContextInjection(null);
    setBootstrapMaxChars(null);
    setBootstrapTotalMaxChars(null);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Send camelCase keys — the sandbox endpoint pattern keeps these
      // untransformed end-to-end and bootstrap follows the same convention.
      await api.patch(`/managed-agents/${agentId}/bootstrap`, {
        contextInjection,
        bootstrapMaxChars,
        bootstrapTotalMaxChars,
      });
      toast.success(`Bootstrap saved for ${agentName}`);
      setDirty(false);
      await fetchConfig();
    } catch (err) {
      toast.error(describeError(err, 'Failed to save bootstrap config'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', padding: 12 }}>
        Loading bootstrap config…
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} style={{ color: 'var(--blue, #3b82f6)' }} />
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Bootstrap
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={resetAll}
            disabled={allInheriting}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)',
              cursor: allInheriting ? 'not-allowed' : 'pointer',
              opacity: allInheriting ? 0.5 : 1,
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
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
              padding: '4px 10px',
              fontSize: '0.75rem',
              background: dirty ? 'var(--amber)' : 'var(--surface)',
              color: dirty ? '#000' : 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: dirty && !saving ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Save size={12} />
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-dim)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Tune how SOUL.md / USER.md / TOOLS.md / MEMORY.md get injected into the agent's
        system prompt. Empty (italic) = inherits from <code>agents.defaults</code>. Char
        limits trim each bootstrap file before injection — lower values save tokens but
        may cut context the agent needs to behave correctly.
      </p>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        <InjectionRow
          current={contextInjection}
          globalValue={globalCi}
          onChange={markDirty(setContextInjection)}
        />
        <NumberRow
          label="Per-file max chars"
          current={bootstrapMaxChars}
          globalValue={globalMax}
          placeholder="unset"
          onChange={markDirty(setBootstrapMaxChars)}
        />
        <NumberRow
          label="Total max chars"
          current={bootstrapTotalMaxChars}
          globalValue={globalTotal}
          placeholder="unset"
          onChange={markDirty(setBootstrapTotalMaxChars)}
        />
      </div>

      <div
        style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          paddingTop: 4,
          borderTop: '1px dashed var(--border)',
        }}
      >
        Applied on the next bootstrap pass. Defaults for all agents live in{' '}
        <code>agents.defaults</code> (edit via Settings → Raw JSON for now — no UI yet).
      </div>
    </div>
  );
}
