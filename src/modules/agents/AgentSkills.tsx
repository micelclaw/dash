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
import type { AgentSkill } from './types';

interface AgentSkillsProps {
  skills: AgentSkill[];
}

export function AgentSkills({ skills }: AgentSkillsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h4 style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: 0,
        }}>
          Skills ({skills.length})
        </h4>
        <button
          disabled
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            cursor: 'not-allowed',
            opacity: 0.5,
            padding: '2px 6px',
            fontFamily: 'var(--font-sans)',
          }}
          title="Coming soon"
        >
          + Assign
        </button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {skills.map(skill => (
          <div
            key={skill.id}
            onMouseEnter={() => setHoveredId(skill.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              height: 64,
              background: hoveredId === skill.id
                ? 'var(--surface-hover)'
                : 'var(--card)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              transition: 'var(--transition-fast)',
              cursor: 'default',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{skill.icon}</span>
            <span style={{
              fontSize: '0.6875rem',
              color: 'var(--text-dim)',
              textAlign: 'center',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              padding: '0 4px',
            }}>
              {skill.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
