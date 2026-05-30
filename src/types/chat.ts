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

export interface ChatAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  filepath: string;
  /** Data URL for local preview (images only, not persisted) */
  preview_url?: string;
}

/**
 * One tool call recorded alongside an assistant message. Persisted
 * shape — same record is used for streaming-time tool blocks and for
 * tool blocks rendered in chat history after F5.
 */
export interface ToolCallRecord {
  id: string;
  /** Tool name (e.g. "sessions_spawn", "bash", "read"). */
  tool: string;
  /** Live status if known: pending → running → success/error. Optional. */
  status?: 'pending' | 'running' | 'success' | 'error';
  /** One-line summary for the collapsed view. Optional. */
  summary?: string;
  /** Raw input — args object, command string, file path… */
  input?: string | Record<string, unknown>;
  /** Raw output — text output of the tool. Optional. */
  output?: string;
  /** Free-form metadata: exit code, duration, etc. */
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: string;
  model?: string;
  tokens_used?: number;
  error_type?: string;
  timestamp: string;
  approval?: MessageApproval;
  attachments?: ChatAttachment[];
  /**
   * Tool calls associated with this assistant message. Persisted in
   * `agent_conversations.tool_calls` (jsonb). Rendered by per-tool
   * block components according to the user's tool visibility prefs.
   * `undefined` means "no tools tracked"; `[]` means "tracked, none".
   */
  tool_calls?: ToolCallRecord[];
  /**
   * Model's reasoning/thinking content for this assistant message.
   * Persisted in `agent_conversations.thinking`. `null`/`undefined` means
   * the reasoning visibility was `off` or the model emitted no thinking.
   * Rendered as a collapsible chip under the message (cursiva gris).
   */
  thinking?: string | null;
  /**
   * Free-form metadata mirrored from `agent_conversations.metadata`.
   * Used by sub-agent briefings to surface the real `task` (instead
   * of the OpenClaw "[Subagent Context]..." wrapper) and any other
   * UI-specific signals (post_yield, briefing, delegated, etc.).
   */
  message_metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  agent: string;
  first_message: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  // G8: when set, this conv is a fork from another at a compaction checkpoint
  parent_conversation_id?: string | null;
  branched_from_checkpoint_id?: string | null;
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

export interface ToolExecution {
  id: string;
  tool: string;
  status: 'running' | 'completed';
  summary: string;
  input?: string;
  output?: string;
}

export interface StreamingState {
  conversationId: string;
  tokens: string;
  thinking: string;
  isThinking: boolean;
  tools: ToolExecution[];
}
