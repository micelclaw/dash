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

import { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Wrench, Loader2 } from 'lucide-react';
import { useAgentDelegations } from './hooks/use-agent-delegations';
import { formatRelativeTime } from './shared/format';
import type { AgentDelegation, ManagedAgent } from './types';

interface DelegationFlowProps {
  agentId: string;
  agents: ManagedAgent[];
}

export function DelegationFlow({ agentId, agents }: DelegationFlowProps) {
  const { delegations, bySession, loading, loadingMore, error, hasMore, loadMore } = useAgentDelegations(agentId);

  // name (minúscula) → display_name. NUNCA mostrar el name crudo si hay display.
  const nameToDisplay = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents) m.set(a.name, a.display_name);
    return m;
  }, [agents]);
  const display = (n: string | null) => (n ? (nameToDisplay.get(n) ?? n) : '—');

  const grouped = useMemo(() => {
    const map = new Map<string, AgentDelegation[]>();
    for (const d of delegations) {
      const key = d.session_id ?? '—';
      const arr = map.get(key); if (arr) arr.push(d); else map.set(key, [d]);
    }
    return map;
  }, [delegations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
        Delegaciones {bySession.length > 0 && <span style={{ color: 'var(--text-muted)' }}>· {bySession.length} sesión{bySession.length !== 1 ? 'es' : ''}</span>}
      </span>

      {error && <span style={{ fontSize: '0.6875rem', color: 'var(--error)' }}>{error}</span>}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ height: 40, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', animation: 'clawPulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {!loading && delegations.length === 0 && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Este agente no ha delegado ni recibido delegaciones.</span>
      )}

      {[...grouped.entries()].map(([sessionId, items], gi) => (
        <div key={sessionId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grouped.size > 1 && (
            // Etiqueta opaca: el session_id crudo contiene el agentId interno
            // (agent:paco--atlas:deleg:…) — NUNCA mostrarlo. Solo un contador.
            <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 2 }}>
              Sesión {gi + 1} · {items.length} mensaje{items.length !== 1 ? 's' : ''}
            </div>
          )}
          {items.map((d) => <DelegationRow key={d.id} d={d} display={display} />)}
        </div>
      ))}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          style={{
            alignSelf: 'center', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)', fontSize: '0.6875rem', padding: '4px 10px',
            cursor: loadingMore ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          {loadingMore && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
          Cargar más
        </button>
      )}
    </div>
  );
}

function DelegationRow({ d, display }: { d: AgentDelegation; display: (n: string | null) => string }) {
  const [open, setOpen] = useState(false);
  const out = d.direction === 'outgoing';
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 9px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flexShrink: 0, marginTop: 1, color: out ? 'var(--amber)' : 'var(--success)' }} title={out ? 'delegó a' : 'recibió de'}>
          {out ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text)', fontWeight: 500 }}>
              {display(d.from_agent)} <span style={{ color: 'var(--text-muted)' }}>→</span> {display(d.to_agent)}
            </span>
            {d.briefing && (
              <span style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--amber)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', padding: '1px 5px' }}>briefing</span>
            )}
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatRelativeTime(d.created_at)}</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d.preview || <span style={{ fontStyle: 'italic' }}>(sin texto)</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
            {typeof d.tokens_used === 'number' && d.tokens_used > 0 && <span>{d.tokens_used.toLocaleString('es-ES')} tok</span>}
            {d.tool_calls.length > 0 && (
              <button
                onClick={() => setOpen((o) => !o)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.5625rem', padding: 0, fontFamily: 'var(--font-sans)' }}
              >
                <Wrench size={10} /> {d.tool_calls.length} tool{d.tool_calls.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          {open && d.tool_calls.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {d.tool_calls.map((t, i) => (
                <span key={i} style={{ fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1px 6px', color: 'var(--text-dim)' }}>{t.tool}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
