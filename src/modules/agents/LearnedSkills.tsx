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
import { GraduationCap, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { LearnedSkill } from './types';

interface LearnedSkillsProps {
  learnedSkills: LearnedSkill[];
  agentId: string;
  /** Refrescar el agente del padre tras olvidar una skill. */
  onChanged: () => void;
}

export function LearnedSkills({ learnedSkills, agentId, onChanged }: LearnedSkillsProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [forgetting, setForgetting] = useState<string | null>(null);

  // Sin skills aprendidas → no ocupamos espacio en el Overview.
  if (!learnedSkills || learnedSkills.length === 0) return null;

  const forget = async (name: string) => {
    setForgetting(name);
    try {
      await api.delete(`/managed-agents/${agentId}/learned-skills/${encodeURIComponent(name)}`);
      toast.success(`Skill "${name}" olvidada — recarga el Gateway para que el agente deje de cargarla`);
      onChanged();
    } catch {
      toast.error('No se pudo olvidar la skill');
    } finally {
      setForgetting(null);
      setConfirming(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <GraduationCap size={14} style={{ color: 'var(--amber)' }} />
        <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Skills aprendidas ({learnedSkills.length})
        </h4>
      </div>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', margin: 0 }}>
        Skills que el agente ha graduado de su experiencia. No son apps: solo este agente las usa.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {learnedSkills.map((s) => {
          const isConfirming = confirming === s.name;
          const isForgetting = forgetting === s.name;
          return (
            <div
              key={s.name}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 8, border: '1px solid var(--border, rgba(127,127,127,0.2))',
                background: 'var(--bg-subtle, rgba(245,180,60,0.06))', opacity: isForgetting ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{s.icon || '🎓'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title || s.name}
                </span>
                <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-dim)' }}>
                  {s.name}
                </span>
              </span>
              {isConfirming ? (
                <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => forget(s.name)}
                    disabled={isForgetting}
                    style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--red, #ef4444)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Olvidar
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(s.name)}
                  title="Olvidar esta skill"
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', flexShrink: 0, padding: 2 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
