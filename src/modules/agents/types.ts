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

export interface ManagedAgent {
  id: string;
  name: string;
  display_name: string;
  role: string;
  avatar: string | null;
  model: string;
  color: string;
  is_chief: boolean;
  parent_agent_id: string | null;
  skills: AgentSkill[];
  workspace_path: string;
  status: 'active' | 'idle' | 'error';
  last_active_at: string | null;
  sessions_today: number;
  tokens_today: number;
  created_at: string;
}

export interface AgentSkill {
  id: string;
  skill_id?: string;
  name: string;
  icon: string;
  enabled: boolean;
  domain: string;
}

export interface AvailableSkill {
  id: string;
  name: string;
  icon: string;
  description: string;
  domain: string;
}

export interface AgentConversation {
  id: string;
  session_id: string;
  from_agent: string;
  to_agent: string;
  message: string;
  tool_calls: { tool: string; params: Record<string, unknown>; result?: string }[];
  tokens_used: number | null;
  model_used: string | null;
  cost_usd: number | string | null; // Drizzle returns decimal columns as strings
  /**
   * One of `webchat | delegation | council | heartbeat | cron`. Drives badge
   * rendering in ConversationMessage. `delegation` rows are sub-agent runs
   * mirrored from OpenClaw JSONL by subagent-conversation-mirror.service.
   */
  type?: string;
  /**
   * Free-form jsonb. For `type=delegation` rows: `delegated: true` is always
   * set; `briefing: true` flags the synthetic spawn prompt that came from
   * the parent agent (so the dash can render "Briefed by X" instead of
   * pretending the human user typed it).
   */
  metadata?: Record<string, unknown> | null;

  created_at: string;
}

export interface ConversationStats {
  period: string;
  total_messages: number;
  total_tokens: number;
  total_cost_usd: number;
  by_model: { model: string; messages: number; tokens: number; cost_usd: number }[];
  by_agent: { agent: string; messages: number; tokens: number; cost_usd: number }[];
  active_sessions: number;
}

export interface MeetingMessage {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_avatar: string;
  agent_role: string;
  agent_color: string;
  content: string;
  created_at: string;
  /**
   * True while the orchestrator is still streaming tokens for this turn.
   * Set by `meeting.message.start`, cleared by `meeting.message.added`.
   * The dash uses this to render a blinking cursor.
   */
  streaming?: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'complete';
  description?: string;
  deliverable_url?: string;
}

export interface MeetingParticipant {
  id: string;
  display_name: string;
  avatar: string | null;
  role: string;
  color: string;
}

export interface MeetingAdvancedOptions {
  rounds?: number;
  max_words?: number;
  devils_advocate?: boolean;
  extract_action_items?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  participants: MeetingParticipant[];
  user_participates: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'archived';
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  messages: MeetingMessage[];
  action_items: ActionItem[];
  advanced_options: MeetingAdvancedOptions;
  created_at: string;
}

export type AgentTab = 'tree' | 'council' | 'conversations' | 'workspaces';
