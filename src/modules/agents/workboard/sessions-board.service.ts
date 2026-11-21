import { api } from '@/services/api';
export interface SessionBoard { id: string; name: string; kind: 'sessions'; icon?: string; color?: string; archived?: boolean; scope?: { agent_ids?: string[]; include_archived?: boolean; include_automation?: boolean; include_home?: boolean; max_age_hours?: number } }
export interface SessionRule { health?: string[]; run?: string[]; pull_request?: string[]; archived?: boolean }
export interface SessionColumn { id: string; label: string; description?: string; color?: string; fallback?: boolean; match?: SessionRule | SessionRule[] }
export interface SessionTile { conversation_id: string; agent_id: string; title: string; column_id: string; source: 'operator' | 'state'; run: string; health: string | null; headline: string; last_activity_at: number | null; pull_requests: Array<{ url: string; number: number; state: string }> }
export interface SessionSnapshot { board: SessionBoard; columns: SessionColumn[]; sessions: SessionTile[]; people: Array<{ id: string; label: string }>; revision: string; configuration_revision: string }
export interface SessionView { involving_me: boolean; agent_id: string | null; person_id?: string | null }
export interface WorkboardAgentOption { id: string; name: string; label: string }
export const sessionsBoardApi = {
  agents: () => api.get<{ data: { agents: WorkboardAgentOption[] } }>('/workboard/agents').then(r => r.data.agents),
  list: () => api.get<{ data: { boards: SessionBoard[] } }>('/workboard/session-boards').then(r => r.data.boards),
  create: (name: string, creation_key: string) => api.post<{ data: { board: SessionBoard } }>('/workboard/session-boards', { name, creation_key }).then(r => r.data.board),
  read: (id: string, view: SessionView, since?: string) => {
    const query = new URLSearchParams({ involving_me: String(view.involving_me), ...(view.agent_id ? { agent_id: view.agent_id } : {}), ...(view.person_id ? { person_id: view.person_id } : {}), ...(since ? { since_revision: since } : {}) });
    return api.get<{ data: SessionSnapshot | { unchanged: true; revision: string } }>(`/workboard/session-boards/${encodeURIComponent(id)}?${query}`).then(r => r.data);
  },
  appearance: (id: string, input: { name: string; icon?: string; color?: string; clearAppearance?: ('icon' | 'color')[] }) => api.patch(`/workboard/session-boards/${encodeURIComponent(id)}/appearance`, input),
  update: (id: string, columns: SessionColumn[], scope: SessionBoard['scope'], expected_configuration_revision: string) => api.patch(`/workboard/session-boards/${encodeURIComponent(id)}`, {
    expected_configuration_revision,
    columns: columns.map(column => ({ ...column, ...(column.match ? { match: Array.isArray(column.match) ? column.match.map(canonicalRule) : canonicalRule(column.match) } : {}) })),
    ...(scope ? { scope: { agentIds: scope.agent_ids, includeArchived: scope.include_archived, includeAutomation: scope.include_automation, includeHome: scope.include_home, maxAgeHours: scope.max_age_hours } } : {}),
  }),
  move: (id: string, conversation_id: string, column_id: string) => api.post(`/workboard/session-boards/${encodeURIComponent(id)}/move`, { conversation_id, column_id }),
  archive: (id: string, archived: boolean) => api.post(`/workboard/session-boards/${encodeURIComponent(id)}/archive`, { archived }),
  remove: (id: string) => api.delete(`/workboard/session-boards/${encodeURIComponent(id)}`),
  agent: (id: string) => api.post<{ data: { conversation_id: string } }>(`/workboard/session-boards/${encodeURIComponent(id)}/agent`).then(r => r.data.conversation_id),
  preferences: () => api.get<{ data: { pins: string[]; last_board_id: string | null } }>('/workboard/personal-preferences').then(r => r.data),
  saveLastBoard: (last_board_id: string) => api.put('/workboard/personal-preferences', { last_board_id }),
  savePins: (pins: string[]) => api.put<{ data: { pins: string[] } }>('/workboard/personal-preferences', { pins }).then(r => r.data.pins),
  view: (id: string) => api.get<{ data: SessionView }>(`/workboard/session-boards/${encodeURIComponent(id)}/personal-view`).then(r => r.data),
  saveView: (id: string, view: SessionView) => api.put(`/workboard/session-boards/${encodeURIComponent(id)}/personal-view`, view),
};
function canonicalRule(rule: SessionRule) { const { pull_request, ...rest } = rule; return { ...rest, ...(pull_request ? { pullRequest: pull_request } : {}) }; }
