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
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { AssignAppsModal } from '@/components/shared/AssignAppsModal';
import { AppIcon } from '@/components/shared/AppIcon';
import { AppDetailModal } from './AppDetailModal';
import type { AgentSkill } from './types';

interface AgentSkillsProps {
  skills: AgentSkill[];
  agentId: string;
  agentName?: string;
  agentAvatar?: string;
  skillModes?: Record<string, 'core' | 'full'>;
  /** Estimated context tokens per app (skill_id → tokens), from the context-budget
   *  endpoint. Rendered as a small badge on each app card. */
  appTokens?: Record<string, number>;
  onSkillsChanged?: () => void;
}

/** Compact "≈Xk" token count for the per-app badge. */
function fmtTok(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
}

export function AgentSkills({ skills, agentId, agentName, agentAvatar, skillModes, appTokens, onSkillsChanged }: AgentSkillsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [detailSkill, setDetailSkill] = useState<AgentSkill | null>(null);

  const handleRemove = async (skill: AgentSkill) => {
    setRemoving(skill.id);
    try {
      const remaining = skills
        .filter(s => s.id !== skill.id)
        .map(s => s.skill_id ?? `claw-${s.domain}`);
      await api.patch(`/managed-agents/${agentId}/skills`, { skills: remaining });
      toast.success(`${skill.name} removed`);
      onSkillsChanged?.();
    } catch {
      toast.error(`Failed to remove ${skill.name}`);
    } finally {
      setRemoving(null);
    }
  };

  const currentSkillIds = skills.map(s => s.skill_id ?? `claw-${s.domain}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Apps ({skills.length})
        </h4>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'none', border: 'none', color: 'var(--amber)',
            fontSize: '0.75rem', cursor: 'pointer', padding: '2px 6px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          + Assign
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {skills.map(skill => (
          <div
            key={skill.id}
            onMouseEnter={() => setHoveredId(skill.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => setDetailSkill(skill)}
            title={`Ver detalle / modo de ${skill.name}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, height: 64, position: 'relative',
              background: hoveredId === skill.id ? 'var(--surface-hover)' : 'var(--card)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              transition: 'var(--transition-fast)', cursor: 'pointer',
              opacity: removing === skill.id ? 0.5 : 1,
            }}
          >
            {hoveredId === skill.id && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(skill); }}
                disabled={removing === skill.id}
                style={{
                  position: 'absolute', top: 3, right: 3, width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: 'var(--text-dim)', padding: 0,
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'var(--error)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                title={`Remove ${skill.name}`}
              >
                <X size={10} />
              </button>
            )}
            <AppIcon icon={skill.icon} icon_kind={skill.icon_kind} color={skill.color} size={20} />
            <span style={{
              fontSize: '0.6875rem', color: 'var(--text-dim)', textAlign: 'center',
              lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: '100%', padding: '0 4px',
            }}>
              {skill.name}
            </span>
            {(() => {
              const t = appTokens?.[skill.skill_id ?? `claw-${skill.domain}`];
              return typeof t === 'number' ? (
                <span
                  title="Tokens de contexto estimados de esta app"
                  style={{
                    fontSize: '0.5625rem', color: 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                  }}
                >
                  ≈{fmtTok(t)}
                </span>
              ) : null;
            })()}
          </div>
        ))}
      </div>

      <AssignAppsModal
        agentId={agentId}
        agentName={agentName ?? 'Agent'}
        agentAvatar={agentAvatar}
        currentSkillIds={currentSkillIds}
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => onSkillsChanged?.()}
      />

      <AppDetailModal
        skill={detailSkill}
        agentId={agentId}
        allSkillIds={currentSkillIds}
        skillModes={skillModes ?? {}}
        open={detailSkill !== null}
        onClose={() => setDetailSkill(null)}
        onChanged={() => onSkillsChanged?.()}
      />
    </div>
  );
}
