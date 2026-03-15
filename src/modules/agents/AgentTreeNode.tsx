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
  const hasHexColor = agent.color && agent.color.startsWith('#');
  const bgColor = hasHexColor
    ? (hovered ? `color-mix(in srgb, ${accentColor} 8%, var(--surface-hover))` : `color-mix(in srgb, ${accentColor} 4%, var(--card))`)
    : (hovered ? 'var(--surface-hover)' : 'var(--card)');
  const borderColor = selected ? 'var(--amber)' : hovered ? 'var(--border-hover, var(--border))' : 'var(--border)';

  // Owner card — clean, compact
  if (isOwner) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 340,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderLeft: `3px solid #d4a017`,
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          transition: 'var(--transition-fast)',
          boxSizing: 'border-box',
          boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>👤</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: '1.0625rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            Paco
          </span>
          <span style={{
            fontSize: '0.875rem',
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
        width: 340,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'var(--transition-fast)',
        boxSizing: 'border-box',
        boxShadow: selected
          ? `0 0 0 1px var(--amber), 0 4px 16px rgba(0,0,0,0.2)`
          : hovered
            ? '0 4px 12px rgba(0,0,0,0.15)'
            : '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header row: avatar + name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 32,
      }}>
        <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>
          {agent.avatar || '🤖'}
        </span>
        <span style={{
          fontSize: '1.0625rem',
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
        {agent.is_chief && (
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: accentColor,
            background: `${accentColor}18`,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            flexShrink: 0,
          }}>
            Main Router
          </span>
        )}
      </div>

      {/* Role description */}
      <div style={{
        fontSize: '0.9375rem',
        color: 'var(--text-dim)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}>
        {agent.role}
      </div>

      {/* Skill tags */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        minHeight: 28,
        alignItems: 'center',
      }}>
        {visibleSkills.map(skill => (
          <span
            key={skill.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 9px',
              fontSize: '0.8125rem',
              color: 'var(--text-dim)',
              lineHeight: 1.5,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{skill.icon}</span>
            {skill.name}
          </span>
        ))}
        {extraSkillCount > 0 && (
          <span style={{
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            fontWeight: 500,
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
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: statusStyle.bg,
          color: statusStyle.text,
          fontSize: '0.8125rem',
          fontWeight: 500,
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          lineHeight: 1.4,
          textTransform: 'capitalize',
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: 'var(--radius-full)',
            background: statusStyle.text,
            flexShrink: 0,
          }} />
          {agent.status}
        </span>

        {modelLabel && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--amber-dim)',
            color: 'var(--amber)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            padding: '4px 10px',
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
            gap: 6,
            marginTop: 2,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: toggleHovered ? 'var(--text)' : 'var(--text-dim)',
            transition: 'var(--transition-fast)',
          }}
        >
          <ChevronDown
            size={15}
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
