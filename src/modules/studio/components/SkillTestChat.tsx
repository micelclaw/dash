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

// ─── SkillTestChat — attach a Studio project to a real agent ────────
//
// Phase 9 ships an in-dash control that injects a project's sandbox
// catalog (URL + bearer + route table) into a real agent's TOOLS.md.
// While attached, the user can chat with that agent and have it call
// the generated API via its existing curl/exec skills.
//
// The control is rendered as an inline panel inside the
// ImplementationPhase toolbar. Picking an agent and clicking attach
// rewrites their TOOLS.md (server-side); detach strips it back out.

import { useEffect, useState } from 'react';
import { Beaker, Loader2, Link as LinkIcon, X, MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useStudioStore } from '@/stores/studio.store';

interface AgentRow {
  id: string;
  name: string;
  display_name: string;
}

interface Props {
  projectId: string;
  /** When true, render as a button that opens a popover; otherwise inline. */
  compact?: boolean;
}

export function SkillTestChat({ projectId, compact }: Props) {
  const [open, setOpen] = useState(!compact);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchAttached = useStudioStore((s) => s.fetchSkillTestAttached);
  const attachSkillTest = useStudioStore((s) => s.attachSkillTest);
  const detachSkillTest = useStudioStore((s) => s.detachSkillTest);

  async function refresh() {
    setLoading(true);
    try {
      const [agentsRes, attachedRes] = await Promise.all([
        api.get<{ data: AgentRow[] }>('/managed-agents'),
        fetchAttached(projectId),
      ]);
      setAgents(agentsRes.data);
      setAttached(attachedRes);
    } catch (err) {
      console.warn('[skill-test-chat] load failed', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, projectId]);

  async function handleAttach(name: string) {
    setBusy(name);
    try {
      await attachSkillTest(projectId, name);
      setAttached((a) => (a.includes(name) ? a : [...a, name]));
      toast.success(`Attached to ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Attach failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleDetach(name: string) {
    setBusy(name);
    try {
      const res = await detachSkillTest(projectId, name);
      if (res.removed) setAttached((a) => a.filter((n) => n !== name));
      toast(`Detached from ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Detach failed');
    } finally {
      setBusy(null);
    }
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={triggerBtn}
        title="Attach this project to an agent for testing"
      >
        <Beaker size={11} /> Test with agent
        {attached.length > 0 && (
          <span style={countBadge}>{attached.length}</span>
        )}
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={panelHeader}>
        <Beaker size={12} style={{ color: 'var(--amber)' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
          Test con un agente real
        </span>
        <div style={{ flex: 1 }} />
        {compact && (
          <button type="button" onClick={() => setOpen(false)} style={iconBtn}>
            <X size={11} />
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 8px', fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Inyecta el catálogo de rutas de este proyecto en el TOOLS.md de un agente.
        Mientras esté adjunto, podrás chatear con el agente y pedirle que pruebe la app.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: '0.6875rem' }}>
          <Loader2 size={11} className="animate-spin" /> Cargando agentes…
        </div>
      ) : agents.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          fontSize: '0.6875rem', color: 'var(--text-dim)',
        }}>
          <AlertCircle size={11} style={{ marginTop: 2 }} />
          No hay agentes disponibles. Configura uno desde el módulo Agents.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {agents.map((a) => {
            const isAttached = attached.includes(a.name);
            const isBusy = busy === a.name;
            return (
              <div key={a.id} style={agentRow(isAttached)}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text)', flex: 1 }}>
                  {a.display_name}
                  <span style={{ marginLeft: 6, fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {a.name}
                  </span>
                </span>
                {isAttached ? (
                  <>
                    <a
                      href={`/chat?agent=${encodeURIComponent(a.name)}`}
                      style={chatLink}
                      title="Open chat with this agent"
                    >
                      <MessageSquare size={11} /> Chat
                    </a>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDetach(a.name)}
                      style={detachBtn(isBusy)}
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                      Detach
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAttach(a.name)}
                    style={attachBtn(isBusy)}
                  >
                    {isBusy ? <Loader2 size={11} className="animate-spin" /> : <LinkIcon size={11} />}
                    Attach
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const triggerBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)', fontSize: '0.75rem',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const countBadge: React.CSSProperties = {
  marginLeft: 4, padding: '0 6px',
  background: 'var(--amber)', color: '#000',
  borderRadius: 'var(--radius-full)',
  fontSize: '0.625rem', fontWeight: 700,
};
const panelStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  display: 'flex', flexDirection: 'column', gap: 8,
};
const panelHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  paddingBottom: 4, borderBottom: '1px solid var(--border)',
};
const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: 2, background: 'transparent',
  border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
};
const agentRow = (attached: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 8px',
  background: attached ? 'color-mix(in srgb, var(--amber) 8%, var(--surface))' : 'var(--surface)',
  border: `1px solid ${attached ? 'color-mix(in srgb, var(--amber) 40%, var(--border))' : 'var(--border)'}`,
  borderRadius: 'var(--radius-sm)',
});
const attachBtn = (busy: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 10px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: '0.6875rem', fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
});
const detachBtn = (busy: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 8px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.6875rem',
  cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
});
const chatLink: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 8px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)', textDecoration: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
};
