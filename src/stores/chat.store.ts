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
import type { Message, Conversation, Agent, ChatState, StreamingState, ChatAttachment, ToolExecution } from '@/types/chat';
import { useWebSocketStore } from './websocket.store';
import { api } from '@/services/api';

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
  chatState: ChatState;
  bubbleMessage: Message | null;
  agents: Agent[];

  sendMessage: (text: string, context?: Record<string, unknown>, attachments?: ChatAttachment[]) => void;
  setChatState: (state: ChatState) => void;
  selectAgent: (name: string) => void;
  selectConversation: (id: string) => void;
  startNewConversation: () => void;
  setConversations: (conversations: Conversation[]) => void;
  setAgents: (agents: Agent[]) => void;
  addMessage: (message: Message) => void;
  setStreamingMessage: (state: StreamingState | null) => void;
  setBubbleMessage: (message: Message | null) => void;
  appendStreamToken: (conversationId: string, token: string, type?: 'thinking' | 'text') => void;
  addToolEvent: (conversationId: string, event: { id: string; tool: string; status: string; summary: string; input?: string; output?: string }) => void;
  cancelStream: () => void;
  finalizeStream: (conversationId: string, fullText: string, model?: string, tokensUsed?: number, errorType?: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  updateApprovalStatus: (approvalId: string, status: 'approved' | 'rejected' | 'expired') => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: new Map(),
  unreadByConv: new Map(),
  streamingMessage: null,
  selectedAgent: 'main',
  chatState: 1,
  bubbleMessage: null,
  agents: [],

  sendMessage: (text: string, context?: Record<string, unknown>, attachments?: ChatAttachment[]) => {
    // Block sending while a stream is active
    if (get().streamingMessage) return;

    const { activeConversationId, selectedAgent, messages, chatState, conversations } = get();
    const convId = activeConversationId ?? crypto.randomUUID();

    // Resolve the correct agent: conversation's agent takes priority over selector
    const activeConv = activeConversationId
      ? conversations.find(c => c.id === activeConversationId)
      : null;
    const agent = activeConv?.agent ?? selectedAgent;

    // Auto-expand chat panel when sending from collapsed state (any module)
    if (chatState === 1) {
      set({ chatState: 2 });
    }

    if (!activeConversationId) {
      set({ activeConversationId: convId });
      const conv: Conversation = {
        id: convId,
        agent,
        first_message: text,
        message_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((s) => ({ conversations: [conv, ...s.conversations] }));
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      attachments: attachments?.length ? attachments : undefined,
    };

    const existing = messages.get(convId) ?? [];
    const updated = new Map(messages);
    updated.set(convId, [...existing, userMsg]);
    set({ messages: updated });

    // Build attachment metadata for WS payload (without preview_url)
    const attachmentsMeta = attachments?.map(({ id, filename, mime_type, size_bytes, filepath }) => ({
      id, filename, mime_type, size_bytes, filepath,
    }));

    // In mock mode, simulate a streaming response
    const isMock = import.meta.env.VITE_MOCK_API === 'true';
    if (isMock) {
      simulateMockStreaming(convId, text, get, set);
    } else {
      useWebSocketStore.getState().send('chat.send', {
        agent,
        message: text,
        conversation_id: convId,
        context: context ?? null,
        attachments: attachmentsMeta ?? null,
      });
    }
  },

  setChatState: (chatState: ChatState) => set({ chatState }),

  selectAgent: (name: string) => set({ selectedAgent: name }),

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

  setStreamingMessage: (streamingMessage: StreamingState | null) => set({ streamingMessage }),

  setBubbleMessage: (bubbleMessage: Message | null) => set({ bubbleMessage }),

  appendStreamToken: (conversationId: string, token: string, type?: 'thinking' | 'text') => {
    set((state) => {
      const current = state.streamingMessage ?? { conversationId, tokens: '', thinking: '', isThinking: false, tools: [] };
      if (type === 'thinking') {
        return { streamingMessage: { ...current, conversationId, thinking: current.thinking + token, isThinking: true } };
      }
      // Regular text token — mark thinking as done
      return { streamingMessage: { ...current, conversationId, tokens: current.tokens + token, isThinking: false } };
    });
  },

  addToolEvent: (conversationId: string, event) => {
    set((state) => {
      const current = state.streamingMessage;
      if (!current || current.conversationId !== conversationId) return {};
      const tools = [...current.tools];
      const existing = tools.findIndex(t => t.id === event.id);
      if (existing >= 0) {
        tools[existing] = { ...tools[existing], ...event } as ToolExecution;
      } else {
        tools.push(event as ToolExecution);
      }
      return { streamingMessage: { ...current, tools } };
    });
  },

  cancelStream: () => {
    const sm = get().streamingMessage;
    if (!sm) return;
    // Tell the server to abort the in-flight Gateway RPC.
    useWebSocketStore.getState().send('chat.cancel', { conversation_id: sm.conversationId });
    // Optimistically clear local streaming state so the user gets immediate
    // feedback. If the server lost the WS event or already completed mid-flight,
    // we'd otherwise sit on "Processing..." forever waiting for chat.stream.done.
    set({ streamingMessage: null });
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

  updateApprovalStatus: (approvalId: string, status: 'approved' | 'rejected' | 'expired') => {
    set((state) => {
      const updated = new Map(state.messages);
      for (const [convId, msgs] of updated) {
        const changed = msgs.map((m) =>
          m.approval && m.approval.id === approvalId
            ? { ...m, approval: { ...m.approval, status } }
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
      }> }>('/conversations/threads', { limit: 50 });

      const conversations: Conversation[] = (res.data ?? []).map((t) => ({
        id: t.conversation_id,
        agent: t.agent ?? 'francis',
        first_message: t.first_message ?? '',
        message_count: t.message_count,
        created_at: t.created_at,
        updated_at: t.last_message_at ?? t.created_at,
      }));

      set({ conversations });
    } catch (err) {
      console.error('[chat] Failed to load conversations:', err);
    }
  },

  loadMessages: async (conversationId: string) => {
    // Skip if we already have messages for this conversation
    const existing = get().messages.get(conversationId);
    if (existing && existing.length > 0) return;

    try {
      const res = await api.get<{ data: Array<{
        id: string;
        role: string;
        message: string;
        from_agent: string;
        model_used: string | null;
        tokens_used: number | null;
        tool_calls?: unknown;
        metadata?: Record<string, unknown> | null;
        created_at: string;
        conversation_id: string;
      }> }>(`/conversations/threads/${conversationId}`);

      const msgs: Message[] = (res.data ?? []).map((m) => {
        // Backend returns tool_calls as jsonb (Drizzle gives us back
        // the array). It's the persisted ToolCallRecord shape but
        // typed as `unknown`. Be defensive.
        const tools = Array.isArray(m.tool_calls) ? (m.tool_calls as Array<Record<string, unknown>>).filter(Boolean) : undefined;
        const toolCalls = tools?.map((t) => ({
          id: String(t.id ?? crypto.randomUUID()),
          tool: String(t.tool ?? t.name ?? 'unknown'),
          status: t.status as 'pending' | 'running' | 'success' | 'error' | undefined,
          summary: typeof t.summary === 'string' ? t.summary : undefined,
          input: (() => {
            const raw = t.input ?? t.arguments;
            if (typeof raw === 'string') return raw;
            if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
            return undefined;
          })(),
          output: typeof t.output === 'string' ? t.output : undefined,
          metadata: t.metadata as Record<string, unknown> | undefined,
        }));
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
          message_metadata: (m.metadata && typeof m.metadata === 'object') ? m.metadata : undefined,
        };
      });

      set((state) => {
        const updated = new Map(state.messages);
        updated.set(conversationId, msgs);
        return { messages: updated };
      });
    } catch (err) {
      console.error('[chat] Failed to load messages:', err);
    }
  },

  finalizeStream: (conversationId: string, fullText: string, model?: string, tokensUsed?: number, errorType?: string) => {
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
    // Preserve tool blocks captured during the stream so they remain
    // visible after the message is finalized (and after F5 — the same
    // data is persisted server-side via chat-bridge → agent_conversations.tool_calls).
    const streamingTools = get().streamingMessage?.tools ?? [];
    const persistedToolCalls = streamingTools.length > 0
      ? streamingTools.map((t) => ({
          id: t.id,
          tool: t.tool,
          status: t.status as 'pending' | 'running' | 'success' | 'error' | undefined,
          summary: t.summary,
          input: t.input,
          output: t.output,
        }))
      : undefined;
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role: 'assistant',
      content: fullText,
      agent: conv?.agent ?? get().selectedAgent,
      model,
      tokens_used: tokensUsed,
      error_type: errorType,
      timestamp: new Date().toISOString(),
      tool_calls: persistedToolCalls,
    };

    set((state) => {
      const updated = new Map(state.messages);
      const existing = updated.get(conversationId) ?? [];
      updated.set(conversationId, [...existing, assistantMsg]);

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
