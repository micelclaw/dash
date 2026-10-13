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
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'resolved_elsewhere' | 'interrupted' | 'provider_removed' | 'blocked_by_policy' | 'executed';
  source?: 'core' | 'openclaw_plugin' | 'openclaw_exec' | 'runtime_native' | 'external_mcp';
  authority?: 'core_action' | 'openclaw_exec' | 'openclaw_plugin' | 'runtime_native' | 'external_mcp';
  risk?: 'low' | 'medium' | 'high' | 'critical';
  core_level?: number | null;
  allowed_decisions?: Array<'allow-once' | 'allow-always' | 'deny'>;
  resolution?: 'allow_once' | 'allow_session' | 'allow_persistent_rule' | 'deny' | 'external' | null;
  /** Safe explanation from Core; deliberately excludes protected request paths. */
  presentation?: {
    kind?: string;
    title?: string;
    summary?: string;
    tool_name?: string | null;
    provider?: string;
    secure_confirmation?: boolean;
    protected_category?: string;
  };
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

export type ToolResultKind =
  | 'entity' | 'entity_list' | 'status' | 'statistics' | 'relations'
  | 'file' | 'code' | 'command' | 'job' | 'delegation' | 'media'
  | 'web' | 'diagnostic' | 'generic';
export type ToolOperation = 'read' | 'create' | 'update' | 'delete' | 'execute';
export type ToolPresentationVisibility = 'normal' | 'technical_only';
export type ToolFieldFormat = 'text' | 'date' | 'datetime' | 'duration' | 'money' | 'percent' | 'bytes' | 'status' | 'identifier';

export type ToolRunState = 'pending' | 'running' | 'approval' | 'success' | 'empty' | 'error';

export interface ToolPresentationPayload {
  version: 1;
  definition_version: 1;
  tool_name: string;
  origin?: 'openclaw_native' | 'micelclaw_system' | 'micelclaw_app' | 'external_mcp' | 'openclaw_plugin' | 'unknown';
  canonical_name?: string;
  alias_of?: string;
  plugin_id?: string;
  fallback_reason?: 'openclaw_native' | 'external_mcp' | 'openclaw_plugin' | 'unknown';
  domain: string;
  result_kind: ToolResultKind;
  operation: ToolOperation;
  title: string;
  action_label?: string;
  context_label?: string;
  summary: string;
  state: ToolRunState;
  visibility: ToolPresentationVisibility;
  approval_level: 0 | 1 | 2 | 3;
  facts: Array<{ label: string; value: string | number | boolean; format: ToolFieldFormat }>;
  items: Array<{ id?: string; title: string; subtitle?: string; status?: string }>;
  module_link?: string;
  /** Sanitized snapshot only. Raw tool I/O is never a presentation surface. */
  technical: {
    input: unknown;
    output: unknown;
    metadata: Record<string, unknown>;
    truncated: boolean;
    metadata_truncated?: boolean;
    output_present?: boolean;
    error?: unknown;
  };
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
  status?: ToolRunState;
  /** One-line summary for the collapsed view. Optional. */
  summary?: string;
  /** Raw input — args object, command string, file path… */
  input?: string | Record<string, unknown>;
  /** Raw output — text output of the tool. Optional. */
  output?: string;
  /** Distinguishes a valid empty result from output not extracted yet. */
  output_present?: boolean;
  /** Free-form metadata: exit code, duration, etc. */
  metadata?: Record<string, unknown>;
  /**
   * Character offset in the assistant message text where this tool fired.
   * Lets ChatMessage interleave the pill between text segments (like OpenClaw)
   * instead of dumping all tools at the end. Absent on legacy rows → those
   * render at the end (fallback). Set by the backend (persisted) and by the
   * store during streaming (= length of streamed text when the event arrived).
   */
  text_offset?: number;
  /** Stable order for tools sharing a text offset. Assigned by Core. */
  sequence_index?: number;
  /** Turn/run identity used to prevent cross-run collisions during reconnect. */
  run_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  presentation?: ToolPresentationPayload;
  presentation_version?: number;
  /**
   * Typed references to domain records the backend extracted from the tool
   * output (pilot: notes only). Rendered as clickable chips below the tool
   * block. mirrors core/src/services/jsonl-tool-calls.ts — keep both in sync.
   */
  entity_refs?: Array<{ type: string; id: string; title: string | null }>;
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
  /**
   * Motivo REAL del fallo (enriquecido por el backend, p.ej. "El proveedor de
   * `nvidia/nemotron` está saturado…"). Separado de `content` porque en un
   * turno con texto parcial `content` = el parcial y el porqué se perdía.
   */
  error_detail?: string | null;
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
  /** Autor humano explícito de una conversación compartida. */
  author?: { kind: 'human'; id: string; display_name: string; avatar_url?: string | null };
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
  /**
   * Deterministic OpenClaw session key (`agent:<prefix>--<name>:webchat:<convId>`).
   * Populated by `repo.listSummaries`. Surfaced in the chat card "Details" popup
   * so power users can correlate a conversation with its JSONL transcript /
   * Gateway logs without leaving the dash. Null when the conv has no webchat
   * row yet (e.g. brand-new before first send).
   */
  session_id?: string | null;
  /**
   * Conversación de TAREA DE AGENTE (abierta por "Trabajar ahora" del Workboard). El agente la
   * completa solo, sin intervención del usuario → el chat es de SOLO-LECTURA (no se puede escribir;
   * solo aprobar/rechazar las approvals que aparezcan). Lo deriva `repo.listSummaries` de
   * `metadata.workboard_card_id`. `workboard_card_title` = el título de la tarea (para el banner).
   */
  is_agent_task?: boolean;
  is_delegated?: boolean;
  is_heartbeat?: boolean;
  /** Conversación normal iniciada sin abandonar el chat visible. */
  is_background?: boolean;
  read_only?: boolean;
  workboard_card_title?: string | null;
  access?: 'owner' | 'viewer' | 'participant' | 'admin';
  owner?: { user_id: string; display_name: string; avatar_url?: string | null } | null;
  participants?: Array<{ user_id: string; display_name: string; avatar_url?: string | null }>;
}

export type BackgroundRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

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
  status: ToolRunState | 'completed';
  summary: string;
  input?: string | Record<string, unknown>;
  output?: unknown;
  output_present?: boolean;
  /** Streamed-text length when this tool first appeared — for interleaving. */
  text_offset?: number;
  sequence_index?: number;
  run_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  entity_refs?: ToolCallRecord['entity_refs'];
  presentation?: ToolPresentationPayload;
  presentation_version?: number;
}

export interface StreamingState {
  conversationId: string;
  runId?: string;
  capturedAt?: string;
  tokens: string;
  thinking: string;
  isThinking: boolean;
  tools: ToolExecution[];
}
