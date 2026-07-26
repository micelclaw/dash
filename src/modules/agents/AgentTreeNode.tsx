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
import { ChevronDown, Cpu } from 'lucide-react';
import type { ManagedAgent } from './types';
import { EmojiAvatarPicker } from '@/components/shared/EmojiAvatarPicker';
import { AppIcon } from '@/components/shared/AppIcon';
import { useUserAvatar } from '@/hooks/use-user-avatar';
import { getProviderIcon } from '@/config/provider-icons';
import { PROVIDER_COLORS, PROVIDER_LABELS } from '@/modules/gateway/tabs/models/constants';

interface AgentTreeNodeProps {
  agent: ManagedAgent;
  selected: boolean;
  onClick: () => void;
  isOwner?: boolean;
  childCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * Etiqueta de modelo a ancho completo, con el estilo de las opciones del
 * ModelSelect / tarjetas de Gateway → Models: icono del proveedor en un
 * cuadro tintado + nombre del modelo + label del proveedor debajo.
 */
function ModelBadge({ model }: { model: string }) {
  const slash = model.indexOf('/');
  const provider = slash > 0 ? model.slice(0, slash) : '';
  const rest = slash > 0 ? model.slice(slash + 1) : model;
  const Icon = provider ? getProviderIcon(provider) : null;
  const color = PROVIDER_COLORS[provider?.toLowerCase()] ?? 'var(--text-dim)';
  return (
    <div
      title={model}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
        marginTop: 2,
      }}
    >
      <div style={{
        width: 28, height: 28,
        borderRadius: 'var(--radius-sm)',
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {Icon ? <Icon size={20} style={{ color }} /> : <Cpu size={15} style={{ color }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--text)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {rest}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
          {PROVIDER_LABELS[provider] ?? provider}
        </span>
      </div>
    </div>
  );
}

export function AgentTreeNode({ agent, selected, onClick, isOwner, childCount = 0, expanded = true, onToggleExpand }: AgentTreeNodeProps) {
  const [userAvatar, setUserAvatar] = useUserAvatar();
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
        data-agent-card
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 340,
          background: bgColor,
          // Longhand por lado: no mezclar `border` shorthand + `borderLeft`
          // (React avisa en rerender; mismo patrón que el fix flex de iter 6).
          borderTop: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          borderBottom: `1px solid ${borderColor}`,
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
        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <EmojiAvatarPicker
            value={userAvatar}
            onChange={setUserAvatar}
            size={36}
            fallback="👤"
            title="Change your avatar"
          />
        </div>
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

  return (
    <div
      data-agent-card
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 340,
        background: bgColor,
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
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
            <AppIcon icon={skill.icon} icon_kind={skill.icon_kind} color={skill.color} size={12} />
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

      {/* Footer: badge de modelo a ancho completo (estilo ModelSelect) */}
      {agent.model && <ModelBadge model={agent.model} />}

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
