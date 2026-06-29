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

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { workboardApi } from './workboard/workboard.service';
import type { ManagedAgent, AgentDetailTab } from './types';
import type { SkillProposal } from './types';

interface Props {
  agent: ManagedAgent;
  /** Deep-link a un tab de AgentDetail (memory / overview). */
  onOpenTab: (tab: AgentDetailTab) => void;
}

interface MemoryStatus {
  provider?: string;
  dreaming?: { enabled?: boolean };
  embedding?: { ok?: boolean };
}

export function AgentBrainChips({ agent, onOpenTab }: Props) {
  const [proposals, setProposals] = useState(0);
  const [boardCards, setBoardCards] = useState<number | null>(null);
  const [memOk, setMemOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<{ data: { proposals: SkillProposal[] } }>('/managed-agents/proposals')
      .then((r) => { if (alive) setProposals((r.data.proposals ?? []).filter((p) => p.agent_name === agent.name).length); })
      .catch(() => {});
    api.get<{ data: MemoryStatus }>(`/managed-agents/${agent.id}/memory/status`)
      .then((r) => { if (alive) setMemOk(Boolean(r.data.provider) && r.data.provider !== 'none'); })
      .catch(() => { if (alive) setMemOk(null); });
    workboardApi.listCards()
      .then((d) => { if (alive) setBoardCards(d.cards.filter((c) => c.agent_id === agent.name).length); })
      .catch(() => { if (alive) setBoardCards(null); }); // workboard apagado → null (chip oculto)
    return () => { alive = false; };
  }, [agent.id, agent.name]);

  const learned = agent.learned_skills?.length ?? 0;

  const chip = (icon: string, label: string, dot: string | null, onClick?: () => void) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999,
        border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-dim)',
        fontSize: '0.6875rem', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span>{icon}</span>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
      <span>{label}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Brain</span>
      {chip('🧠', 'Memory', memOk === null ? 'var(--text-muted)' : memOk ? 'var(--green, #10b981)' : 'var(--text-dim)', () => onOpenTab('memory'))}
      {chip('🔧', `Skills: ${learned} aprendida${learned === 1 ? '' : 's'}${proposals > 0 ? ` · ${proposals} propuesta${proposals === 1 ? '' : 's'}` : ''}`, proposals > 0 ? 'var(--amber)' : null, () => onOpenTab('overview'))}
      {boardCards !== null && chip('📋', `Board: ${boardCards} tarea${boardCards === 1 ? '' : 's'}`, boardCards > 0 ? 'var(--blue, #3b82f6)' : null,
        () => window.dispatchEvent(new CustomEvent('claw:open-agent-tab', { detail: 'workboard' })))}
    </div>
  );
}
