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
import { GraduationCap, ChevronRight } from 'lucide-react';
import { LearnedSkillDetailModal } from './LearnedSkillDetailModal';
import type { LearnedSkill } from './types';

interface LearnedSkillsProps {
  learnedSkills: LearnedSkill[];
  agentId: string;
  /** Refrescar el agente del padre tras olvidar una skill. */
  onChanged: () => void;
}

export function LearnedSkills({ learnedSkills, agentId, onChanged }: LearnedSkillsProps) {
  const [selected, setSelected] = useState<LearnedSkill | null>(null);
  const [open, setOpen] = useState(false);

  // Sin skills aprendidas → no ocupamos espacio en el Overview.
  if (!learnedSkills || learnedSkills.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <GraduationCap size={14} style={{ color: 'var(--amber)' }} />
        <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Skills aprendidas ({learnedSkills.length})
        </h4>
      </div>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', margin: 0 }}>
        Skills que el agente ha graduado de su experiencia. No son apps: solo este agente las usa. Pulsa una para leer su contenido.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {learnedSkills.map((s) => (
          <button
            key={s.name}
            onClick={() => { setSelected(s); setOpen(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
              borderRadius: 8, border: '1px solid var(--border, rgba(127,127,127,0.2))',
              background: 'var(--bg-subtle, rgba(245,180,60,0.06))', color: 'var(--text)',
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
            <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      <LearnedSkillDetailModal
        skill={selected}
        agentId={agentId}
        open={open}
        onClose={() => setOpen(false)}
        onChanged={onChanged}
      />
    </div>
  );
}
