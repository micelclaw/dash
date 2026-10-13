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
  /** Modo por skill (tier núcleo/completo), keyed por skill id. Ausente = full. */
  skill_modes?: Record<string, 'core' | 'full'>;
  /** Skills APRENDIDAS por el agente (graduadas del Skill Workshop). NO son apps. */
  learned_skills?: LearnedSkill[];
  workspace_path: string;
  status: 'active' | 'idle' | 'error';
  last_active_at: string | null;
  sessions_today: number;
  tokens_today: number;
  /** Nº de scopes del token vigente (agregado en la lista, evita N+1 en Fleet). */
  scopes_count?: number;
  created_at: string;
}

/**
 * Datos en vivo agregados de `GET /managed-agents/:id/live-info`.
 * Alimentan la tarjeta "Actividad en vivo" del Overview. Solo lectura.
 */
export interface AgentLiveInfo {
  agent_id: string;
  last_activity: {
    type: string;
    from_agent: string;
    to_agent: string | null;
    preview: string;
    created_at: string;
  } | null;
  today: { messages: number; tokens: number; cost_usd: number };
  tools_today: { tool: string; count: number }[];
  recent_delegations: {
    from_agent: string;
    to_agent: string | null;
    direction: 'incoming' | 'outgoing';
    preview: string;
    briefing: boolean;
    created_at: string;
  }[];
  /** Tokens de sesión vigentes (≈ 1 por conversación no borrada), no liveness. */
  session_tokens: number;
  active_scopes: string[];
  stuck_yields: { session_key: string; detected_at: string; aborted_children: unknown }[];
  critical_events: { type: string; severity: string; created_at: string }[];
}

export interface AgentSkill {
  id: string;
  skill_id?: string;
  name: string;
  icon: string;
  /** Display SSOT (Fase E): 'emoji' → `icon` crudo · 'lucide' → `icon` es nombre Lucide. */
  icon_kind?: 'emoji' | 'lucide';
  /** Display SSOT (Fase E): tinte opcional del icono (solo Lucide). */
  color?: string;
  enabled: boolean;
  domain: string;
}

export interface AvailableSkill {
  id: string;
  name: string;
  icon: string;
  /** Display SSOT (Fase E): 'emoji' → `icon` crudo · 'lucide' → `icon` es nombre Lucide. */
  icon_kind?: 'emoji' | 'lucide';
  /** Display SSOT (Fase E): tinte opcional del icono (solo Lucide). */
  color?: string;
  description: string;
  domain: string;
}

/**
 * Skill APRENDIDA por un agente (graduada de una propuesta del Skill Workshop).
 * Vive en `managed_agents.learned_skills`, separada de las apps (`skills`). NO aparece
 * en MicelHub/available-skills. Carga vía el allowlist tras un reload del Gateway.
 */
export interface LearnedSkill {
  name: string;
  title: string;
  icon: string;
  graduated_at: string;
  proposal_id: string;
}

/** Propuesta de skill (Skill Workshop) pendiente de revisión del usuario. */
export interface SkillProposal {
  id: string;
  kind: string;
  status: string;
  title: string;
  description: string;
  skill_name: string;
  agent_name: string;
  scan_state?: string;
  created_at: string;
}

/** Detalle de una propuesta, con el draft del SKILL.md a graduar. */
export interface SkillProposalDetail extends SkillProposal {
  draft: string;
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
  /** id de la card del Workboard si la tarea ya se añadió (bajo demanda). Presente = "en el Workboard". */
  workboard_card_id?: string | boolean;
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
  /** Cuándo pausa el council para la intervención humana (solo con user_participates). */
  intervention?: 'each_round' | 'before_conclusion';
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
  /** true si el orquestador tiene abierta la ventana de intervención humana (rehidratación). */
  awaiting_user?: boolean;
  created_at: string;
}

export type AgentTab = 'tree' | 'council' | 'workboard' | 'memory' | 'conversations' | 'workspaces' | 'fleet';

/** Sub-pestañas del panel AgentDetail. Centralizado aquí (antes era local). */
export type AgentDetailTab = 'overview' | 'tools' | 'memory' | 'security' | 'advanced' | 'activity' | 'health';

// ─── A) Centro de actividad ───────────────────────────────────────

export interface AgentEventRow {
  id: string;
  type: string;
  severity: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  source_agent_id: string | null;
  target_agent_id: string | null;
  direction: 'in' | 'out';
  payload: Record<string, unknown> | null;
  processed: boolean;
  created_at: string;
}

export interface AgentEventsResponse {
  events: AgentEventRow[];
  count: number;
  has_more: boolean;
}

export interface AgentDelegation {
  id: string;
  session_id: string | null;
  direction: 'outgoing' | 'incoming';
  counterpart: string | null; // nombre minúscula de la contraparte
  from_agent: string;
  to_agent: string | null;
  preview: string;
  briefing: boolean;
  tokens_used: number | null;
  model_used: string | null;
  cost_usd: number | string | null;
  tool_calls: { tool: string; params?: Record<string, unknown>; result?: string }[];
  created_at: string;
}

export interface DelegationSession {
  session_id: string | null;
  root_agent: string;
  count: number;
  started_at: string;
}

export interface AgentDelegationsResponse {
  delegations: AgentDelegation[];
  by_session: DelegationSession[];
  count: number;
  has_more: boolean;
}

// ─── B) Fleet / Analytics ─────────────────────────────────────────

export interface AnalyticsDailyPoint {
  date: string; // YYYY-MM-DD
  messages: number;
  tokens: number;
  cost_usd: number;
}

export interface AnalyticsAgentSeries {
  agent: string;
  display_name: string;
  total_tokens: number;
  total_cost_usd: number;
  total_messages: number;
  daily: AnalyticsDailyPoint[];
}

export interface AnalyticsModelSeries {
  model: string;
  total_tokens: number;
  total_cost_usd: number;
  total_messages: number;
  daily: AnalyticsDailyPoint[];
}

export interface AgentAnalytics {
  period: string;
  range: { from: string; to: string };
  series: AnalyticsDailyPoint[];
  by_agent: AnalyticsAgentSeries[];
  by_model: AnalyticsModelSeries[];
}

// ─── D) Agent Doctor / salud ──────────────────────────────────────

export type HealthFixAction =
  | 'regenerate_tools'
  | 'resume_stuck_yield'
  | 'regenerate_skill_files'
  | 'assign_skills'
  | 'set_model'
  | null;

export interface AgentHealthCheck {
  check: string;
  label: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
  fixable: boolean;
  fix_action: HealthFixAction;
  fix_scope: 'agent' | 'bulk' | null;
}

export interface AgentHealth {
  agent_id: string;
  checked_at: string;
  summary: { ok: number; warn: number; error: number };
  checks: AgentHealthCheck[];
}
