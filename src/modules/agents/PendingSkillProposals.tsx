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
import { Lightbulb } from 'lucide-react';
import { api } from '@/services/api';
import { ProposalDetailModal } from './ProposalDetailModal';
import type { SkillProposal } from './types';

interface PendingSkillProposalsProps {
  /** id del managed-agent (para los POST approve/reject). */
  agentId: string;
  /** nombre "bare" del agente (atlas/francis…) para filtrar la cola del usuario. */
  agentName: string;
  /** Refrescar el agente del padre tras graduar (para que aparezca en learned_skills). */
  onGraduated?: () => void;
}

export function PendingSkillProposals({ agentId, agentName, onGraduated }: PendingSkillProposalsProps) {
  const [proposals, setProposals] = useState<SkillProposal[]>([]);
  const [selected, setSelected] = useState<SkillProposal | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api.get<{ data: { proposals: SkillProposal[] } }>('/managed-agents/proposals')
      .then((res) => setProposals((res.data.proposals ?? []).filter((p) => p.agent_name === agentName)))
      .catch(() => setProposals([]));
  }, [agentName]);

  useEffect(() => { load(); }, [load]);

  // No renderizar nada si no hay propuestas para este agente (mantiene el Overview limpio).
  if (proposals.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lightbulb size={14} style={{ color: 'var(--amber)' }} />
        <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Propuestas de skill ({proposals.length})
        </h4>
      </div>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', margin: 0 }}>
        El agente sugiere aprender estas skills a partir de su experiencia. Revísalas antes de graduarlas.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {proposals.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelected(p); setOpen(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
              padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, rgba(127,127,127,0.2))',
              background: 'var(--bg-subtle, rgba(245,180,60,0.06))', color: 'var(--text)',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🎓</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title || p.skill_name}
              </span>
              {p.description && (
                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.description}
                </span>
              )}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--amber)', fontWeight: 600, flexShrink: 0 }}>Revisar</span>
          </button>
        ))}
      </div>

      <ProposalDetailModal
        proposal={selected}
        agentId={agentId}
        open={open}
        onClose={() => setOpen(false)}
        onChanged={() => { load(); onGraduated?.(); }}
      />
    </div>
  );
}
