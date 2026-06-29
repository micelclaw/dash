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
import { useNavigate } from 'react-router';
import { SettingSection } from '../SettingSection';
import { api } from '@/services/api';

interface AgentRow { name: string; learned_skills?: unknown[] }

export function AgentBrainSummary() {
  const navigate = useNavigate();
  const [learned, setLearned] = useState(0);
  const [proposals, setProposals] = useState(0);
  const [boardCards, setBoardCards] = useState<number | null>(null);
  const [dreaming, setDreaming] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<{ data: AgentRow[] }>('/managed-agents')
      .then((r) => { if (alive) setLearned(r.data.reduce((n, a) => n + (a.learned_skills?.length ?? 0), 0)); })
      .catch(() => {});
    api.get<{ data: { proposals: unknown[] } }>('/managed-agents/proposals')
      .then((r) => { if (alive) setProposals((r.data.proposals ?? []).length); })
      .catch(() => {});
    api.get<{ data: { enabled: boolean; reachable: boolean } }>('/workboard/status')
      .then((r) => {
        if (!r.data.enabled || !r.data.reachable) { if (alive) setBoardCards(null); return; }
        return api.get<{ data: { cards: unknown[] } }>('/workboard/cards').then((c) => { if (alive) setBoardCards((c.data.cards ?? []).length); });
      })
      .catch(() => { if (alive) setBoardCards(null); });
    api.get<{ data: { enabled?: boolean } }>('/gateway/dreaming-config')
      .then((r) => { if (alive) setDreaming(Boolean(r.data.enabled)); })
      .catch(() => { if (alive) setDreaming(null); });
    return () => { alive = false; };
  }, []);

  const stat = (icon: string, label: string, value: string, hint?: string) => (
    <button
      onClick={() => navigate('/agents')}
      style={{
        display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 130px', minWidth: 120, textAlign: 'left',
        padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{icon} {label}</span>
      <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>{value}</span>
      {hint && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{hint}</span>}
    </button>
  );

  return (
    <SettingSection title="Agent Brain">
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0 0 10px' }}>
        Memoria que aprende, skills aprendidas y coordinación (Workboard) de tus agentes. Pulsa para ir al módulo de agentes.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {stat('🧠', 'Dreaming', dreaming === null ? '—' : dreaming ? 'On' : 'Off', 'consolidación nocturna de memoria')}
        {stat('🎓', 'Skills aprendidas', String(learned), 'graduadas del Skill Workshop')}
        {stat('🔧', 'Propuestas', String(proposals), 'pendientes de revisar')}
        {stat('📋', 'Workboard', boardCards === null ? '—' : String(boardCards), boardCards === null ? 'no activado' : 'tareas activas')}
      </div>
    </SettingSection>
  );
}
