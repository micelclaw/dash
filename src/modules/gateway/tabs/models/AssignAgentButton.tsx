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

import { useState } from 'react';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import type { ManagedAgent } from '@/modules/agents/types';

/**
 * Botón "Asignar" de la tarjeta de modelo (sustituye al viejo Set Default):
 * popover con los agentes del usuario — elegir uno asigna ESTE modelo a ese
 * agente (POST /managed-agents/:id/set-model, aplica a sesiones nuevas).
 */
export function AssignAgentButton({ agents, assignedAgentIds, disabled, disabledReason, assigningAgentId, onAssign }: {
  agents: ManagedAgent[];
  /** Agentes que ya usan este modelo → check ámbar, no clicables. */
  assignedAgentIds: Set<string>;
  /** orphan / no_auth: no tiene sentido asignar. */
  disabled?: boolean;
  disabledReason?: string;
  /** Asignación en vuelo para ESTE modelo → spinner en esa fila. */
  assigningAgentId: string | null;
  onAssign: (agent: ManagedAgent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          title={disabled ? disabledReason : 'Asignar este modelo a un agente'}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered && !disabled ? 'var(--amber-dim)' : 'transparent',
            color: hovered && !disabled ? 'var(--amber)' : 'var(--text-dim)',
            border: '1px solid transparent',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            fontSize: '0.75rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'var(--transition-fast)',
            fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 4,
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <UserPlus size={12} />
          Asignar
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" style={{ width: 248, padding: 6 }}>
        <div style={{
          fontSize: '0.6875rem', color: 'var(--text-dim)',
          padding: '4px 8px 6px', fontFamily: 'var(--font-sans)',
        }}>
          Asignar a un agente · aplica a sesiones nuevas
        </div>
        {agents.length === 0 && (
          <div style={{ padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Sin agentes
          </div>
        )}
        {agents.map((a) => {
          const already = assignedAgentIds.has(a.id);
          const busy = assigningAgentId === a.id;
          return (
            <button
              key={a.id}
              disabled={already || busy}
              title={already ? `${a.display_name} ya usa este modelo` : undefined}
              onClick={() => { onAssign(a); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '6px 8px',
                background: 'transparent', border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: already || busy ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={(e) => { if (!already && !busy) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <AgentAvatar avatar={a.avatar} name={a.name} color={a.color} size={20} title={a.display_name} />
              <span style={{
                flex: 1, textAlign: 'left', fontSize: '0.8125rem',
                color: already ? 'var(--amber)' : 'var(--text)',
                fontWeight: already ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {a.display_name}
              </span>
              {busy
                ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                : already ? <Check size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} /> : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
