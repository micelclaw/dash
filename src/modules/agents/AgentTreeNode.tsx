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
import { ChevronDown } from 'lucide-react';
import type { ManagedAgent } from './types';

interface AgentTreeNodeProps {
  agent: ManagedAgent;
  selected: boolean;
  onClick: () => void;
  isOwner?: boolean;
  childCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: 'var(--success)' },
  idle: { bg: 'rgba(234,179,8,0.15)', text: '#EAB308' },
  error: { bg: 'rgba(239,68,68,0.15)', text: 'var(--error)' },
};

function formatModelName(model: string): string {
  if (!model) return '';
  const lower = model.toLowerCase();
  if (lower.includes('opus')) {
    const ver = lower.match(/(\d+)[-.](\d+)/);
    return ver ? `Opus ${ver[1]}.${ver[2]}` : 'Opus';
  }
  if (lower.includes('sonnet')) {
    const ver = lower.match(/(\d+)[-.](\d+)/);
    return ver ? `Sonnet ${ver[1]}.${ver[2]}` : 'Sonnet';
  }
  if (lower.includes('haiku')) {
    const ver = lower.match(/(\d+)[-.](\d+)/);
    return ver ? `Haiku ${ver[1]}.${ver[2]}` : 'Haiku';
  }
  if (lower.includes('deepseek')) return 'DeepSeek';
  return model;
}

export function AgentTreeNode({ agent, selected, onClick, isOwner, childCount = 0, expanded = true, onToggleExpand }: AgentTreeNodeProps) {
  const [hovered, setHovered] = useState(false);
  const [toggleHovered, setToggleHovered] = useState(false);

  const accentColor = agent.color || 'var(--amber)';
  const bgColor = hovered ? 'var(--surface-hover)' : 'var(--card)';
  const borderColor = selected ? 'var(--amber)' : 'var(--border)';

  // Owner card — simple, compact
  if (isOwner) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 240,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderLeft: `3px solid #d4a017`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'var(--transition-fast)',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>👤</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            Paco
          </span>
          <span style={{
            fontSize: '0.6875rem',
            color: 'var(--text-dim)',
          }}>
            Owner
          </span>
        </div>
      </div>
    );
  }

  // Regular agent card
  const visibleSkills = agent.skills.slice(0, 6);
  const extraSkillCount = Math.max(0, agent.skills.length - 6);
  const statusStyle = STATUS_COLORS[agent.status] ?? { bg: 'rgba(234, 179, 8, 0.15)', text: '#EAB308' };
  const modelLabel = formatModelName(agent.model);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 240,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'var(--transition-fast)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header row: avatar + name + role badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 24,
      }}>
        <span style={{ fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }}>
          {agent.avatar || '🤖'}
        </span>
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}>
          {agent.display_name}
        </span>
        <span style={{
          fontSize: '0.625rem',
          color: 'var(--text-muted)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {agent.is_chief ? agent.role : agent.role}
        </span>
      </div>

      {/* Role description line */}
      <div style={{
        fontSize: '0.6875rem',
        color: 'var(--text-dim)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}>
        {agent.role}
      </div>

      {/* Skill tags */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        minHeight: 20,
        alignItems: 'center',
      }}>
        {visibleSkills.map(skill => (
          <span
            key={skill.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 5px',
              fontSize: '0.625rem',
              color: 'var(--text-dim)',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '0.625rem' }}>{skill.icon}</span>
            {skill.name}
          </span>
        ))}
        {extraSkillCount > 0 && (
          <span style={{
            fontSize: '0.625rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}>
            +{extraSkillCount}
          </span>
        )}
      </div>

      {/* Footer: status badge + model badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
      }}>
        {/* Status badge */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: statusStyle.bg,
          color: statusStyle.text,
          fontSize: '0.625rem',
          fontWeight: 500,
          padding: '2px 7px',
          borderRadius: 'var(--radius-sm)',
          lineHeight: 1.4,
          textTransform: 'capitalize',
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: 'var(--radius-full)',
            background: statusStyle.text,
            flexShrink: 0,
          }} />
          {agent.status}
        </span>

        {/* Model badge */}
        {modelLabel && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--amber-dim)',
            color: 'var(--amber)',
            fontSize: '0.625rem',
            fontWeight: 500,
            padding: '2px 7px',
            borderRadius: 'var(--radius-sm)',
            lineHeight: 1.4,
          }}>
            {modelLabel}
          </span>
        )}
      </div>

      {/* Sub-agent expand/collapse toggle */}
      {childCount > 0 && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
          onMouseEnter={() => setToggleHovered(true)}
          onMouseLeave={() => setToggleHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
            paddingTop: 6,
            borderTop: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: '0.6875rem',
            color: toggleHovered ? 'var(--text)' : 'var(--text-dim)',
            transition: 'var(--transition-fast)',
          }}
        >
          <ChevronDown
            size={12}
            style={{
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              flexShrink: 0,
            }}
          />
          {childCount} sub-agent{childCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
