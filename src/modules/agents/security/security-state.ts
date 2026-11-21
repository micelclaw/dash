import type { AgentSecurity, AgentSecurityRuntime, SecurityExecMode } from '@/services/security-policy.service';
import type { AspectStatus } from './SecurityUi';

export const modeCopy: Record<SecurityExecMode, string> = { deny: 'No ejecutar comandos', allowlist: 'Solo reglas permitidas', ask: 'Consultar si una regla no lo permite', auto: 'Revisión automática' };
export const shortModeCopy: Record<SecurityExecMode, string> = { deny: 'Denegar', allowlist: 'Solo reglas', ask: 'Consultar', auto: 'Automático' };
export const modeRank: Record<SecurityExecMode, number> = { deny: 0, allowlist: 1, ask: 2, auto: 3 };
export const fallbackCopy = { deny_and_notify: 'Denegar y avisar', deny: 'Denegar', fail_closed: 'Fallar cerrado' };
export const effectCopy = { allow: 'Permitir', prompt: 'Pedir confirmación', block: 'Bloquear' };
export const sourceCopy = { agent_override: 'Propia del agente', approval_learned: 'Confianza aprendida', imported_unmanaged: 'Importada sin gestión anterior' };
export const isExecMode = (value: unknown): value is SecurityExecMode => typeof value === 'string' && value in modeRank;
export function freshTime(value: string | null | undefined, now: number, maxAge = 15_000) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAge;
}
export function verifiedCommands(security: AgentSecurity, runtime: AgentSecurityRuntime | null, fresh: boolean) {
  return fresh && runtime?.guard.health === 'healthy' && runtime.managed && runtime.drift.state === 'in_sync'
    && runtime.desired_revision === security.desired.revision && security.desired.applied_revision === security.desired.revision
    && security.effective.status === 'in_sync' && isExecMode(runtime.requested_mode) && runtime.effective_mode === runtime.requested_mode;
}
export function commandStatus(security: AgentSecurity, runtime: AgentSecurityRuntime | null, fresh: boolean): AspectStatus {
  if (!fresh) return { color: 'orange', text: 'Sin comprobación vigente', detail: 'La configuración guardada sigue visible.' };
  if (runtime?.guard.health === 'unhealthy') return { color: 'red', text: 'Fallo del control de comandos', detail: 'El guard no puede confirmar la aplicación.' };
  if (security.desired.mode === null) return { color: 'orange', text: 'Sin política gestionada', detail: 'No equivale a tener los comandos bloqueados.' };
  if (!verifiedCommands(security, runtime, fresh)) return { color: 'orange', text: runtime?.drift.state === 'drifted' ? 'No coincide' : 'Aplicación pendiente o sin comprobar', detail: `Guardado: ${modeCopy[security.desired.mode]}; observado: ${isExecMode(runtime?.effective_mode) ? modeCopy[runtime.effective_mode] : 'sin dato'}.` };
  if (runtime?.requested_mode !== security.desired.mode) return { color: 'orange', text: 'Aplicado con límites', detail: `Guardado: ${modeCopy[security.desired.mode]}; compilado: ${isExecMode(runtime?.requested_mode) ? modeCopy[runtime.requested_mode] : 'sin dato'}.` };
  return { color: 'green', text: `Aplicados · ${shortModeCopy[runtime!.effective_mode as SecurityExecMode]} (equipo)` };
}
export function effectiveLease(lease: AgentSecurity['break_glass'][number], runtime: AgentSecurityRuntime | null, fresh: boolean, now: number) {
  // A Core boolean is necessary. A clock/status alone can only invalidate it.
  return fresh && runtime?.guard.health === 'healthy' && lease.status === 'active' && lease.effective === true
    && runtime.guard.loaded === true && Array.isArray(runtime.guard.active_lease_ids) && runtime.guard.active_lease_ids.includes(lease.id)
    && lease.guard_policy_version !== null && runtime.guard.policy_version !== undefined
    && String(lease.guard_policy_version) === String(runtime.guard.policy_version)
    && Date.parse(lease.starts_at) <= now && Date.parse(lease.expires_at) > now;
}
export const leaseOpen = (lease: AgentSecurity['break_glass'][number]) => ['active', 'pending_application', 'application_failed'].includes(lease.status);
export function leaseStatus(security: AgentSecurity, fresh: boolean, error?: string | null): AspectStatus {
  const open = security.break_glass.filter(leaseOpen);
  if (error || open.some(lease => lease.status === 'application_failed')) return { color: 'red', text: 'Acceso temporal con fallo', detail: error || 'No se pudo aplicar la excepción.' };
  if (!fresh) return { color: 'orange', text: 'Acceso temporal sin comprobar', detail: 'No se puede confirmar su efectividad ni su cierre.' };
  if (open.length) return { color: 'orange', text: `${open.length} acceso${open.length === 1 ? '' : 's'} abierto${open.length === 1 ? '' : 's'}`, detail: open.map(lease => `${lease.adapter_id} · ${lease.status === 'active' ? 'amplía permisos si está aplicado' : 'aplicación pendiente'} · vence ${displayTime(lease.expires_at)}`).join('; ') };
  return { color: 'orange', text: 'Sin accesos registrados · en uso sin comprobar', detail: 'No se ha podido verificar que no quede una excepción aplicada.' };
}
export function displayTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'sin dato';
  return new Date(value).toLocaleString('es-ES');
}
export function safeSecurityText(value: unknown, max = 450): string {
  const text = typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'Sin dato';
  return text.replace(/\bBearer\s+\S+/gi, '[oculto]').replace(/((?:authorization|cookie|credential|password|private[_-]?key|api[_-]?key|secret|token)\s*[:=]\s*)[^\s,;]+/gi, '$1[oculto]').slice(0, max);
}
