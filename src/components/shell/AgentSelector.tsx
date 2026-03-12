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

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Settings } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { getMockAgents } from '@/services/mock';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface AgentSelectorProps {
  compact?: boolean;
}

export function AgentSelector({ compact }: AgentSelectorProps) {
  const agents = useChatStore((s) => s.agents);
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const selectAgent = useChatStore((s) => s.selectAgent);
  const setAgents = useChatStore((s) => s.setAgents);
  const navigate = useNavigate();

  useEffect(() => {
    if (agents.length === 0) {
      const isMock = import.meta.env.VITE_MOCK_API === 'true';
      if (isMock) {
        setAgents(getMockAgents());
      }
    }
  }, [agents.length, setAgents]);

  const current = agents.find((a) => a.name === selectedAgent) ?? agents[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? 0 : 6,
            padding: compact ? '4px 6px' : '4px 8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <span>🤖</span>
          {!compact && <span>{current?.display_name ?? 'Francis'}</span>}
          {!compact && <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>▾</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8}>
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.name}
            onClick={() => selectAgent(agent.name)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span>🤖 {agent.display_name}</span>
            {agent.name === selectedAgent && (
              <span style={{ color: 'var(--amber)' }}>✓</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/agents')}>
          <Settings size={14} />
          Manage agents
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
