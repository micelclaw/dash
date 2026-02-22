export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  model?: string;
  tokens_used?: number;
  timestamp: string;
}

export interface Conversation {
  id: string;
  agent: string;
  first_message: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  name: string;
  display_name: string;
  role: string;
  model: string;
  skills_count: number;
}

export type ChatState = 1 | 2 | 3;

export interface StreamingState {
  conversationId: string;
  tokens: string;
}
