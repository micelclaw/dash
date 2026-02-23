export interface ManagedAgent {
  id: string;
  name: string;
  display_name: string;
  role: string;
  avatar: string | null;
  model: string;
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

export type AgentTab = 'tree' | 'conversations' | 'workspaces';
