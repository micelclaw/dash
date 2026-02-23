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
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
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

    // In mock mode, simulate a streaming response
    const isMock = import.meta.env.VITE_MOCK_API === 'true';
    if (isMock) {
      simulateMockStreaming(convId, text, get, set);
    } else {
      useWebSocketStore.getState().send('chat.send', {
        agent: selectedAgent,
        message: text,
        conversation_id: convId,
        context: context ?? null,
      });
    }
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
  },

  renameConversation: (id: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, first_message: title } : c,
      ),
    }));
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
    set(() => ({ streamingMessage: { conversationId: convId, tokens: '' } }));

    let i = 0;
    const interval = setInterval(() => {
      if (i >= words.length) {
        clearInterval(interval);
        get().finalizeStream(convId, fullText, 'claude-opus-4-6', words.length * 2);
        return;
      }
      accumulated += (accumulated ? ' ' : '') + words[i];
      set(() => ({ streamingMessage: { conversationId: convId, tokens: accumulated } }));
      i++;
    }, 20 + Math.random() * 15);
  }, 500);
}
