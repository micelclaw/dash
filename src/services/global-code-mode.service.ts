import { api } from './api';

export interface GlobalCodeModeSnapshot {
  configured: boolean | 'auto' | null;
  presence: 'absent' | 'shorthand' | 'object_implicit' | 'explicit';
  state: 'off' | 'automatic' | 'forced_on';
  overrides: { agent_tools: number; agent_models: number; default_models: number };
  revision: string;
}
export type GlobalCodeModeChoice = false | 'auto';

export function codeModeSnapshot(value: GlobalCodeModeSnapshot): GlobalCodeModeSnapshot {
  if (!value || !/^[a-f0-9]{64}$/.test(value.revision) || !['absent', 'shorthand', 'object_implicit', 'explicit'].includes(value.presence)
    || !['off', 'automatic', 'forced_on'].includes(value.state) || ![false, true, 'auto', null].includes(value.configured)
    || !value.overrides || typeof value.overrides !== 'object' || Array.isArray(value.overrides)
    || Object.keys(value.overrides).length !== 3 || !(['agent_tools', 'agent_models', 'default_models'] as const).every(key => Object.prototype.hasOwnProperty.call(value.overrides, key) && Number.isInteger(value.overrides[key]) && value.overrides[key] >= 0)
    || (value.presence === 'absent' ? value.configured !== null || value.state !== 'automatic'
      : value.presence === 'object_implicit' ? value.configured !== null || value.state !== 'off'
        : value.state !== (value.configured === false ? 'off' : value.configured === true ? 'forced_on' : value.configured === 'auto' ? 'automatic' : null))) {
    throw new Error('Code Mode returned an unknown state. Refresh before making changes.');
  }
  return value;
}
export interface CodeModeAttempt {
  kind: 'configuration_change_v1'; change_id: string; setting_id: 'tools.codeMode.enabled';
  state: 'human_action_required' | 'pending_activation' | 'uncertain' | 'expired' | 'cancelled' | 'failed';
  attempt: { origin: 'settings'; namespace: 'code_mode_source'; scope: 'instance'; setting_id: 'tools.codeMode.enabled'; client_nonce: string };
  receipt?: { version: 1; change_id: string; user_id: string; origin: 'settings'; namespace: 'code_mode_source'; scope: 'instance'; setting_id: 'tools.codeMode.enabled'; client_nonce: string; before_revision: string; after_revision: string; proposed_revision: string; state: 'pending_activation'; committed_at: number; result: { code_mode: GlobalCodeModeSnapshot } };
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
export function codeModeAttempt(value: CodeModeAttempt): CodeModeAttempt {
  const a = value?.attempt;
  if (!value || value.kind !== 'configuration_change_v1' || !uuid(value.change_id) || value.setting_id !== 'tools.codeMode.enabled'
    || !['human_action_required', 'pending_activation', 'uncertain', 'expired', 'cancelled', 'failed'].includes(value.state)
    || !a || a.origin !== 'settings' || a.namespace !== 'code_mode_source' || a.scope !== 'instance' || a.setting_id !== value.setting_id || !uuid(a.client_nonce)) throw Error('Unknown Code Mode attempt');
  const r = value.receipt;
  if (r) {
    if (value.state !== 'pending_activation' || r.version !== 1 || r.change_id !== value.change_id || !uuid(r.user_id) || r.client_nonce !== a.client_nonce
      || r.origin !== a.origin || r.namespace !== a.namespace || r.scope !== a.scope || r.setting_id !== a.setting_id || r.state !== value.state
      || !/^[a-f0-9]{64}$/.test(r.before_revision) || !/^[a-f0-9]{64}$/.test(r.after_revision) || !/^[a-f0-9]{64}$/.test(r.proposed_revision)
      || !Number.isInteger(r.committed_at) || r.committed_at <= 0 || codeModeSnapshot(r.result?.code_mode).revision !== r.after_revision) throw Error('Invalid Code Mode receipt');
  }
  if (value.state === 'pending_activation' && !r) throw Error('Missing persistent Code Mode receipt');
  return value;
}
export const globalCodeModeService = {
  async read() { return codeModeSnapshot((await api.get<{ data: GlobalCodeModeSnapshot }>('/security/code-mode')).data); },
  async prepare(input: { enabled: GlobalCodeModeChoice; expected_revision: string; client_nonce: string }) {
    return codeModeAttempt((await api.post<{ data: CodeModeAttempt }>('/security/code-mode/prepare', input)).data);
  },
  async write(changeId: string) { return codeModeAttempt((await api.patch<{ data: CodeModeAttempt }>('/security/code-mode', { change_id: changeId })).data); },
  async result(changeId: string) { return codeModeAttempt((await api.get<{ data: CodeModeAttempt }>('/security/code-mode/changes/' + encodeURIComponent(changeId))).data); },
  async current(nonce: string) {
    const v = (await api.get<{ data: CodeModeAttempt | { kind: 'configuration_current_v1'; change_id: null } }>('/security/code-mode/current', { client_nonce: nonce })).data;
    if (v?.kind === 'configuration_current_v1' && v.change_id === null) return null;
    return codeModeAttempt(v as CodeModeAttempt);
  },
};
