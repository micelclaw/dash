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
import { ArrowRight } from 'lucide-react';
import { getAgentColor } from './agent-colors';
import type { AgentConversation, ManagedAgent } from './types';

interface ConversationMessageProps {
  message: AgentConversation;
  agents: ManagedAgent[];
}

export function ConversationMessage({ message, agents }: ConversationMessageProps) {
  const [hovered, setHovered] = useState(false);

  const fromAgent = agents.find(a => a.name === message.from_agent);
  const toAgent = agents.find(a => a.name === message.to_agent);

  const fromAvatar = fromAgent?.avatar ?? '🤖';
  const fromName = fromAgent?.display_name ?? message.from_agent;
  const toAvatar = toAgent?.avatar ?? '🤖';
  const toName = toAgent?.display_name ?? message.to_agent;

  const fromColor = getAgentColor(message.from_agent, (fromAgent as ManagedAgent & { color?: string })?.color);

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const tokensFormatted = message.tokens_used.toLocaleString();
  const costFormatted = `$${message.cost_usd.toFixed(3)}`;
  const toolCount = message.tool_calls.length;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 12px',
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${fromColor}`,
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'var(--transition-fast)',
      }}
    >
      {/* Header row: From → To ... Time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text)',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `2px solid ${fromColor}`,
            fontSize: '0.75rem',
          }}>{fromAvatar}</span>
          <span style={{ color: fromColor }}>{fromName}</span>
          <ArrowRight size={12} style={{ color: 'var(--text-dim)' }} />
          <span>{toAvatar}</span>
          <span>{toName}</span>
        </div>
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--text-dim)',
        }}>
          {time}
        </span>
      </div>

      {/* Message body */}
      <div style={{
        fontSize: '0.8125rem',
        color: 'var(--text)',
        marginBottom: toolCount > 0 ? 8 : 0,
        lineHeight: 1.5,
      }}>
        &ldquo;{message.message}&rdquo;
      </div>

      {/* Tool calls + stats row */}
      {toolCount > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <details style={{ flex: 1 }}>
            <summary style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              userSelect: 'none',
            }}>
              📎 {toolCount} tool call{toolCount !== 1 ? 's' : ''}
            </summary>
            <pre style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text)',
              background: 'var(--surface)',
              padding: 8,
              borderRadius: 'var(--radius-sm)',
              overflowX: 'auto',
              marginTop: 6,
              marginBottom: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {JSON.stringify(message.tool_calls, null, 2)}
            </pre>
          </details>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
            marginLeft: 12,
            flexShrink: 0,
          }}>
            {tokensFormatted} tok &middot; {costFormatted}
          </span>
        </div>
      )}

      {/* Stats row when no tool calls */}
      {toolCount === 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 4,
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
          }}>
            {tokensFormatted} tok &middot; {costFormatted}
          </span>
        </div>
      )}
    </div>
  );
}
