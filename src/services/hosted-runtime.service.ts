import { api } from './api';

export interface HostedAdmissionStatus {
  admission_id: string;
  state: 'reserved' | 'active' | 'revoking' | 'settlement_pending' | 'settled' | 'revoked';
  revision: number;
  generation: string;
  cost_status: 'known' | 'unknown';
}
export interface HostedRuntimePreparation {
  runtime: 'agents-api';
  enabled_for_user: boolean;
  dedicated_agent: boolean;
  ready: boolean;
  credential_configured: boolean | null;
  credential_revision: string | null;
  blocker: 'HOSTED_USER_OR_AGENT_NOT_ENABLED' | 'HOSTED_NOT_PREPARED' | null;
  models: string[];
  gateway_functions: string[];
  limits: { per_file_bytes: number; per_turn_bytes: number; directory_files: number; max_concurrent_sessions: number; max_output_tokens: number };
  admissions: HostedAdmissionStatus[];
  excluded: string[];
  data_sent: string[];
}
export async function getHostedRuntimePreparation(agentId: string): Promise<HostedRuntimePreparation> {
  return (await api.get<{ data: HostedRuntimePreparation }>(`/managed-agents/${encodeURIComponent(agentId)}/hosted-runtime`)).data;
}
export async function revokeHostedAdmission(agentId: string, admissionId: string): Promise<HostedAdmissionStatus> {
  return (await api.post<{ data: HostedAdmissionStatus }>(`/managed-agents/${encodeURIComponent(agentId)}/hosted-runtime/revoke`, { admission_id: admissionId })).data;
}
export async function setHostedRuntimeCredential(agentId: string, body: { api_key: string; expected_revision: string | null }): Promise<void> {
  await api.post(`/managed-agents/${encodeURIComponent(agentId)}/hosted-runtime/credential`, body, { timeout: 240_000 });
}
