import { api } from './api';

export interface SandboxOverrides { mode: string | null; scope: string | null; workspace_access: string | null }
export interface AgentSandboxConfiguration {
  global: { mode: string; scope: string; workspace_access: string; prune?: { idle_hours?: number; max_age_days?: number } };
  agent: SandboxOverrides & { prune?: unknown };
  openclaw_agent_id: string;
}
export type SandboxPatch = { mode?: string | null; scope?: string | null; workspaceAccess?: string | null };
export async function getAgentSandbox(agentId: string): Promise<AgentSandboxConfiguration> {
  const result = await api.get<{ data: AgentSandboxConfiguration }>(`/managed-agents/${agentId}/sandbox`);
  return result.data;
}
export async function patchAgentSandbox(agentId: string, patch: SandboxPatch): Promise<void> {
  // This endpoint deliberately uses camelCase for writes; reads are snake_case.
  await api.patch(`/managed-agents/${agentId}/sandbox`, patch);
}
export function sandboxPatch(saved: SandboxOverrides, draft: SandboxOverrides): SandboxPatch {
  const patch: SandboxPatch = {};
  for (const key of ['mode', 'scope', 'workspace_access'] as const) {
    if (saved[key] === draft[key]) continue;
    const options = { mode: ['off', 'non-main', 'all'], scope: ['session', 'agent', 'shared'], workspace_access: ['rw', 'ro'] };
    if (draft[key] !== null && !options[key].includes(draft[key])) throw new Error('Valor de aislamiento no asignable. Conserva el valor previo o elige una opción válida.');
    patch[key === 'workspace_access' ? 'workspaceAccess' : key] = draft[key];
  }
  return patch;
}
