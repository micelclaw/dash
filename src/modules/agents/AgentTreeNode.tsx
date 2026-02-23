import { useState } from 'react';
import type { ManagedAgent } from './types';

interface AgentTreeNodeProps {
  agent: ManagedAgent;
  selected: boolean;
  onClick: () => void;
  isOwner?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--success)',
  idle: '#EAB308',
  error: 'var(--error)',
};

export function AgentTreeNode({ agent, selected, onClick, isOwner }: AgentTreeNodeProps) {
  const [hovered, setHovered] = useState(false);

  const bg = selected || hovered ? 'var(--surface-hover)' : 'var(--card)';
  const borderColor = selected ? 'var(--amber)' : 'var(--border)';
  const borderWidth = selected ? 2 : 1;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 160,
        background: bg,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transition: 'var(--transition-fast)',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: '1.25rem' }}>
        {isOwner ? '👤' : (agent.avatar || '🤖')}
      </span>
      <span style={{
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--text)',
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {isOwner ? 'Paco' : agent.display_name}
      </span>
      <span style={{
        fontSize: '0.6875rem',
        color: 'var(--text-dim)',
        textAlign: 'center',
      }}>
        {isOwner ? 'Owner' : agent.role}
      </span>
      {!isOwner && (
        <>
          <span style={{
            fontSize: '0.625rem',
            color: 'var(--text-muted)',
          }}>
            {agent.skills.length} skill{agent.skills.length !== 1 ? 's' : ''}
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: STATUS_COLORS[agent.status] || 'var(--text-muted)',
            }} />
            <span style={{
              fontSize: '0.625rem',
              color: 'var(--text-dim)',
            }}>
              {agent.status}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
