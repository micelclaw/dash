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

import { AlertTriangle, GitBranch, Activity } from 'lucide-react';
import { StuckYieldRecovery } from './StuckYieldRecovery';
import { DelegationFlow } from './DelegationFlow';
import { EventTimeline } from './EventTimeline';
import type { ManagedAgent } from './types';

interface AgentActivityCenterProps {
  agentId: string;
  agents: ManagedAgent[];
}

/**
 * Sub-pestaña "Actividad": centro operativo por-agente. Tres bloques —
 * recuperación de stuck-yields (acción), delegaciones visibles, timeline de
 * eventos. Distinto de la tarjeta resumen "Actividad en vivo" del Overview.
 */
export function AgentActivityCenter({ agentId, agents }: AgentActivityCenterProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          <AlertTriangle size={14} style={{ color: 'var(--warning)' }} /> Recuperación de stuck-yields
        </h4>
        <StuckYieldRecovery agentId={agentId} />
      </section>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          <GitBranch size={14} style={{ color: 'var(--mod-agents, var(--amber))' }} /> Delegaciones
        </h4>
        <DelegationFlow agentId={agentId} agents={agents} />
      </section>

      <div style={{ height: 1, background: 'var(--border)' }} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          <Activity size={14} style={{ color: 'var(--mod-agents, var(--amber))' }} /> Eventos
        </h4>
        <EventTimeline agentId={agentId} />
      </section>
    </div>
  );
}
