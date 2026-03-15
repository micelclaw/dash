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

export interface MessageApproval {
  id: string;
  operation: string;
  summary: string;
  level: number;
  expires_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  model?: string;
  tokens_used?: number;
  timestamp: string;
  approval?: MessageApproval;
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
  avatar?: string;
  color?: string;
}

export type ChatState = 1 | 2 | 3;

export interface StreamingState {
  conversationId: string;
  tokens: string;
}
