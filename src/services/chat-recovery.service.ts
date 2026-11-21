import { api } from './api';
import { useAuthStore } from '@/stores/auth.store';
import { getAgentSecurity, getAgentSecurityRuntime, reconcileAgentSecurity, type AgentSecurity, type AgentSecurityRuntime } from './security-policy.service';

export type ChatConnectionState = 'connected' | 'temporary_unavailable' | 'pairing_required' | 'security_blocked' | 'unavailable';
export async function checkChatConnection(conversationId: string, signal?: AbortSignal): Promise<ChatConnectionState> {
  const response = await api.get<{ data: { state: ChatConnectionState } }>(`/conversations/threads/${encodeURIComponent(conversationId)}/connection`, undefined, { signal, timeout: 8_000 });
  return response.data.state;
}

export function sanitizeChatDiagnostic(value: string): string {
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[clave privada oculta]')
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n]*/gi, '$1: [oculto]')
    .replace(/((?:--)?(?:password|token|api-key|secret)\s+)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[oculto]')
    .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [oculto]')
    .replace(/((?:["']?)(?:authorization|cookie|password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|credential|private[_-]?key)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;<>]+)/gi, '$1[oculto]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[oculto]@')
    .slice(0, 4000);
}

export function savedAskCanBeRestored(security: AgentSecurity, runtime: AgentSecurityRuntime, actorId: string) {
  return security.agent.user_id === actorId && security.desired.mode === 'ask'
    && runtime.managed && runtime.requested_mode === 'ask' && runtime.desired_revision === security.desired.revision
    && runtime.drift.recovery === 'reconcile' && runtime.guard.loaded === true && runtime.guard.health === 'healthy'
    && runtime.guard.projection_health === 'healthy' && runtime.guard.host_policy_health === 'healthy' && runtime.guard.lease_state_health === 'healthy'
    && Array.isArray(runtime.guard.active_lease_ids) && runtime.guard.active_lease_ids.length === 0
    && !security.break_glass.some(lease => ['active', 'pending_application'].includes(lease.status));
}

export function restoredAskIsVerified(security: AgentSecurity, runtime: AgentSecurityRuntime, revision: number) {
  return security.desired.mode === 'ask' && security.desired.revision === revision && security.desired.applied_revision === revision
    && security.effective.status === 'in_sync' && runtime.managed && runtime.desired_revision === revision
    && runtime.requested_mode === 'ask' && runtime.effective_mode === 'ask' && runtime.drift.state === 'in_sync'
    && runtime.guard.loaded === true && runtime.guard.health === 'healthy' && runtime.guard.managed_exec_ready === true
    && runtime.guard.projection_health === 'healthy' && runtime.guard.host_policy_health === 'healthy' && runtime.guard.lease_state_health === 'healthy'
    && Array.isArray(runtime.guard.active_lease_ids) && runtime.guard.active_lease_ids.length === 0
    && !security.break_glass.some(lease => ['active', 'pending_application'].includes(lease.status));
}

const restorations = new Map<string, Promise<{ security: AgentSecurity; runtime: AgentSecurityRuntime }>>();
/** Dedupe cards/clicks in the same authenticated generation; never send a chat turn. */
export function restoreSavedAsk(agentId: string, revision: number) {
  const generation = useAuthStore.getState().sessionGeneration;
  const key = `${generation}:${agentId}:${revision}`;
  const existing = restorations.get(key);
  if (existing) return existing;
  const operation = (async () => {
    await reconcileAgentSecurity(agentId, { expected_revision: revision, expected_mode: 'ask' });
    const [security, runtime] = await Promise.all([getAgentSecurity(agentId), getAgentSecurityRuntime(agentId)]);
    if (useAuthStore.getState().sessionGeneration !== generation) throw new Error('La sesión cambió.');
    if (!restoredAskIsVerified(security, runtime, revision)) throw new Error('No se pudo confirmar la aplicación. El agente sigue necesitando revisión.');
    return { security, runtime };
  })().finally(() => restorations.delete(key));
  restorations.set(key, operation);
  return operation;
}
