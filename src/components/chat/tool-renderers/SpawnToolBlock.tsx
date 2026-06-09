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
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { ToolCallRecord } from '@/types/chat';
import { useChatStore } from '@/stores/chat.store';
import { getAgentColor } from '@/modules/agents/agent-colors';
import { PILL_BASE_STYLE, ICON_STYLE, SUMMARY_STYLE, EXPANDED_BODY_STYLE, asString, truncateLine } from './shared';

interface Props { tool: ToolCallRecord }

interface SpawnArgs {
  agentId?: string;
  task?: string;
  mode?: string;
  model?: string;
  thinking?: string;
}

function parseInput(input: ToolCallRecord['input']): SpawnArgs {
  let raw: Record<string, unknown> = {};
  if (typeof input === 'object' && input != null) raw = input as Record<string, unknown>;
  else if (typeof input === 'string') {
    try { raw = JSON.parse(input) as Record<string, unknown>; } catch { raw = {}; }
  }
  // El input del tool-call llega snake_case por el case-transform del API/WS
  // (agent_id, task_name), pero el modelo lo emite camelCase (agentId, task).
  // Aceptamos ambos para que la chip muestre "Dalí" y no el fallback "sub-agent".
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) { const v = raw[k]; if (typeof v === 'string' && v) return v; }
    return undefined;
  };
  return {
    agentId: pick('agentId', 'agent_id'),
    task: pick('task', 'task_name', 'message'),
    mode: pick('mode'),
    model: pick('model'),
    thinking: pick('thinking'),
  };
}

function shortAgentName(agentId: string | undefined): string {
  // "<prefix>--<name>" → "Name" (prefix es el agent_prefix del usuario:
  // letras/dígitos/guiones, p.ej. "paco--dali", "admin--atlas"). El regex viejo
  // exigía 8 hex (formato legacy "dd4d75fb--dali") y NO casaba "paco--dali" → de
  // ahí que la chip cayera al fallback "sub-agent".
  if (!agentId) return 'sub-agent';
  const m = agentId.match(/^[a-z0-9-]+--(.+)$/i);
  const name = m?.[1] ?? agentId;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function SpawnToolBlock({ tool }: Props) {
  const [expanded, setExpanded] = useState(false);
  const args = parseInput(tool.input);
  const agentName = shortAgentName(args.agentId);
  const taskPreview = truncateLine(args.task ?? '', 80);
  const agents = useChatStore((s) => s.agents);
  const agentMatch = agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase());
  const agentColor = getAgentColor(agentName, (agentMatch as { color?: string } | undefined)?.color);
  const agentAvatar = (agentMatch as { avatar?: string } | undefined)?.avatar ?? '🤖';

  const status = tool.status ?? 'success';
  const statusBadge =
    status === 'running' ? <Loader2 size={12} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} /> :
    status === 'error'   ? <span style={{ color: 'var(--error)', fontSize: '0.75rem' }}>❌</span> :
                            <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✅</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...PILL_BASE_STYLE,
          borderRadius: expanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
          // Subtle accent on the left using the destination agent's color.
          borderLeft: `3px solid ${agentColor}`,
        }}
      >
        <span style={ICON_STYLE}>🔀</span>
        <span style={SUMMARY_STYLE}>
          Delegado a <span aria-hidden style={{ marginRight: 2 }}>{agentAvatar}</span>
          <strong style={{ color: agentColor }}>{agentName}</strong>
          {taskPreview && <span style={{ color: 'var(--text-dim)' }}> · "{taskPreview}"</span>}
        </span>
        {statusBadge}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div style={EXPANDED_BODY_STYLE}>
          {args.task && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Task:</span>{' '}
              <span style={{ color: 'var(--text)' }}>{args.task}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
            {args.mode  && <span>mode: {args.mode}</span>}
            {args.model && <span>model: {args.model}</span>}
            {args.thinking && <span>thinking: {args.thinking}</span>}
            {tool.id && <span>id: {tool.id.slice(0, 8)}</span>}
          </div>
          {tool.output && (
            <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600 }}>Result:</span> {truncateLine(asString(tool.output), 200)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
