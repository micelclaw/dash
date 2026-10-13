import { classify } from '@/config/tool-rendering';
import { TechnicalDetails, getToolPresentation } from './ProgressiveToolBlock';
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

import { useEffect, useState, useId } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { ToolCallRecord } from '@/types/chat';
import { useChatStore } from '@/stores/chat.store';
import { api } from '@/services/api';
import { getAgentColor } from '@/modules/agents/agent-colors';
import { PILL_BASE_STYLE, ICON_STYLE, SUMMARY_STYLE, EXPANDED_BODY_STYLE, asString, truncateLine, toolDetail } from './shared';

interface Props { tool: ToolCallRecord }

interface SpawnArgs {
  agentId?: string;
  sessionKey?: string;
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
    sessionKey: pick('sessionKey', 'session_key'),
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

function agentIdFromSessionKey(sessionKey: string | undefined): string | undefined {
  return sessionKey?.match(/^agent:([^:]+):/i)?.[1];
}

function spawnedSessionKeyFromOutput(output: string | undefined): string | undefined {
  if (!output) return undefined;
  try {
    const value = JSON.parse(output) as Record<string, unknown>;
    const key = value.childSessionKey ?? value.child_session_key;
    // 9.4 may use a `dashboard` child session for a spawned task rather than
    // the older `subagent` namespace. Both carry the canonical agent id.
    return typeof key === 'string' && /^agent:[a-z0-9_-]+:(?:subagent|dashboard|deleg):/i.test(key) ? key : undefined;
  } catch { return undefined; }
}

interface DelegatedTranscript {
  messages: Array<{ role: 'user' | 'assistant'; text: string; timestamp: number | null }>;
}

export function SpawnToolBlock({ tool }: Props) {
  const expandedRegionId = useId();
  const nativeToolName = tool.presentation?.canonical_name ?? classify(tool.tool).name;
  const expandedStorageKey = `micelclaw:delegation-expanded:${tool.id}`;
  const [expanded, setExpanded] = useState(() => {
    try { return sessionStorage.getItem(expandedStorageKey) === '1'; } catch { return false; }
  });
  const [transcript, setTranscript] = useState<DelegatedTranscript | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const args = parseInput(tool.input);
  // sessions_spawn may omit agentId in its input when spawning a same-agent
  // worker. OpenClaw's accepted result still identifies the actual child.
  const agentName = shortAgentName(args.agentId ?? agentIdFromSessionKey(args.sessionKey ?? spawnedSessionKeyFromOutput(tool.output)));
  const taskPreview = toolDetail(truncateLine(args.task ?? '', 80), tool.summary, '');
  const agents = useChatStore((s) => s.agents);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const agentMatch = agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase());
  const agentColor = getAgentColor(agentName, (agentMatch as { color?: string } | undefined)?.color);
  const agentAvatar = (agentMatch as { avatar?: string } | undefined)?.avatar ?? '🤖';
  // El mirror ya conserva el enlace padre/hijo. Este botón no deriva ni
  // inventa una sesión: abre exclusivamente la transcripción hija que Core
  // devolvió dentro de la lista autorizada de conversaciones.
  const delegatedConversation = conversations.find((conversation) =>
    conversation.parent_conversation_id === activeConversationId
    && conversation.is_delegated
    && conversation.agent.toLowerCase() === agentName.toLowerCase(),
  );
  // El resultado de sessions_spawn llega antes que el watcher/mirror que crea
  // la conversación hija. Reconciliamos una vez desde la fuente canónica para
  // que el enlace "Ver trabajo" no dependa de que el socket haya emitido ese
  // evento concreto. No se reintenta en bucle ni se inventa una sesión local.
  useEffect(() => {
    // sessions_send (9.4) ya se resuelve contra la sesión canónica mediante
    // la fachada autorizada. No hay mirror hijo que esperar y recargar la
    // lista aquí puede reemplazar la tarjeta mientras el usuario la abre.
    if (nativeToolName !== 'sessions_send' && !delegatedConversation && activeConversationId && tool.status !== 'error') {
      void loadConversations();
    }
  }, [activeConversationId, delegatedConversation, loadConversations, nativeToolName, tool.id, tool.status]);
  const openDelegatedConversation = () => {
    if (!delegatedConversation) return;
    selectConversation(delegatedConversation.id);
    void loadMessages(delegatedConversation.id);
  };
  const loadNativeTranscript = async () => {
    if (!activeConversationId || !tool.id || nativeToolName !== 'sessions_send') return;
    setLoadingTranscript(true);
    setTranscriptError(null);
    try {
      const result = await api.get<{ data: DelegatedTranscript }>(
        `/conversations/threads/${activeConversationId}/delegations/${tool.id}`,
      );
      setTranscript(result.data);
    } catch {
      setTranscriptError('El historial del trabajo delegado todavía no está disponible.');
    } finally {
      setLoadingTranscript(false);
    }
  };
  const updateExpanded = (next: boolean) => {
    try {
      if (next) sessionStorage.setItem(expandedStorageKey, '1');
      else sessionStorage.removeItem(expandedStorageKey);
    } catch {
      // El almacenamiento puede no estar disponible en contextos embebidos.
    }
    setExpanded(next);
  };
  // El mensaje puede consolidarse (y remontar la tarjeta) mientras se pulsa
  // “Ver trabajo”. La preferencia persistida reabre la tarjeta y vuelve a
  // cargar su transcripción autorizada, sin depender del mirror legado.
  useEffect(() => {
    if (expanded && nativeToolName === 'sessions_send' && !transcript && !transcriptError && !loadingTranscript) {
      void loadNativeTranscript();
    }
  }, [activeConversationId, expanded, loadingTranscript, tool.id, nativeToolName, transcript, transcriptError]);

  const presentation = getToolPresentation(tool);
  const status = tool.status ?? 'success';
  const statusBadge =
    status === 'running' ? <Loader2 size={12} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} /> :
    status === 'error'   ? <span style={{ color: 'var(--error)', fontSize: '0.75rem' }}>❌</span> :
                            <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✅</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expandedRegionId}
        onClick={() => updateExpanded(!expanded)}
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
      {/* `sessions_send` en 9.4 delega al workspace canónico del agente. La
          transcripción es una acción primaria; la dejamos accesible incluso
          antes de desplegar metadatos para no ocultar el trabajo delegado. */}
      {!expanded && nativeToolName === 'sessions_send' && (
        <button
          type="button"
          onClick={() => {
            updateExpanded(true);
            void loadNativeTranscript();
          }}
          disabled={loadingTranscript}
          style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: '0.72rem' }}
        >
          {loadingTranscript ? 'Cargando trabajo…' : `Ver trabajo de ${agentName}`}
        </button>
      )}
      {expanded && (
        <div id={expandedRegionId} style={EXPANDED_BODY_STYLE}>
          <TechnicalDetails payload={presentation.technical} identity={presentation} regionId={`${expandedRegionId}-technical`} state={presentation.state} />
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
          {delegatedConversation ? (
            <button type="button" onClick={openDelegatedConversation} style={{ marginTop: 8, fontSize: '0.72rem' }}>
              Ver trabajo de {agentName}
            </button>
          ) : nativeToolName === 'sessions_send' ? (
            <>
              <button type="button" onClick={() => void loadNativeTranscript()} disabled={loadingTranscript} style={{ marginTop: 8, fontSize: '0.72rem' }}>
                {loadingTranscript ? 'Cargando trabajo…' : `Ver trabajo de ${agentName}`}
              </button>
              {transcriptError && <div style={{ marginTop: 7, color: 'var(--error)', fontSize: '0.7rem' }}>{transcriptError}</div>}
              {transcript && (
                <div aria-label={`Transcripción de ${agentName}`} style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 280, overflow: 'auto' }}>
                  {transcript.messages.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Aún no hay mensajes que mostrar.</div> : transcript.messages.map((message, index) => (
                    <div key={`${message.timestamp ?? 'message'}-${index}`} style={{ borderLeft: `2px solid ${message.role === 'assistant' ? agentColor : 'var(--text-muted)'}`, paddingLeft: 7, fontSize: '0.72rem' }}>
                      <strong>{message.role === 'assistant' ? agentName : 'Francis'}</strong>
                      <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-dim)', marginTop: 2 }}>{message.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              La transcripción aparecerá aquí cuando el mirror la reciba.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
