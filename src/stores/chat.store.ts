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

import { create } from 'zustand';
import { toast } from 'sonner';
import type { WsSendResult } from '@/types/websocket';

export type ChatSendResult =
  | { accepted: true; conversation_id: string }
  | { accepted: false; reason: 'not_connected' | 'send_failed' | 'streaming' | 'read_only' | 'invalid_input' };
import { mergeLedgerToolRecord, normalizeToolCallRecord, normalizeToolCallRecords } from '@/lib/tool-call-record';
import type { Message, MessageApproval, Conversation, Agent, ChatState, StreamingState, ChatAttachment, ToolExecution, ToolCallRecord, ToolRunState, BackgroundRunStatus } from '@/types/chat';
import { useWebSocketStore } from './websocket.store';
import { isKnownSlash } from '@/config/slash-commands';
import { api } from '@/services/api';
import { writeTtsChatState, type TtsChatState } from '@/hooks/use-tts-chat-state';

// A restore invalidates in-flight history reads as well as the displayed cache.
// Otherwise an older request can reinsert messages removed by the checkpoint.
const historyGenerations = new Map<string, number>();

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Map<string, Message[]>;
  /**
   * Per-conversation unread count. Incremented when a WS message
   * arrives for a conversation that is NOT the active one. Reset to 0
   * when the user selects that conversation. Lives only in memory —
   * resets on F5, which is acceptable for v1.
   */
  unreadByConv: Map<string, number>;
  streamingMessage: StreamingState | null;
  selectedAgent: string;
  pendingDraft: string | null;
  chatState: ChatState;
  bubbleMessage: Message | null;
  agents: Agent[];
  backgroundRuns: Map<string, BackgroundRunStatus>;

  sendMessage: (text: string, context?: Record<string, unknown>, attachments?: ChatAttachment[]) => ChatSendResult;
  startBackgroundConversation: (text: string, agent: string, attachments?: ChatAttachment[]) => ChatSendResult;
  cancelBackgroundConversation: (conversationId: string) => WsSendResult;
  setBackgroundRunStatus: (conversationId: string, status: BackgroundRunStatus) => void;
  setChatState: (state: ChatState) => void;
  selectAgent: (name: string) => void;
  setPendingDraft: (draft: string | null) => void;
  selectConversation: (id: string) => void;
  startNewConversation: () => void;
  setConversations: (conversations: Conversation[]) => void;
  setAgents: (agents: Agent[]) => void;
  /** G9: re-fetches `/managed-agents` and replaces the store's `agents`
   *  list. Used by AgentDetail after a PATCH so the AgentSelector pill,
   *  ChatMessage avatars and sidebar reflect the change immediately. */
  refreshAgents: () => Promise<void>;
  addMessage: (message: Message) => void;
  upsertLedgerMessage: (message: Message) => void;
  setStreamingMessage: (state: StreamingState | null) => void;
  setBubbleMessage: (message: Message | null) => void;
  appendStreamToken: (conversationId: string, token: string, type?: 'thinking' | 'text', runId?: string) => void;
  addToolEvent: (conversationId: string, event: Omit<Partial<ToolExecution>, 'id' | 'tool'> & { id: string; tool: string; status?: string; native_run_id?: string }) => void;
  cancelStream: () => WsSendResult;
  finalizeStream: (conversationId: string, fullText: string, model?: string, tokensUsed?: number, errorType?: string, serverToolCalls?: ToolCallRecord[], thinking?: string | null, ids?: { clientTempId?: string | null; userMessageId?: string | null; assistantMessageId?: string | null; errorDetail?: string | null; runId?: string | null }, ledgerMessages?: Array<{ id: string; text: string; tool_calls: ToolCallRecord[] | null; thinking: string | null; created_at: string }>) => void;
  /** Append a system message (slash-command confirmation) to a conversation. */
  addSystemMessage: (conversationId: string, text: string, command?: string | null, commandArgs?: string | null) => void;
  /** Clear all messages of a conversation in the dash (/clear). */
  clearConversationMessages: (conversationId: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  updateApprovalStatus: (approvalId: string, status: Exclude<MessageApproval['status'], 'pending'>, resolution?: MessageApproval['resolution']) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string, options?: { replace?: boolean }) => Promise<void>;
  recoverActiveToolRun: (conversationId: string) => Promise<void>;
}

const TOOL_STATE_RANK: Record<ToolRunState, number> = {
  pending: 0, running: 1, approval: 2, success: 3, empty: 3, error: 3,
};

function normalizeToolState(status: string | undefined): ToolRunState {
  if (status === 'completed') return 'success';
  if (status === 'pending' || status === 'running' || status === 'approval' || status === 'success' || status === 'empty' || status === 'error') return status;
  return 'running';
}

function monotonicToolState(previous: ToolRunState, incoming: ToolRunState): ToolRunState {
  // A transport/persistence failure may arrive after a provisional success.
  // Error is the authoritative terminal state and may upgrade any prior state.
  if (incoming === 'error') return 'error';
  if (TOOL_STATE_RANK[previous] === 3) return previous;
  return TOOL_STATE_RANK[incoming] >= TOOL_STATE_RANK[previous] ? incoming : previous;
}

function sameToolRun(a: Pick<ToolExecution, 'id' | 'run_id'>, b: Pick<ToolExecution, 'id' | 'run_id'>): boolean {
  return a.id === b.id && (!a.run_id || !b.run_id || a.run_id === b.run_id);
}

function mergeToolExecution(previous: ToolExecution, incoming: Partial<ToolExecution>): ToolExecution {
  const previousState = normalizeToolState(previous.status);
  const incomingState = normalizeToolState(typeof incoming.status === 'string' ? incoming.status : undefined);
  const status = monotonicToolState(previousState, incomingState);
  const incomingTool = incoming.tool;
  const canReplaceTool = !previous.tool || previous.tool === 'unknown' || previous.tool === 'tool';
  return {
    ...previous,
    ...incoming,
    tool: canReplaceTool && incomingTool ? incomingTool : previous.tool,
    status,
    text_offset: previous.text_offset ?? incoming.text_offset,
    sequence_index: previous.sequence_index ?? incoming.sequence_index,
    run_id: previous.run_id ?? incoming.run_id,
    started_at: previous.started_at ?? incoming.started_at,
    completed_at: incoming.completed_at ?? previous.completed_at,
    duration_ms: incoming.duration_ms ?? previous.duration_ms,
    input: incoming.input ?? previous.input,
    summary: previousState === 'error' && incomingState !== 'error' ? previous.summary : incoming.summary ?? previous.summary,
    // A stale frame must not erase a newer presentation/result.
    presentation: (previousState === 'error' && incomingState !== 'error') || (TOOL_STATE_RANK[previousState] === 3 && TOOL_STATE_RANK[incomingState] < 3)
      ? previous.presentation ?? incoming.presentation : incoming.presentation ?? previous.presentation,
    output: incoming.output ?? previous.output,
    output_present: previous.output_present === true || incoming.output_present === true ? true : incoming.output_present ?? previous.output_present,
    metadata: { ...previous.metadata, ...incoming.metadata },
    entity_refs: incoming.entity_refs ?? previous.entity_refs,
  };
}

function executionToRecord(tool: ToolExecution): ToolCallRecord {
  return {
    ...tool,
    status: normalizeToolState(tool.status),
    output: typeof tool.output === 'string' ? tool.output : tool.output != null ? JSON.stringify(tool.output) : undefined,
  };
}

function mergeFinalToolCalls(live: ToolExecution[], server: ToolCallRecord[] | undefined): ToolCallRecord[] | undefined {
  const merged = live.map(executionToRecord);
  for (const record of normalizeToolCallRecords(server)) {
    const index = merged.findIndex((current) => current.id === record.id && (!current.run_id || !record.run_id || current.run_id === record.run_id));
    if (index < 0) {
      merged.push(record);
      continue;
    }
    const previous = merged[index]!;
    const previousState = normalizeToolState(previous.status);
    const nextState = normalizeToolState(record.status);
    merged[index] = {
      ...previous,
      ...record,
      tool: previous.tool && previous.tool !== 'unknown' ? previous.tool : record.tool,
      status: monotonicToolState(previousState, nextState),
      text_offset: previous.text_offset ?? record.text_offset,
      sequence_index: previous.sequence_index ?? record.sequence_index,
      run_id: previous.run_id ?? record.run_id,
      started_at: previous.started_at ?? record.started_at,
      completed_at: record.completed_at ?? previous.completed_at,
      duration_ms: record.duration_ms ?? previous.duration_ms,
      input: record.input ?? previous.input,
      summary: previousState === 'error' && nextState !== 'error' ? previous.summary : record.summary ?? previous.summary,
      presentation: (previousState === 'error' && nextState !== 'error') || (TOOL_STATE_RANK[previousState] === 3 && TOOL_STATE_RANK[nextState] < 3)
        ? previous.presentation ?? record.presentation : record.presentation ?? previous.presentation,
      entity_refs: record.entity_refs ?? previous.entity_refs,
      output: record.output ?? previous.output,
      metadata: { ...previous.metadata, ...record.metadata },
      output_present: previous.output_present === true || record.output_present === true ? true : record.output_present ?? previous.output_present,
    };
  }
  return merged.length > 0 ? merged : undefined;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  pendingDraft: null,
  messages: new Map(),
  unreadByConv: new Map(),
  streamingMessage: null,
  selectedAgent: 'francis',
  chatState: 1,
  bubbleMessage: null,
  agents: [],
  backgroundRuns: new Map(),

  startBackgroundConversation: (text, agent, attachments) => {
    if (!text.trim() && !attachments?.length) return { accepted: false, reason: 'invalid_input' };
    const convId = crypto.randomUUID();
    const userMsg: Message = {
      id: crypto.randomUUID(), conversation_id: convId, role: 'user', content: text,
      timestamp: new Date().toISOString(), attachments: attachments?.length ? attachments : undefined,
      message_metadata: { background_chat: true },
    };
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: convId, agent, first_message: text, message_count: 1,
      created_at: now, updated_at: now, is_background: true,
    };
    const attachmentsMeta = attachments?.map(({ id, filename, mime_type, size_bytes, filepath }) => ({
      id, filename, mime_type, size_bytes, filepath,
    }));
    const result = useWebSocketStore.getState().send('chat.send', {
      agent, message: text, conversation_id: convId,
      attachments: attachmentsMeta ?? null,
      message_metadata: { background_chat: true },
      client_temp_id: userMsg.id,
    });
    if (!result.accepted) return result;
    set((state) => {
      const messages = new Map(state.messages);
      messages.set(convId, [userMsg]);
      const backgroundRuns = new Map(state.backgroundRuns);
      backgroundRuns.set(convId, 'queued');
      return { conversations: [conv, ...state.conversations], messages, backgroundRuns };
    });
    return { accepted: true, conversation_id: convId };
  },

  setBackgroundRunStatus: (conversationId, status) => set((state) => {
    const backgroundRuns = new Map(state.backgroundRuns);
    backgroundRuns.set(conversationId, status);
    return { backgroundRuns };
  }),

  cancelBackgroundConversation: (conversationId) => {
    const result = useWebSocketStore.getState().send('chat.cancel', { conversation_id: conversationId });
    if (result.accepted) get().setBackgroundRunStatus(conversationId, 'cancelled');
    else toast.warning('No se pudo enviar la cancelación al servidor.');
    return result;
  },

  sendMessage: (text: string, context?: Record<string, unknown>, attachments?: ChatAttachment[]) => {
    // Block sending while a stream is active — UNLESS the message is a known
    // slash command. Slash commands run on a separate dispatcher and must be
    // available during streaming (especially `/stop`, which aborts the run
    // currently in flight).
    if (!text.trim() && !attachments?.length) return { accepted: false, reason: 'invalid_input' };
    if (get().streamingMessage && !isKnownSlash(text)) return { accepted: false, reason: 'streaming' };

    const { activeConversationId, selectedAgent, messages, chatState, conversations } = get();
    const convId = activeConversationId ?? crypto.randomUUID();

    // `/tts chat <on|off|default>` round-trip: the backend dispatcher just
    // emits a system chip; the actual state lives in localStorage (the dash
    // is the TTS player for webchat sessions). Detect both header-button and
    // typed paths here so the local toggle is updated in parallel with the
    // WS send — the chip arriving later just confirms.
    const ttsChatMatch = /^\/tts\s+chat\s+(on|off|default)\s*$/i.exec(text.trim());


    // Resolve the correct agent: conversation's agent takes priority over selector
    const activeConv = activeConversationId
      ? conversations.find(c => c.id === activeConversationId)
      : null;

    // Conversación de TAREA DE AGENTE (Workboard "Trabajar ahora"): SOLO-LECTURA. El agente la
    // completa solo, sin intervención del usuario → se bloquea TODO envío (texto, voz, slash-menu,
    // /tts — todas esas vías pasan por aquí). Las approvals NO pasan por sendMessage, así que se
    // siguen pudiendo aprobar/rechazar. Punto único y seguro de gate.
    if (activeConv?.is_agent_task || activeConv?.read_only || activeConv?.is_heartbeat) return { accepted: false, reason: 'read_only' };
    // La ACL de colaboración es autoridad del Core, pero evitamos además que
    // una persona en solo lectura llegue a iniciar un turno optimista local.
    if (activeConv?.access === 'viewer') return { accepted: false, reason: 'read_only' };

    const agent = activeConv?.agent ?? selectedAgent;

    // G10: detect /btw or /side (OpenClaw native side-question commands) so
    // the bubble can be rendered with a "side" treatment. The command itself
    // goes through to the agent unchanged — OpenClaw intercepts it server-side
    // via auto-reply/reply/commands-btw.ts. We just tag the metadata so the
    // UI knows this turn is ephemeral and doesn't belong to the main task.
    const isSideQuestion = /^\s*\/(btw|side)\b/i.test(text);

    // G11: detect /steer — strip the prefix and set is_steer flag. Core will
    // abort the active run (if any) and start a new turn with the stripped
    // message. Equivalent to OpenClaw's `sessions.steer` RPC. If there's no
    // active stream, behaves as a regular send.
    const steerMatch = /^\s*\/steer\s+([\s\S]+)$/i.exec(text);
    const isSteer = !!steerMatch;
    const messageToSend = steerMatch ? (steerMatch[1] ?? '').trim() : text;
    // Skip silently if /steer was sent without a body (chat input may have a
    // race where the user hits enter before typing).
    if (isSteer && !messageToSend) return { accepted: false, reason: 'invalid_input' };

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString(),
      attachments: attachments?.length ? attachments : undefined,
      message_metadata: isSideQuestion ? { is_side_question: true } : undefined,
    };

    // Build attachment metadata for WS payload (without preview_url)
    const attachmentsMeta = attachments?.map(({ id, filename, mime_type, size_bytes, filepath }) => ({
      id, filename, mime_type, size_bytes, filepath,
    }));

    const isMock = import.meta.env.VITE_MOCK_API === 'true';
    const result: WsSendResult = isMock ? { accepted: true } :
      useWebSocketStore.getState().send('chat.send', {
        agent,
        message: messageToSend,
        conversation_id: convId,
        context: context ?? null,
        attachments: attachmentsMeta ?? null,
        // G10: forward side-question tag to Core so it persists in
        // agent_conversations.metadata and the assistant reply can be rendered
        // with the same "side" treatment on re-navigation.
        message_metadata: isSideQuestion ? { is_side_question: true } : null,
        // G11: when true, Core aborts the active run before starting the new
        // turn (functional equivalent of OpenClaw's sessions.steer RPC).
        is_steer: isSteer || undefined,
        // Echoed back by Core in `chat.stream.done` as `client_temp_id`.
        // `finalizeStream` uses it to find this local user message and
        // rewrite its id to the DB-assigned one, so `loadMessages` dedup
        // by id Just Works on re-navigation.
        client_temp_id: userMsg.id,
      });
    if (!result.accepted) return result;
    if (ttsChatMatch) writeTtsChatState(convId, ttsChatMatch[1]!.toLowerCase() as TtsChatState);
    // Auto-expand chat panel when sending from collapsed state (any module)
    if (chatState === 1) {
      set({ chatState: 2 });
    }

    if (!activeConversationId) {
      set({ activeConversationId: convId });
      const conv: Conversation = {
        id: convId,
        agent,
        first_message: text, // raw (with /steer prefix if any) — purely cosmetic for the sidebar
        message_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((s) => ({ conversations: [conv, ...s.conversations] }));
    }

    const existing = messages.get(convId) ?? [];
    const updated = new Map(messages);
    updated.set(convId, [...existing, userMsg]);
    set({ messages: updated });

    if (isMock) simulateMockStreaming(convId, text, get, set);
    return { accepted: true, conversation_id: convId };
  },

  setChatState: (chatState: ChatState) => set({ chatState }),

  selectAgent: (name: string) => set({ selectedAgent: name }),
  setPendingDraft: (pendingDraft: string | null) => set({ pendingDraft }),

  selectConversation: (id: string) => {
    const conv = get().conversations.find(c => c.id === id);
    set((state) => {
      const unread = new Map(state.unreadByConv);
      unread.delete(id);
      return {
        activeConversationId: id,
        selectedAgent: conv?.agent ?? state.selectedAgent,
        unreadByConv: unread,
      };
    });
  },

  startNewConversation: () => set({ activeConversationId: null }),

  setConversations: (conversations: Conversation[]) => set({ conversations }),

  setAgents: (agents: Agent[]) => set({ agents }),
  refreshAgents: async () => {
    try {
      type ManagedAgentResponse = {
        name: string; display_name: string; role: string; model: string;
        skills: string[]; avatar?: string | null; color: string;
      };
      const res = await api.get<{ data: ManagedAgentResponse[] }>('/managed-agents');
      const mapped: Agent[] = res.data.map(a => ({
        name: a.name,
        display_name: a.display_name,
        role: a.role,
        model: a.model,
        skills_count: Array.isArray(a.skills) ? a.skills.length : 0,
        avatar: a.avatar ?? undefined,
        color: a.color,
      }));
      set({ agents: mapped });
    } catch { /* silent — store keeps old list */ }
  },

  upsertLedgerMessage: (message: Message) => {
    const current = get().messages.get(message.conversation_id) ?? [];
    const existing = current.find(row => row.id === message.id);
    if (message.role !== 'assistant' || existing && existing.role !== 'assistant') return;
    // Invalidate history reads started before this committed snapshot.
    historyGenerations.set(message.conversation_id, (historyGenerations.get(message.conversation_id) ?? 0) + 1);
    if (!existing) { get().addMessage(message); return; }
    set(state => {
      const rows = state.messages.get(message.conversation_id) ?? [];
      const previous = rows.find(row => row.id === message.id);
      if (!previous) return state;
      const tools = [...(previous.tool_calls ?? [])];
      for (const incoming of message.tool_calls ?? []) {
        const index = tools.findIndex(tool => tool.id === incoming.id);
        if (index < 0) tools.push(incoming);
        else tools[index] = mergeLedgerToolRecord(tools[index]!, incoming);
      }
      const updated = new Map(state.messages);
      updated.set(message.conversation_id, rows.map(row => row.id !== message.id ? row : {
        ...previous, ...message, content: message.content || previous.content,
        thinking: message.thinking ?? previous.thinking, tool_calls: tools,
      }));
      return { messages: updated };
    });
  },

  addMessage: (message: Message) => {
    set((state) => {
      const updated = new Map(state.messages);
      const existing = updated.get(message.conversation_id) ?? [];
      // Dedup by id: WS push + history fetch can deliver the same row twice.
      if (existing.some((m) => m.id === message.id)) return state;
      updated.set(message.conversation_id, [...existing, message]);

      // Bump unread counter when the new message is for a conversation
      // the user isn't currently viewing. Skip if it's the user's own
      // message (role=user) — that comes from chat-bridge upfront on
      // the active conv and we don't want to mark our own typing.
      let unread = state.unreadByConv;
      if (
        message.conversation_id !== state.activeConversationId &&
        message.role === 'assistant'
      ) {
        unread = new Map(state.unreadByConv);
        unread.set(message.conversation_id, (unread.get(message.conversation_id) ?? 0) + 1);
      }

      return { messages: updated, unreadByConv: unread };
    });
  },

  addSystemMessage: (conversationId: string, text: string, command?: string | null, commandArgs?: string | null) => {
    set((state) => {
      const updated = new Map(state.messages);
      const existing = updated.get(conversationId) ?? [];
      const sysMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: 'system',
        content: text,
        timestamp: new Date().toISOString(),
        ...(command ? { message_metadata: { command, command_args: commandArgs ?? null } } : {}),
      };
      updated.set(conversationId, [...existing, sysMsg]);
      return { messages: updated };
    });
  },

  clearConversationMessages: (conversationId: string) => {
    set((state) => {
      const updated = new Map(state.messages);
      updated.set(conversationId, []);
      return { messages: updated };
    });
  },

  setStreamingMessage: (streamingMessage: StreamingState | null) => set({ streamingMessage }),

  setBubbleMessage: (bubbleMessage: Message | null) => set({ bubbleMessage }),

  appendStreamToken: (conversationId: string, token: string, type?: 'thinking' | 'text', runId?: string) => {
    set((state) => {
      // Guard por conversación: con entrega conversation-scoped (a todas las
      // pestañas del usuario) pueden llegar tokens de OTRA conversación en curso;
      // sin esto se mezclarían en el único slot streamingMessage (cross-talk).
      // Igual que addToolEvent. Si el slot es de otra conv, lo ignoramos (su
      // mensaje final llega por done + loadMessages).
      if (state.streamingMessage && state.streamingMessage.conversationId !== conversationId) return {};
      if (state.streamingMessage?.runId && runId && state.streamingMessage.runId !== runId) return {};
      const current = state.streamingMessage ?? { conversationId, runId, tokens: '', thinking: '', isThinking: false, tools: [] };
      const withRun = current.runId ? current : { ...current, runId };
      if (type === 'thinking') {
        return { streamingMessage: { ...withRun, conversationId, thinking: current.thinking + token, isThinking: true } };
      }
      // Regular text token — mark thinking as done
      return { streamingMessage: { ...withRun, conversationId, tokens: current.tokens + token, isThinking: false } };
    });
  },

  addToolEvent: (conversationId: string, event) => {
    const streamRunId = event.run_id;
    event = { ...event, ...normalizeToolCallRecord({ ...event, run_id: event.native_run_id }) };
    set((state) => {
      const current = state.streamingMessage ?? (state.activeConversationId === conversationId
        ? { conversationId, runId: streamRunId, tokens: '', thinking: '', isThinking: false, tools: [] }
        : null);
      if (!current || current.conversationId !== conversationId) return {};
      if (current.runId && streamRunId && current.runId !== streamRunId) return {};
      const tools = [...current.tools];
      const existing = tools.findIndex((tool) => sameToolRun(tool, event));
      const prev = existing >= 0 ? tools[existing] : undefined;
      if (prev) {
        tools[existing] = mergeToolExecution(prev, event);
      } else {
        const nextSequence = tools.reduce((max, tool) => Math.max(max, tool.sequence_index ?? -1), -1) + 1;
        tools.push({
          ...event,
          id: event.id,
          tool: event.tool,
          status: normalizeToolState(event.status),
          summary: event.summary ?? '',
          // Core's logical text offset is authoritative. Legacy frames without
          // one remain offset-less and render at the end; the paced text shown
          // by Dash must never define protocol ordering.
          text_offset: event.text_offset,
          sequence_index: event.sequence_index ?? nextSequence,
        } as ToolExecution);
      }
      return { streamingMessage: { ...current, tools } };
    });
  },

  cancelStream: () => {
    const sm = get().streamingMessage;
    if (!sm) return { accepted: false, reason: 'not_connected' };
    // Tell the server to abort the in-flight Gateway RPC.
    const result = useWebSocketStore.getState().send('chat.cancel', { conversation_id: sm.conversationId });
    if (!result.accepted) toast.warning('Se detuvo la vista local; no se pudo enviar la cancelación al servidor.');
    // Optimistically clear local streaming state so the user gets immediate
    // feedback. If the server lost the WS event or already completed mid-flight,
    // we'd otherwise sit on "Processing..." forever waiting for chat.stream.done.
    set({ streamingMessage: null });
    return result;
  },

  deleteConversation: (id: string) => {
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      const messages = new Map(state.messages);
      messages.delete(id);
      return {
        conversations,
        messages,
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
      };
    });
    // Persist deletion to backend
    const isMock = import.meta.env.VITE_MOCK_API === 'true';
    if (!isMock) {
      void api.delete(`/conversations/threads/${id}`).catch((err: unknown) => {
        console.error('[chat] Failed to delete conversation:', err);
      });
    }
  },

  renameConversation: (id: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, first_message: title } : c,
      ),
    }));
  },

  updateApprovalStatus: (approvalId: string, status: Exclude<MessageApproval['status'], 'pending'>, resolution?: MessageApproval['resolution']) => {
    set((state) => {
      const updated = new Map(state.messages);
      for (const [convId, msgs] of updated) {
        const changed = msgs.map((m) =>
          m.approval && m.approval.id === approvalId
            ? { ...m, approval: { ...m.approval, status, ...(resolution ? { resolution } : {}) } }
            : m,
        );
        updated.set(convId, changed);
      }
      return { messages: updated };
    });
  },

  loadConversations: async () => {
    try {
      const res = await api.get<{ data: Array<{
        conversation_id: string;
        first_message: string;
        agent: string;
        type: string;
        message_count: number;
        last_message_at: string;
        created_at: string;
        session_id: string | null;
        is_agent_task?: boolean;
        is_delegated?: boolean;
        is_heartbeat?: boolean;
        is_background?: boolean;
        workboard_card_title?: string | null;
        parent_conversation_id?: string | null;
        access?: 'owner' | 'viewer' | 'participant' | 'admin';
        owner?: { user_id: string; display_name: string; avatar_url?: string | null } | null;
        participants?: Array<{ user_id: string; display_name: string; avatar_url?: string |null }>;
      }> }>('/conversations/threads', { limit: 100 });

      const conversations: Conversation[] = (res.data ?? []).map((t) => ({
        id: t.conversation_id,
        agent: t.agent ?? 'francis',
        first_message: t.first_message ?? '',
        message_count: t.message_count,
        created_at: t.created_at,
        updated_at: t.last_message_at ?? t.created_at,
        session_id: t.session_id ?? null,
        is_agent_task: t.is_agent_task ?? false,
        is_delegated: t.is_delegated ?? false,
        is_heartbeat: t.is_heartbeat ?? false,
        is_background: t.is_background ?? false,
        read_only: t.is_heartbeat ?? false,
        workboard_card_title: t.workboard_card_title ?? null,
        parent_conversation_id: t.parent_conversation_id ?? null,
        access: t.access,
        owner: t.owner ?? null,
        participants: t.participants ?? [],
      }));

      // Preserve local-only conversations the server hasn't surfaced yet.
      // The user message is persisted fire-and-forget (no await) in sendMessage,
      // so a concurrent loadConversations (e.g. triggered by chat.subagent_message
      // when the agent spawns/delegates) can race AHEAD of the DB commit and return
      // a list WITHOUT the just-created conversation. A blind `set({ conversations })`
      // then wipes the optimistic sidebar card → the chat the user just opened
      // "disappears" and can't be reopened (selectConversation doesn't refetch).
      // Mirror loadMessages' merge: keep any local conv (esp. the active one) that
      // the server response is missing, newest-first.
      set((state) => {
        const serverIds = new Set(conversations.map((c) => c.id));
        const localOnly = state.conversations.filter((c) => !serverIds.has(c.id));
        const backgroundRuns = new Map(state.backgroundRuns);
        for (const conversation of conversations) {
          if (!conversation.is_background || backgroundRuns.has(conversation.id)) continue;
          backgroundRuns.set(conversation.id, conversation.message_count <= 1 ? 'running' : 'completed');
        }
        return { conversations: [...localOnly, ...conversations], backgroundRuns };
      });
    } catch (err) {
      console.error('[chat] Failed to load conversations:', err);
    }
  },

  loadMessages: async (conversationId: string, options?: { replace?: boolean }) => {
    if (options?.replace) historyGenerations.set(conversationId, (historyGenerations.get(conversationId) ?? 0) + 1);
    const generation = historyGenerations.get(conversationId) ?? 0;
    const beforeReplace = options?.replace
      ? new Set((get().messages.get(conversationId) ?? []).map(message => message.id))
      : null;
    // Always refetch on conversation switch. The previous "skip if we have
    // anything" was unsafe: if the WS `chat.post_yield_message` was missed
    // (transient socket reconnect, dash hidden tab, etc.), the local store
    // would only contain the user message — and we'd never recover the
    // assistant reply that lives in DB. Refetch is cheap (~5-10ms on
    // localhost) and the merge below preserves any in-flight local state.
    try {
      const res = await api.get<{ data: Array<{
        id: string;
        role: string;
        type?: string;
        message: string;
        thinking?: string | null;
        from_agent: string;
        to_agent?: string | null;
        model_used: string | null;
        tokens_used: number | null;
        tool_calls?: unknown;
        metadata?: Record<string, unknown> | null;
        created_at: string;
        conversation_id: string;
        author?: { kind: 'human'; id: string; display_name: string; avatar_url?: string | null };
      }> }>(`/conversations/threads/${conversationId}`);

      if ((historyGenerations.get(conversationId) ?? 0) !== generation) return;
      const msgs: Message[] = (res.data ?? []).map((m) => {
        // Backend returns tool_calls as jsonb (Drizzle gives us back
        // the array). It's the persisted ToolCallRecord shape but
        // typed as `unknown`. Be defensive.
        const toolCalls = normalizeToolCallRecords(m.tool_calls);
        return {
          id: m.id,
          conversation_id: conversationId,
          role: m.role as 'user' | 'assistant',
          content: m.message,
          agent: m.role === 'assistant' ? m.from_agent : undefined,
          model: m.model_used ?? undefined,
          tokens_used: m.tokens_used ?? undefined,
          timestamp: m.created_at,
          tool_calls: toolCalls,
          thinking: typeof m.thinking === 'string' && m.thinking.length > 0 ? m.thinking : null,
          message_metadata: {
            ...((m.metadata && typeof m.metadata === 'object') ? m.metadata : {}),
            ...(m.type === 'delegation' ? { delegated: true, delegated_from_agent: m.from_agent, delegated_to_agent: m.to_agent ?? null } : {}),
          },
          author: m.author,
          // Rehidratar adjuntos persistidos en metadata (Core los guarda en la fila user)
          // para que se vean al recargar/abrir la conversación, no solo optimistas al enviar.
          attachments: Array.isArray((m.metadata as Record<string, unknown> | undefined)?.attachments)
            ? ((m.metadata as { attachments: ChatAttachment[] }).attachments)
            : undefined,
        };
      });

      set((state) => {
        const updated = new Map(state.messages);
        // Merge: DB wins for known ids. Local-only msgs (just-sent user msg
        // not yet flushed, or assistant msg materialised by finalizeStream)
        // are preserved at the tail, then sorted by timestamp.
        //
        // Dedup por id Y por fingerprint. El id es primario (el backend hace
        // echo de client_temp_id/user_message_id/assistant_message_id y
        // finalizeStream reescribe el id local→DB). PERO si el `done` se perdió
        // (p.ej. navegaste fuera del chat antes de este fix global), el id local
        // temp NUNCA se reescribió → quedaría como "local-only" y se duplicaría
        // con la fila DB al reconciliar. El fingerprint (role + contenido
        // normalizado + ventana temporal ±120s) colapsa ese huérfano contra la
        // fila DB. La ventana evita borrar dos mensajes idénticos legítimos
        // enviados con minutos de diferencia.
        // Approvals are not part of the rewound transcript. Also preserve
        // messages genuinely received after this authoritative GET began.
        const existing = (state.messages.get(conversationId) ?? []).filter(message =>
          !beforeReplace || !!message.approval || !beforeReplace.has(message.id));
        const dbIds = new Set(msgs.map((m) => m.id));
        const normContent = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();
        const FINGERPRINT_WINDOW_MS = 120_000;
        const dbPrints = msgs.map((m) => ({
          role: m.role,
          content: normContent(m.content),
          t: new Date(m.timestamp).getTime(),
        }));
        const localOnly = existing.filter((m) => {
          if (dbIds.has(m.id)) return false; // ya presente por id
          if (m.approval) return true; // independent of transcript/tool-only fingerprints
          const mc = normContent(m.content);
          const mt = new Date(m.timestamp).getTime();
          const dup = dbPrints.some(
            (p) => p.role === m.role && p.content === mc && Math.abs(p.t - mt) < FINGERPRINT_WINDOW_MS,
          );
          return !dup; // descarta el optimista temp que ya está en DB con otro id
        });
        const merged = [...msgs, ...localOnly].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        updated.set(conversationId, merged);
        return { messages: updated };
      });

      // Rehidratar tarjetas de aprobación PENDIENTES de esta conv (2026-07-16):
      // la tarjeta inline solo se pintaba con el WS `approval.new` en el momento
      // de crearse — si no estabas mirando ESTA conversación justo entonces (o
      // recargaste después), no había forma de verla y expiraba en silencio con
      // el agente esperando para siempre (conv 43eb4f75). `addMessage` dedupea
      // por id (`approval-<id>`) → cero duplicado con la tarjeta viva. Las
      // resueltas/expiradas no se rehidratan (no son accionables).
      void import('../services/approvals.service').then(async ({ listPendingApprovals }) => {
        const pending = await listPendingApprovals();
        if ((historyGenerations.get(conversationId) ?? 0) !== generation) return;
        for (const a of pending) {
          if (a.conversation_id !== conversationId) continue;
          get().addMessage({
            id: `approval-${a.id}`,
            conversation_id: conversationId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            approval: {
              id: a.id,
              operation: a.operation,
              summary: a.summary,
              level: a.level,
              expires_at: a.expires_at,
              status: 'pending',
              source: a.source,
              authority: a.authority,
              risk: a.risk,
              core_level: a.core_level,
              allowed_decisions: a.allowed_decisions,
              resolution: a.resolution,
              presentation: a.presentation,
            },
          });
        }
      }).catch(() => { /* best-effort — la tarjeta viva sigue llegando por WS */ });
    } catch (err) {
      console.error('[chat] Failed to load messages:', err);
    }
  },

  recoverActiveToolRun: async (conversationId: string) => {
    try {
      const response = await api.get<{ data: null | {
        conversation_id: string;
        run_id: string;
        text: string;
        thinking: string;
        tools: ToolCallRecord[];
        captured_at: string;
      } }>(`/conversations/${conversationId}/tool-runs/active`);
      const snapshot = response.data;
      if (!snapshot || snapshot.conversation_id !== conversationId) return;
      set((state) => {
        const current = state.streamingMessage;
        const incomingTools = normalizeToolCallRecords(snapshot.tools).map((tool) => ({
          ...tool,
          status: normalizeToolState(tool.status),
          summary: tool.summary ?? '',
        } as ToolExecution));
        if (!current || current.conversationId !== conversationId || (current.runId && current.runId !== snapshot.run_id)) {
          return { streamingMessage: {
            conversationId,
            runId: snapshot.run_id,
            capturedAt: snapshot.captured_at,
            tokens: snapshot.text,
            thinking: snapshot.thinking,
            isThinking: !!snapshot.thinking && !snapshot.text,
            tools: incomingTools,
          } };
        }
        const merged = [...current.tools];
        for (const incoming of incomingTools) {
          const index = merged.findIndex((tool) => sameToolRun(tool, incoming));
          if (index >= 0) merged[index] = mergeToolExecution(merged[index]!, incoming);
          else merged.push(incoming);
        }
        return { streamingMessage: {
          ...current,
          runId: snapshot.run_id,
          capturedAt: snapshot.captured_at,
          // Snapshot is authoritative for logical text/thinking of this run.
          tokens: snapshot.text,
          thinking: snapshot.thinking,
          isThinking: !!snapshot.thinking && !snapshot.text,
          tools: merged,
        } };
      });
    } catch {
      // Recovery is best-effort. Normal live frames and persisted history remain available.
    }
  },

  finalizeStream: (conversationId: string, fullText: string, model?: string, tokensUsed?: number, errorType?: string, serverToolCalls?: ToolCallRecord[], thinking?: string | null, ids?: { clientTempId?: string | null; userMessageId?: string | null; assistantMessageId?: string | null; errorDetail?: string | null; runId?: string | null }, ledgerMessages?: Array<{ id: string; text: string; tool_calls: ToolCallRecord[] | null; thinking: string | null; created_at: string }>) => {
    const activeRun = get().streamingMessage;
    if (activeRun && activeRun.conversationId !== conversationId) return;
    if (activeRun?.runId && ids?.runId && activeRun.runId !== ids.runId) return;
    // ── MODO LEDGER (Webchat Session Ledger): el done trae las filas
    // per-message REALES del turno (ids de DB) — sustituyen a la burbuja
    // streaming en el mismo set() (cero flicker) y el dedup por id de
    // loadMessages/addMessage funciona sin fingerprint. Una fila por mensaje
    // del agente, como la UI nativa de OpenClaw.
    if (ledgerMessages && ledgerMessages.length > 0) {
      // Discard any history GET that began before these committed snapshots.
      historyGenerations.set(conversationId, (historyGenerations.get(conversationId) ?? 0) + 1);
      const conv = get().conversations.find(c => c.id === conversationId);
      const agent = conv?.agent ?? get().selectedAgent;
      set((state) => {
        const updated = new Map(state.messages);
        const existing = updated.get(conversationId) ?? [];
        // Reescritura del id optimista del user (igual que el camino legacy).
        let next = existing;
        if (ids?.clientTempId && ids?.userMessageId && ids.clientTempId !== ids.userMessageId) {
          next = existing.map((m) => (m.id === ids.clientTempId ? { ...m, id: ids.userMessageId! } : m));
        }
        const rows: Message[] = ledgerMessages
          .map((r) => {
            const previous = next.find(message => message.id === r.id);
            return {
            ...previous,
            id: r.id,
            conversation_id: conversationId,
            role: 'assistant' as const,
            content: r.text,
            agent,
            model,
            timestamp: r.created_at,
            tool_calls: mergeFinalToolCalls((previous?.tool_calls ?? []).map(tool => ({ ...tool, summary: tool.summary ?? '', status: normalizeToolState(tool.status) })), normalizeToolCallRecords(r.tool_calls)),
            thinking: r.thinking,
          }; });
        const confirmed = new Map(rows.map(row => [row.id, row]));
        updated.set(conversationId, [...next.map(message => confirmed.get(message.id) ?? message), ...rows.filter(row => !next.some(message => message.id === row.id))]);
        const lastText = ledgerMessages[ledgerMessages.length - 1]?.text ?? '';
        const isShort = lastText.split('\n').length <= 3 && !lastText.includes('```');
        const shouldBubble = state.chatState === 1 && isShort && rows.length > 0;
        return {
          messages: updated,
          streamingMessage: null,
          bubbleMessage: shouldBubble ? rows[rows.length - 1] : null,
          chatState: state.chatState === 1 && !isShort ? 2 : state.chatState,
        };
      });
      // Refresh after done to remove consolidated orphan rows. The newer
      // generation prevents a pre-done GET from restoring stale I/O or rows.
      void get().loadMessages(conversationId, { replace: true });
      return;
    }
    const isYielded = model === 'yielded';
    // Yield with empty text → keep a placeholder bubble so the user
    // knows the agent is awaiting sub-agents (it's NOT a failure).
    // Cleared when the actual reply arrives via `chat.post_yield_message`.
    if (isYielded && !fullText.trim()) {
      set({
        streamingMessage: {
          conversationId,
          tokens: '🔄 Esperando respuesta de sub-agentes…',
          thinking: '',
          isThinking: false,
          tools: [],
        },
      });
      return;
    }
    // Skip adding an empty assistant message — happens for non-yield
    // empty completions (rare; defensive).
    if (!fullText.trim() && !errorType) {
      set({ streamingMessage: null });
      return;
    }
    const conv = get().conversations.find(c => c.id === conversationId);
    // Server sends tool_calls in stream.done (includes JSONL-extracted internal
    // tools like sessions_spawn that never fire onToolEvent). Use those when
    // available; fall back to whatever was captured during streaming.
    const streamingTools = get().streamingMessage?.tools ?? [];
    const persistedToolCalls = mergeFinalToolCalls(streamingTools, serverToolCalls);
    // Reasoning persisted to DB when visibility != 'off'. Prefer the
    // server-confirmed value from chat.stream.done; fall back to whatever
    // we accumulated locally during streaming.
    const streamingThinking = get().streamingMessage?.thinking;
    const finalThinking = thinking ?? (streamingThinking && streamingThinking.length > 0 ? streamingThinking : null);

    // Backend echoes DB-assigned ids in `chat.stream.done` so the next
    // `loadMessages` dedup-by-id works without falling back to the content
    // fingerprint. If they're missing (mock mode, error path with no
    // persisted row, …) keep the local UUID as fallback.
    const assistantMsg: Message = {
      id: ids?.assistantMessageId ?? crypto.randomUUID(),
      conversation_id: conversationId,
      role: 'assistant',
      content: fullText,
      agent: conv?.agent ?? get().selectedAgent,
      model,
      tokens_used: tokensUsed,
      error_type: errorType,
      error_detail: ids?.errorDetail ?? null,
      timestamp: new Date().toISOString(),
      tool_calls: persistedToolCalls,
      thinking: finalThinking,
    };

    set((state) => {
      const updated = new Map(state.messages);
      const existing = updated.get(conversationId) ?? [];
      // Rewrite the matching local user message id from the temp UUID we
      // sent in `client_temp_id` to the DB-assigned `user_message_id`.
      // Without this the user row appears twice after the next refetch
      // (local UUID never matches the DB one).
      let nextExisting = existing;
      if (ids?.clientTempId && ids?.userMessageId && ids.clientTempId !== ids.userMessageId) {
        nextExisting = existing.map((m) =>
          m.id === ids.clientTempId ? { ...m, id: ids.userMessageId! } : m,
        );
      }
      updated.set(conversationId, [...nextExisting, assistantMsg]);

      const isShort = fullText.split('\n').length <= 3 && !fullText.includes('```');
      const shouldBubble = state.chatState === 1 && isShort;

      return {
        messages: updated,
        streamingMessage: null,
        bubbleMessage: shouldBubble ? assistantMsg : null,
        chatState: state.chatState === 1 && !isShort ? 2 : state.chatState,
      };
    });
  },
}));

/* -------------------------------------------------------------------------- */
/*  Mock streaming simulation                                                 */
/* -------------------------------------------------------------------------- */

const MOCK_RESPONSES = [
  "I found the information you were looking for. Here's a quick summary:\n\n**Key points:**\n- The latest data shows positive trends across all metrics\n- Revenue is up 12% compared to last quarter\n- Customer satisfaction scores remain high at 4.6/5\n\nWould you like me to dive deeper into any of these areas?",
  "Sure, let me help with that. Here's what I can see:\n\nThe calendar shows 3 meetings today:\n1. **Team Standup** at 9:00 AM\n2. **Project Review** at 2:00 PM\n3. **1:1 with Sarah** at 4:30 PM\n\nYou also have 2 pending emails that might need attention before the project review.",
  "I've analyzed the data and here are my findings:\n\n```typescript\nconst summary = {\n  totalExpenses: 45230,\n  overBudget: true,\n  mainAreas: ['infrastructure', 'contractors'],\n};\n```\n\nThe main overspend areas are cloud infrastructure (+€3,200) and contractor fees (+€2,100). I'd recommend reviewing the contractor agreements first.",
  "Great question! Let me break this down:\n\n> The best approach depends on your specific requirements and constraints.\n\nHere are the options:\n\n| Approach | Pros | Cons |\n|----------|------|------|\n| Option A | Fast, simple | Less flexible |\n| Option B | Flexible | More complex |\n| Option C | Scalable | Higher cost |\n\nI'd recommend **Option B** for your use case. Want me to elaborate?",
];

function simulateMockStreaming(
  convId: string,
  _userText: string,
  get: () => ChatStore,
  set: (fn: (s: ChatStore) => Partial<ChatStore>) => void,
) {
  const fullText = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]!;
  const words = fullText.split(' ');
  let accumulated = '';

  // Start streaming after a small delay
  setTimeout(() => {
    set(() => ({ streamingMessage: { conversationId: convId, tokens: '', thinking: '', isThinking: false, tools: [] } }));

    let i = 0;
    const interval = setInterval(() => {
      if (i >= words.length) {
        clearInterval(interval);
        get().finalizeStream(convId, fullText, 'claude-opus-4-6', words.length * 2);
        return;
      }
      accumulated += (accumulated ? ' ' : '') + words[i];
      set(() => ({ streamingMessage: { conversationId: convId, tokens: accumulated, thinking: '', isThinking: false, tools: [] } }));
      i++;
    }, 20 + Math.random() * 15);
  }, 500);
}
