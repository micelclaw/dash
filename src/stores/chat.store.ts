import { create } from 'zustand';
import type { Message, Conversation, Agent, ChatState, StreamingState } from '@/types/chat';
import { useWebSocketStore } from './websocket.store';

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Map<string, Message[]>;
  streamingMessage: StreamingState | null;
  selectedAgent: string;
  chatState: ChatState;
  bubbleMessage: Message | null;
  agents: Agent[];

  sendMessage: (text: string, context?: Record<string, unknown>) => void;
  setChatState: (state: ChatState) => void;
  selectAgent: (name: string) => void;
  selectConversation: (id: string) => void;
  startNewConversation: () => void;
  setConversations: (conversations: Conversation[]) => void;
  setAgents: (agents: Agent[]) => void;
  addMessage: (message: Message) => void;
  setStreamingMessage: (state: StreamingState | null) => void;
  setBubbleMessage: (message: Message | null) => void;
  appendStreamToken: (conversationId: string, token: string) => void;
  finalizeStream: (conversationId: string, fullText: string, model?: string, tokensUsed?: number) => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: new Map(),
  streamingMessage: null,
  selectedAgent: 'francis',
  chatState: 1,
  bubbleMessage: null,
  agents: [],

  sendMessage: (text: string, context?: Record<string, unknown>) => {
    const { activeConversationId, selectedAgent, messages } = get();
    const convId = activeConversationId ?? crypto.randomUUID();

    if (!activeConversationId) {
      set({ activeConversationId: convId });
      const conv: Conversation = {
        id: convId,
        agent: selectedAgent,
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
    };

    const existing = messages.get(convId) ?? [];
    const updated = new Map(messages);
    updated.set(convId, [...existing, userMsg]);
    set({ messages: updated });

    useWebSocketStore.getState().send('chat.send', {
      agent: selectedAgent,
      message: text,
      conversation_id: convId,
      context: context ?? null,
    });
  },

  setChatState: (chatState: ChatState) => set({ chatState }),

  selectAgent: (name: string) => set({ selectedAgent: name }),

  selectConversation: (id: string) => set({ activeConversationId: id }),

  startNewConversation: () => set({ activeConversationId: null }),

  setConversations: (conversations: Conversation[]) => set({ conversations }),

  setAgents: (agents: Agent[]) => set({ agents }),

  addMessage: (message: Message) => {
    set((state) => {
      const updated = new Map(state.messages);
      const existing = updated.get(message.conversation_id) ?? [];
      updated.set(message.conversation_id, [...existing, message]);
      return { messages: updated };
    });
  },

  setStreamingMessage: (streamingMessage: StreamingState | null) => set({ streamingMessage }),

  setBubbleMessage: (bubbleMessage: Message | null) => set({ bubbleMessage }),

  appendStreamToken: (conversationId: string, token: string) => {
    set((state) => {
      const current = state.streamingMessage;
      if (current && current.conversationId === conversationId) {
        return { streamingMessage: { ...current, tokens: current.tokens + token } };
      }
      return { streamingMessage: { conversationId, tokens: token } };
    });
  },

  finalizeStream: (conversationId: string, fullText: string, model?: string, tokensUsed?: number) => {
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role: 'assistant',
      content: fullText,
      agent: get().selectedAgent,
      model,
      tokens_used: tokensUsed,
      timestamp: new Date().toISOString(),
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
