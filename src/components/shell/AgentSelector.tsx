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
import { api } from '@/services/api';
import { getMockAgents } from '@/services/mock';
import type { Agent } from '@/types/chat';
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

interface ManagedAgentResponse {
  id: string;
  name: string;
  display_name: string;
  role: string;
  model: string;
  avatar: string | null;
  color: string;
  skills: string[];
}

export function AgentSelector({ compact }: AgentSelectorProps) {
  const agents = useChatStore((s) => s.agents);
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const selectAgent = useChatStore((s) => s.selectAgent);
  const startNewConversation = useChatStore((s) => s.startNewConversation);
  const setAgents = useChatStore((s) => s.setAgents);
  const navigate = useNavigate();

  useEffect(() => {
    if (agents.length > 0) return;
    const isMock = import.meta.env.VITE_MOCK_API === 'true';
    if (isMock) {
      setAgents(getMockAgents());
      return;
    }
    // Load real agents from API
    api.get<{ data: ManagedAgentResponse[] }>('/managed-agents')
      .then(res => {
        const mapped: Agent[] = res.data.map(a => ({
          name: a.name,
          display_name: a.display_name,
          role: a.role,
          model: a.model,
          skills_count: Array.isArray(a.skills) ? a.skills.length : 0,
          avatar: a.avatar ?? undefined,
          color: a.color,
        }));
        if (mapped.length > 0) setAgents(mapped);
      })
      .catch(() => { /* silently fall back to empty */ });
  }, [agents.length, setAgents]);

  const current = agents.find((a) => a.name === selectedAgent) ?? agents[0];

  const handleSelectAgent = (agentName: string) => {
    if (agentName !== selectedAgent) {
      startNewConversation();
      selectAgent(agentName);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: compact ? 0 : 6,
            padding: compact ? '4px 6px' : '4px 10px',
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
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = current?.color ?? 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <span>{current?.avatar ?? '🤖'}</span>
          {!compact && (
            <span style={{ color: current?.color }}>{current?.display_name ?? 'Francis'}</span>
          )}
          {!compact && <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>▾</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8}>
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.name}
            onClick={() => handleSelectAgent(agent.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{agent.avatar ?? '🤖'}</span>
            <span style={{ color: agent.color, fontWeight: agent.name === selectedAgent ? 600 : 400 }}>
              {agent.display_name}
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {agent.role}
            </span>
            {agent.name === selectedAgent && (
              <span style={{ color: 'var(--amber)', marginLeft: 'auto', flexShrink: 0 }}>✓</span>
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
