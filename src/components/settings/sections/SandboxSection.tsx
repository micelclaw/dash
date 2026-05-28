/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil, AlertTriangle, AlertCircle, CheckCircle2, Loader2, Wand2 } from 'lucide-react';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { api } from '@/services/api';
import { useAgents } from '@/modules/agents/hooks/use-agents';
import { useWebSocket } from '@/hooks/use-websocket';
import type { SandboxImageStatus } from '@/modules/gateway/types';
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

// `none` is intentionally NOT exposed: an OpenClaw agent without
// access to its own workspace cannot read SOUL.md / MEMORY.md /
// USER.md / TOOLS.md — at that point it is not an agent, just a
// stateless LLM. The agent's workspace dir is the only host path
// mounted into the container; the rest of the host stays
// unreachable regardless of rw vs ro, so there is no sandbox
// strength gain from disabling it.
const WORKSPACE_OPTIONS = [
  { value: 'rw', label: 'Read-write', desc: 'Agent workspace mounted read-write at /workspace (recommended)' },
  { value: 'ro', label: 'Read-only', desc: 'Agent workspace mounted read-only — agent cannot update its memory' },
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
    setWorkspaceAccess('rw');
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
            Container isolation is the deterministic guarantee — only the agent's own
            workspace dir is mounted, the rest of the host stays unreachable.
            Recommended: <code>Non-main sessions</code> + Workspace <code>Read-write</code> —
            gives council/channel sessions Docker isolation while letting the agent
            read/update its own SOUL.md, MEMORY.md, etc. Per-agent overrides below.
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

      {/* Docker sandbox image status + build button. Always visible because
          a per-agent override can require the image even when global mode='off'. */}
      <SandboxImageBlock />

      {/* Per-agent overrides table — read-only summary, edit lives in
          Agent → Advanced. */}
      <PerAgentSandboxTable />
    </SectionShell>
  );
}

// ─── Sandbox image block ─────────────────────────────────────
// Shows the status of `openclaw-sandbox:bookworm-slim` and lets the user
// build it from the dash (no terminal). Streams `docker build` logs over
// WebSocket using `service.*` events with service='sandbox-image'.

type SandboxImageUiState =
  | 'loading'
  | 'docker_unavailable'
  | 'image_missing'
  | 'building'
  | 'ready'
  | 'build_failed';

function SandboxImageBlock() {
  const [status, setStatus] = useState<SandboxImageStatus | null>(null);
  const [uiState, setUiState] = useState<SandboxImageUiState>('loading');
  const [logs, setLogs] = useState<string[]>([]);
  const [buildError, setBuildError] = useState<string | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);

  const refetch = useCallback(async () => {
    try {
      const s = await gwService.getSandboxImageStatus();
      setStatus(s);
      if (s.docker.kind !== 'available') setUiState('docker_unavailable');
      else if (s.image_exists) setUiState('ready');
      else setUiState('image_missing');
    } catch {
      setUiState('docker_unavailable');
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  // Subscribe to service.* WS events (wildcard works — see use-service-status.ts:21).
  const wsEvent = useWebSocket('service.*');
  useEffect(() => {
    if (!wsEvent || (wsEvent.data as Record<string, unknown>)?.service !== 'sandbox-image') return;
    const data = wsEvent.data as Record<string, unknown>;
    switch (wsEvent.event) {
      case 'service.starting':
        setUiState('building'); setLogs([]); setBuildError(null); break;
      case 'service.logs': {
        const newLines = data.lines as string[] | undefined;
        if (newLines?.length) setLogs((prev) => [...prev, ...newLines].slice(-200));
        break;
      }
      case 'service.ready':
        setUiState('ready'); setBuildError(null); void refetch(); break;
      case 'service.failed':
        setUiState('build_failed');
        setBuildError((data.error as string) ?? 'Build failed');
        break;
    }
  }, [wsEvent, refetch]);

  // Autoscroll log viewer on new lines.
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const handleBuild = useCallback(async () => {
    try {
      await gwService.buildSandboxImage();
      // WS will switch us to 'building' shortly; pre-empt to disable button.
      setUiState('building'); setLogs([]); setBuildError(null);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        toast.warning('Ya hay un build en curso.');
        return;
      }
      toast.error(describeError(err));
    }
  }, []);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
  };

  return (
    <div style={{
      marginBottom: 16,
      padding: 12,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>Sandbox image</div>
        {uiState === 'ready' && status?.image_size_bytes && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
            openclaw-sandbox:bookworm-slim
          </div>
        )}
      </div>

      {uiState === 'loading' && (
        <SandboxImageRow icon={<Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />} color="var(--text-muted)" text="Comprobando estado..." />
      )}

      {uiState === 'docker_unavailable' && status?.docker.kind !== 'available' && (
        <DockerUnavailableMessage kind={status?.docker.kind ?? 'socket_missing'} detail={'detail' in (status?.docker ?? {}) ? (status?.docker as { detail?: string }).detail : undefined} />
      )}

      {uiState === 'image_missing' && (
        <div>
          <SandboxImageRow icon={<AlertCircle size={14} style={{ color: '#f59e0b' }} />} color="#f59e0b" text="Imagen no construida — los agentes con sandbox activado no podrán arrancar." />
          <button
            onClick={handleBuild}
            style={{
              marginTop: 10,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--amber)',
              color: '#000',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Wand2 size={13} /> Build image (~2-5 min)
          </button>
        </div>
      )}

      {uiState === 'building' && (
        <div>
          <SandboxImageRow icon={<Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />} color="#3b82f6" text="Construyendo imagen... (~2-5 min, no cierres la pestaña)" />
          <div
            ref={logsRef}
            style={{
              marginTop: 8,
              maxHeight: 200,
              overflowY: 'auto',
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 8,
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-dim)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {logs.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Esperando primer log...</span> : logs.join('\n')}
          </div>
        </div>
      )}

      {uiState === 'ready' && status?.image_exists && (
        <SandboxImageRow
          icon={<CheckCircle2 size={14} style={{ color: 'var(--success, #22c55e)' }} />}
          color="var(--success, #22c55e)"
          text={`Imagen lista · ${formatBytes(status.image_size_bytes)}${status.last_built_at ? ` · construida ${new Date(status.last_built_at).toLocaleString()}` : ''}`}
        />
      )}

      {uiState === 'build_failed' && (
        <div>
          <SandboxImageRow icon={<AlertTriangle size={14} style={{ color: '#ef4444' }} />} color="#ef4444" text="El build falló." />
          {buildError && (
            <div style={{
              marginTop: 6,
              padding: 8,
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {buildError}
            </div>
          )}
          <button
            onClick={handleBuild}
            style={{
              marginTop: 10,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Wand2 size={13} /> Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

function SandboxImageRow({ icon, color, text }: { icon: React.ReactNode; color: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color }}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

function DockerUnavailableMessage({ kind, detail }: { kind: string; detail?: string }) {
  const map: Record<string, { text: string; hint: string }> = {
    socket_missing: {
      text: 'Docker no está instalado.',
      hint: 'Instala Docker Desktop o Docker Engine y refresca esta página.',
    },
    daemon_down: {
      text: 'El daemon de Docker no responde.',
      hint: 'Arranca Docker Desktop o ejecuta `sudo systemctl start docker`.',
    },
    permission_denied: {
      text: 'Sin permisos sobre el socket Docker.',
      hint: 'Añade tu usuario al grupo docker: `sudo usermod -aG docker $USER` y reinicia sesión.',
    },
  };
  const info = map[kind] ?? { text: `Docker no disponible (${kind}).`, hint: detail ?? 'Revisa la instalación de Docker.' };
  return (
    <div>
      <SandboxImageRow icon={<AlertTriangle size={14} style={{ color: '#ef4444' }} />} color="#ef4444" text={info.text} />
      <div style={{ marginTop: 4, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{info.hint}</div>
      {detail && (
        <div style={{ marginTop: 4, fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
          {detail}
        </div>
      )}
    </div>
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
