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
  name: string;
  icon: string;
  enabled: boolean;
  domain: string;
}

export interface AgentConversation {
  id: string;
  session_id: string;
  from_agent: string;
  to_agent: string;
  message: string;
  tool_calls: { tool: string; params: Record<string, unknown>; result?: string }[];
  tokens_used: number;
  model_used: string;
  cost_usd: number;
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
}

export interface ActionItem {
  id: string;
  title: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'complete';
  description?: string;
  deliverable_url?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  participants: string[];
  user_participates: boolean;
  status: 'scheduled' | 'in_progress' | 'completed';
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  messages: MeetingMessage[];
  action_items: ActionItem[];
  created_at: string;
}

export type AgentTab = 'tree' | 'council' | 'conversations' | 'workspaces';
