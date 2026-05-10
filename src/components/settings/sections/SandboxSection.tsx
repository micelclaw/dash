/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { api } from '@/services/api';
import { useAgents } from '@/modules/agents/hooks/use-agents';
import { SectionShell } from '../shared/SectionShell';
import { NumericRow } from '../shared/NumericRow';

const SANDBOX_MODES = [
  { value: 'off', label: 'Off', desc: 'All tools run on host (no isolation)' },
  { value: 'non-main', label: 'Non-main sessions', desc: 'Sandbox only group/channel sessions, main DM runs on host' },
  { value: 'all', label: 'All sessions', desc: 'Every session runs in a Docker container' },
];

const SCOPE_OPTIONS = [
  { value: 'session', label: 'Per session', desc: 'One container per chat session' },
  { value: 'agent', label: 'Per agent', desc: 'One container shared across agent sessions' },
  { value: 'shared', label: 'Shared', desc: 'One container for all sandboxed sessions' },
];

const WORKSPACE_OPTIONS = [
  { value: 'none', label: 'None', desc: 'Sandbox has its own isolated workspace' },
  { value: 'ro', label: 'Read-only', desc: 'Agent workspace mounted read-only at /agent' },
  { value: 'rw', label: 'Read-write', desc: 'Agent workspace mounted read-write at /workspace' },
];

export function SandboxSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [mode, setMode] = useState('off');
  const [scope, setScope] = useState('session');
  const [workspaceAccess, setWorkspaceAccess] = useState('none');
  const [idleHours, setIdleHours] = useState(24);
  const [maxAgeDays, setMaxAgeDays] = useState(7);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getSandboxConfig();
      setMode(data.mode ?? 'off');
      setScope(data.scope ?? 'session');
      setWorkspaceAccess(data.workspace_access ?? 'none');
      setIdleHours(data.prune?.idle_hours ?? 24);
      setMaxAgeDays(data.prune?.max_age_days ?? 7);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load sandbox config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateSandboxConfig({
        mode, scope, workspaceAccess,
        prune: { idleHours, maxAgeDays },
      });
      toast.success('Sandbox saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update sandbox config'));
    } finally {
      setSaving(false);
    }
  };

  const applyRecommended = () => {
    setMode('non-main');
    setScope('session');
    setWorkspaceAccess('none');
    setDirty(true);
  };

  return (
    <SectionShell
      title="Sandbox"
      description="Run agent tools in isolated Docker containers. Per-agent overrides below and in Agent → Advanced."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      appliesAt="gateway-restart"
    >
      {/* Recommended-defaults banner — appears when mode is off */}
      {mode === 'off' && (
        <div style={{
          marginBottom: 16, padding: '12px 14px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid var(--amber-dim, rgba(245, 158, 11, 0.4))',
          borderRadius: 'var(--radius-md)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
            Sandbox is off — agents run tools directly on the host
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            With sandbox off, an agent that wants to write a file does so on this machine.
            Container isolation is the deterministic guarantee — combined with Workspace
            <code> none</code>, the host filesystem is not reachable from the agent.
            Recommended: <code>Non-main sessions</code> + Workspace <code>None</code> —
            gives council/channel sessions Docker isolation without slowing down the main DM.
            Per-agent overrides for fine-grained control are available below.
          </div>
          <div>
            <button
              type="button"
              onClick={applyRecommended}
              style={{
                padding: '6px 12px', fontSize: '0.75rem', fontWeight: 500,
                background: 'var(--amber)', color: '#000', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Apply recommended
            </button>
          </div>
        </div>
      )}

      {/* Mode */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sandbox Mode</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SANDBOX_MODES.map(m => (
            <label key={m.value} onClick={() => markDirty(setMode)(m.value)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: mode === m.value ? 'var(--surface-hover)' : 'var(--surface)',
              border: mode === m.value ? '1px solid var(--amber-dim)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: mode === m.value ? '5px solid var(--amber)' : '2px solid var(--text-muted)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{m.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {mode !== 'off' && (
        <>
          {/* Scope */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Container scope</span>
              <select value={scope} onChange={e => markDirty(setScope)(e.target.value)} style={{
                padding: '4px 8px', fontSize: '0.75rem', minWidth: 160,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>)}
              </select>
            </div>
          </div>

          {/* Workspace */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Workspace access</span>
              <select value={workspaceAccess} onChange={e => markDirty(setWorkspaceAccess)(e.target.value)} style={{
                padding: '4px 8px', fontSize: '0.75rem', minWidth: 160,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                {WORKSPACE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>)}
              </select>
            </div>
          </div>

          {/* Pruning */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
            <NumericRow
              label="Idle prune (hours)"
              value={idleHours}
              min={1} max={168}
              onChange={markDirty(setIdleHours)}
            />
            <NumericRow
              label="Max age (days)"
              value={maxAgeDays}
              min={1} max={30}
              onChange={markDirty(setMaxAgeDays)}
            />
          </div>
        </>
      )}

      {/* Per-agent overrides table — read-only summary, edit lives in
          Agent → Advanced. */}
      <PerAgentSandboxTable />
    </SectionShell>
  );
}

// ─── Per-agent overrides table ────────────────────────────────
// Reads /managed-agents/:id/sandbox for each agent and renders a
// summary row. "inherit" = no override. "✎" deep-links to the
// Advanced tab of the agent so the user can edit there.

interface AgentSandboxSummary {
  id: string;
  name: string;
  loading: boolean;
  effective_mode: string;
  effective_scope: string;
  effective_workspace_access: string;
  has_override: boolean;
}

function PerAgentSandboxTable() {
  const { agents, loading: agentsLoading } = useAgents();
  const [rows, setRows] = useState<Record<string, AgentSandboxSummary>>({});

  useEffect(() => {
    if (agentsLoading || agents.length === 0) return;
    let cancelled = false;
    (async () => {
      // Lazy fetch in parallel — sandbox response is ~500 bytes per
      // agent. With 7 agents this is < 1s on local.
      const results = await Promise.all(
        agents.map(async (a) => {
          try {
            const res = await api.get<{
              data: {
                global: { mode: string; scope: string; workspace_access: string };
                agent: { mode: string | null; scope: string | null; workspace_access: string | null };
              };
            }>(`/managed-agents/${a.id}/sandbox`);
            const g = res.data.global;
            const ag = res.data.agent;
            const overrideKeys: string[] = [];
            if (ag.mode !== null) overrideKeys.push('mode');
            if (ag.scope !== null) overrideKeys.push('scope');
            if (ag.workspace_access !== null) overrideKeys.push('workspace_access');
            return [a.id, {
              id: a.id,
              name: a.display_name || a.name,
              loading: false,
              effective_mode: ag.mode ?? g.mode,
              effective_scope: ag.scope ?? g.scope,
              effective_workspace_access: ag.workspace_access ?? g.workspace_access,
              has_override: overrideKeys.length > 0,
            } as const] as const;
          } catch {
            return [a.id, {
              id: a.id, name: a.display_name || a.name, loading: false,
              effective_mode: '?', effective_scope: '?', effective_workspace_access: '?',
              has_override: false,
            } as const] as const;
          }
        }),
      );
      if (!cancelled) {
        const next: Record<string, AgentSandboxSummary> = {};
        for (const [id, summary] of results) next[id] = summary;
        setRows(next);
      }
    })();
    return () => { cancelled = true; };
  }, [agents, agentsLoading]);

  const sorted = [...agents].sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name));

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Per-agent overrides
      </h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0 0 12px' }}>
        Effective config per agent. Italic = inherits from defaults above. Click ✎ to edit in the agent's Advanced tab.
      </p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 40px',
          padding: '8px 12px', background: 'var(--surface)',
          fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>Agent</div>
          <div>Mode</div>
          <div>Scope</div>
          <div>Workspace</div>
          <div></div>
        </div>
        {agentsLoading && (
          <div style={{ padding: 12, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading agents…</div>
        )}
        {!agentsLoading && sorted.length === 0 && (
          <div style={{ padding: 12, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No agents.</div>
        )}
        {sorted.map((a, i) => {
          const r = rows[a.id];
          const isOverride = r?.has_override ?? false;
          const fontStyle: 'normal' | 'italic' = isOverride ? 'normal' : 'italic';
          const color = isOverride ? 'var(--text)' : 'var(--text-dim)';
          return (
            <div
              key={a.id}
              style={{
                display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 40px',
                padding: '10px 12px', alignItems: 'center', fontSize: '0.8125rem',
                borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{a.display_name || a.name}</span>
                {isOverride && (
                  <span style={{
                    fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3,
                    background: 'var(--amber)', color: '#000',
                  }}>override</span>
                )}
              </div>
              <div style={{ color, fontStyle }}>{r?.effective_mode ?? '…'}</div>
              <div style={{ color, fontStyle }}>{r?.effective_scope ?? '…'}</div>
              <div style={{ color, fontStyle }}>{r?.effective_workspace_access ?? '…'}</div>
              <a
                href={`/agents?selected=${a.id}&tab=advanced`}
                title="Edit in Advanced tab"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-dim)', textDecoration: 'none',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
              >
                <Pencil size={12} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
