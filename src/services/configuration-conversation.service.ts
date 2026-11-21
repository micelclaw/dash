import { api } from './api';

export interface SecureConfigurationOperation {
  kind: 'configuration_change_v1'; change_id: string; setting_id: string; label: string;
  state: 'prepared' | 'waiting_for_credential' | 'human_action_required' | 'applying' | 'saved' | 'verified' | 'pending_activation' | 'cancelled' | 'expired' | 'uncertain' | 'failed';
  expires_at: string; credential_request_id: string | null; human_action_required: boolean;
  scope?:'user'|'instance';consequences?:string[];
  private_input?: { kind:'multiline_text';label:string;description:string;min_length:number;max_length:number };
  activation: string; result_code: string | null; authentication?: 'not_checked'; proposed_value?: unknown; conversation_id?: string;
}
const path = (id: string) => `/configuration/credentials/${encodeURIComponent(id)}`;
export async function readSecureConfigurationOperation(id: string, conversationId: string, signal?: AbortSignal) {
  return (await api.get<{ data: SecureConfigurationOperation }>(path(id), { conversation_id: conversationId }, { signal })).data;
}
export async function submitSecureConfigurationValue(id: string, conversationId: string, value: string, signal?: AbortSignal) {
  return (await api.post<{ data: SecureConfigurationOperation }>(`${path(id)}/submit`, { conversation_id: conversationId, value }, { signal })).data;
}
export async function cancelSecureConfigurationOperation(id: string, conversationId: string, signal?: AbortSignal) {
  return (await api.post<{ data: SecureConfigurationOperation }>(`${path(id)}/cancel`, { conversation_id: conversationId }, { signal })).data;
}
export async function acceptSecureConfigurationOperation(id: string, signal?: AbortSignal) {
  return (await api.post<{ data: SecureConfigurationOperation }>(`/configuration/changes/${encodeURIComponent(id)}/accept`, {}, { signal })).data;
}
