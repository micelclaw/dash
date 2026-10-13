import { useVisibleSecurityPolling } from '@/hooks/useVisibleSecurityPolling';
import { SecurityRecoveryStatus } from '@/components/settings/sections/security/SecurityRecoveryStatus';
/** Desired/effective command security for one managed agent. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock3,
  KeyRound,
  Layers3,
  Loader2,
  Plus,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { ApiError } from '@/services/api';
import { breakGlassLeasePresentation } from '@/services/security-policy.ui-state';
import { useAuthStore } from '@/stores/auth.store';
import {
  addAgentSecurityRule,
  getAgentSecurity,
  getAgentSecurityRuntime,
  getSecuritySettings,
  listCommandProfiles,
  previewAgentSecurity,
  reconcileAgentSecurity,
  requestAgentBreakGlass,
  revokeAgentBreakGlass,
  revokeAgentSecurityRule,
  updateAgentSecurity,
  type AgentSecurity as AgentSecurityData,
  type AgentSecurityRuntime,
  type AgentSecurityPreview,
  type CommandProfileSummary,
  type SecurityRuntimeAdapterStatus,
  type SecurityExecMode,
  type SecurityPolicySettings,
  type SecurityRuleEffect,
} from '@/services/security-policy.service';
import { AgentSandboxConfig } from './AgentSandboxConfig';

interface AgentSecurityProps {
  agentId: string;
  agentName: string;
  showSandbox?: boolean;
  onChanged?: () => void;
}

const MODE_LABELS: Record<SecurityExecMode, { label: string; description: string }> = {
  deny: { label: 'Deny', description: 'No command execution.' },
  allowlist: { label: 'Allowlist', description: 'Only matching published rules.' },
  ask: { label: 'Ask', description: 'Prompt when policy requires a human decision.' },
  auto: { label: 'Automatic', description: 'Use the complete policy decision graph.' },
};

const MODE_RANK: Record<SecurityExecMode, number> = {
  deny: 0,
  allowlist: 1,
  ask: 2,
  auto: 3,
};

const BREAK_GLASS_DURATIONS = [5, 15, 30] as const;
type BreakGlassDuration = (typeof BREAK_GLASS_DURATIONS)[number];
type RuntimeAdapterView = AgentSecurityData['adapters'][number] | SecurityRuntimeAdapterStatus;

const SENSITIVE_FIELD = /(?:authorization|cookie|credential|password|private[_-]?key|api[_-]?key|secret|token)/i;

function safeDisplayText(value: string, maxLength = 180): string {
  const redacted = value
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/((?:authorization|cookie|credential|password|private[_-]?key|api[_-]?key|secret|token)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength - 1)}…` : redacted;
}

function compactSafeValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return safeDisplayText(value);
  if (depth >= 2) return Array.isArray(value) ? `[${value.length} items]` : '[object]';
  if (Array.isArray(value)) {
    const items = value.slice(0, 8).map((item) => compactSafeValue(item, depth + 1));
    return value.length > items.length ? [...items, `… ${value.length - items.length} more`] : items;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 12);
    const compact = Object.fromEntries(entries.map(([key, item]) => [
      key,
      SENSITIVE_FIELD.test(key) ? '[redacted]' : compactSafeValue(item, depth + 1),
    ]));
    const omitted = Object.keys(value as Record<string, unknown>).length - entries.length;
    if (omitted > 0) compact._more = `${omitted} fields omitted`;
    return compact;
  }
  return String(value);
}

function CompactPolicyValue({ value, empty = 'Not reported' }: { value: unknown; empty?: string }) {
  const isEmpty = value === null || value === undefined
    || (typeof value === 'object' && Object.keys(value as object).length === 0);
  if (isEmpty) return <span className="text-xs text-[var(--text-muted)]">{empty}</span>;
  return <pre className="m-0 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-[var(--surface)] p-2 font-mono text-[11px] leading-5 text-[var(--text-dim)]">{JSON.stringify(compactSafeValue(value), null, 2)}</pre>;
}

function AdapterCard({ adapter }: { adapter: RuntimeAdapterView }) {
  const [open, setOpen] = useState(false);
  const panelId = `security-adapter-${adapter.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const detailed = 'supported_scopes' in adapter;
  const scopes = detailed ? adapter.supported_scopes : [];
  const modes = detailed ? adapter.supported_modes : [];
  const capabilities = detailed ? adapter.guard_capabilities : null;
  const notes = detailed ? (adapter.notes ?? []).slice(0, 8) : [];
  const sourceLayers = Array.isArray(adapter.source_layers) ? adapter.source_layers.slice(0, 12) : [];

  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)]">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={panelId} className="flex w-full items-start gap-3 border-0 bg-transparent p-3 text-left hover:bg-[var(--surface-hover)]">
        <span className="mt-0.5 text-[var(--text-muted)]">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-[var(--text)]">{adapter.label ?? adapter.id}</span><StatePill state={adapter.availability} /></span>
          <span className="mt-1 block text-[11px] leading-4 text-[var(--text-muted)]">
            {detailed ? adapter.family.replaceAll('_', ' ') : 'runtime adapter'}
            {scopes.length > 0 ? ` · ${scopes.join(', ')}` : ''}
            {modes.length > 0 ? ` · modes: ${modes.join(', ')}` : ''}
          </span>
        </span>
      </button>
      {open && (
        <div id={panelId} className="space-y-4 border-t border-[var(--border)] p-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Requested policy</div><CompactPolicyValue value={adapter.requested_policy} /></div>
            <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Effective policy</div><CompactPolicyValue value={adapter.effective_policy} empty="Not observed by the runtime" /></div>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Source layers</div>
            {sourceLayers.length === 0 ? <span className="text-xs text-[var(--text-muted)]">No source layers reported.</span> : (
              <div className="space-y-2">{sourceLayers.map((layer, index) => {
                const source = typeof layer === 'object' && layer !== null && 'source' in layer ? String(layer.source) : `Layer ${index + 1}`;
                const value = typeof layer === 'object' && layer !== null && 'value' in layer ? layer.value : layer;
                return <div key={`${source}-${index}`} className="grid min-w-0 gap-1 sm:grid-cols-[150px_minmax(0,1fr)]"><span className="text-xs font-medium text-[var(--text-dim)]">{source.replaceAll('_', ' ')}</span><CompactPolicyValue value={value} /></div>;
              })}</div>
            )}
          </div>
          {capabilities && (
            <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Guard capabilities</div><div className="flex flex-wrap gap-2">{Object.entries(capabilities).map(([name, enabled]) => <span key={name} className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${enabled ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'}`}>{name.replaceAll('_', ' ')} · {enabled ? 'yes' : 'no'}</span>)}</div></div>
          )}
          {detailed && <div className="text-[11px] leading-5 text-[var(--text-muted)]">Applies: {adapter.apply_effect.replaceAll('_', ' ')} · approvals: {adapter.approval_transport.replaceAll('_', ' ')}</div>}
          {notes.length > 0 && <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Notes</div><ul className="m-0 list-disc space-y-1 pl-5 text-xs leading-5 text-[var(--text-dim)]">{notes.map((note, index) => <li key={index}>{safeDisplayText(note, 240)}</li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}

function observedGuardHealth(runtime: AgentSecurityRuntime | null, security: AgentSecurityData | null): string {
  const runtimeHealth = runtime?.guard.health;
  if (typeof runtimeHealth === 'string') return runtimeHealth;
  const effectiveHealth = security?.effective.policy?.guard;
  return typeof effectiveHealth === 'string' ? effectiveHealth : 'unavailable';
}

function breakGlassErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'No se pudo activar el acceso temporal';
  }
  if (error.code === 'INVALID_SECURITY_PIN') return 'El PIN de seguridad es incorrecto.';
  if (error.code === 'SECURITY_PIN_REQUIRED') return 'Configura primero un PIN de seguridad para tu cuenta.';
  if (error.code === 'BREAK_GLASS_REQUIRES_INTERACTIVE_BASE_MODE') return 'La política base debe estar guardada en modo Ask o Automatic.';
  if (error.code === 'BREAK_GLASS_DURATION_EXCEEDED') return 'La duración supera el máximo definido por el owner.';
  if (error.code === 'BREAK_GLASS_ROLE_REQUIRED') return 'Tu rol no puede activar acceso completo temporal.';
  return error.message;
}

function stateColor(state: string): string {
  if (state === 'in_sync' || state === 'healthy' || state === 'active') return '#22c55e';
  if (state === 'pending_application' || state === 'reconciliation_required' || state === 'drifted') return '#f59e0b';
  if (state === 'application_failed' || state === 'unhealthy') return '#ef4444';
  if (state === 'degraded') return '#f59e0b';
  if (state === 'unavailable' || state === 'unmanaged' || state === 'legacy_unmanaged' || state === 'revoked' || state === 'expired') return '#94a3b8';
  return 'var(--text-dim)';
}

function StatePill({ state }: { state: string }) {
  const color = stateColor(state);
  const variableColor = color.startsWith('var(');
  return <span role="status" className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color, borderColor: variableColor ? 'var(--border)' : `${color}55`, background: variableColor ? 'var(--card)' : `${color}12` }}>{state.replaceAll('_', ' ')}</span>;
}

type BreakGlassLease = AgentSecurityData['break_glass'][number];

const BREAK_GLASS_STATUS_COPY: Record<BreakGlassLease['status'], string> = {
  pending_application: 'Waiting for runtime application',
  active: 'Core lease is active',
  application_failed: 'Runtime application failed',
  revoked: 'Lease revoked',
  expired: 'Lease expired',
};

function BreakGlassLeaseState({ lease }: { lease: BreakGlassLease }) {
  const presentation = breakGlassLeasePresentation(lease);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label={`Lease status: ${lease.status.replaceAll('_', ' ')}`}>
      <StatePill state={lease.status} />
      {presentation.effective ? (
        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-400">Effective now</span>
      ) : lease.status === 'active' ? (
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--amber)]">Not verified effective</span>
      ) : null}
      <span className="text-[10px] text-[var(--text-muted)]">
        Runtime application: {lease.provider_application.replaceAll('_', ' ')}
        {lease.guard_policy_version !== null ? ` · guard v${lease.guard_policy_version}` : ''}
      </span>
    </div>
  );
}

function JsonFacts({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) return <span className="text-xs text-[var(--text-muted)]">Not observed</span>;
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {Object.entries(value).slice(0, 12).map(([key, item]) => (
        <div key={key} className="min-w-0 rounded-[var(--radius-sm)] bg-[var(--card)] p-2">
          <dt className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{key.replaceAll('_', ' ')}</dt>
          <dd className="m-0 mt-1 break-words font-mono text-xs text-[var(--text-dim)]">{typeof item === 'object' ? JSON.stringify(item) : String(item)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ToolSecurityRegistryStatus({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return null;
  const status = value as Record<string, unknown>;
  const contracts = status.registered_contracts, pending = status.pending_tool_count;
  if (status.enforced !== true || typeof contracts !== 'number' || !Number.isSafeInteger(contracts) || contracts < 0
    || typeof pending !== 'number' || !Number.isSafeInteger(pending) || pending < 0) return null;
  const names = Array.isArray(status.pending_native_tools) ? status.pending_native_tools
    .filter((name): name is string => typeof name === 'string' && name.length <= 160).slice(0, 50) : [];
  return <aside role="status" aria-label="Tool security registry" className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--text-dim)]">
    <strong className="text-[var(--text)]">Tool security registry</strong>
    <p className="mb-0 mt-1">{contracts} registered contracts. {pending > 0
      ? `${pending} tools have contracts pending review. Unreviewed contracts are blocked.`
      : 'No pending contracts reported.'}</p>
    {names.length > 0 && <details className="mt-2"><summary className="cursor-pointer">View pending native tools</summary>
      <ul className="mb-0 mt-2 pl-4">{names.map(name => <li key={name}>{name}</li>)}</ul>
    </details>}
  </aside>;
}

export function AgentSecurity({ agentId, agentName, showSandbox = true, onChanged }: AgentSecurityProps) {
  const role = useAuthStore((state) => state.user?.role ?? 'user');
  const [security, setSecurity] = useState<AgentSecurityData | null>(null);
  const [runtime, setRuntime] = useState<AgentSecurityRuntime | null>(null);
  const [policySettings, setPolicySettings] = useState<SecurityPolicySettings | null>(null);
  const [profiles, setProfiles] = useState<CommandProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeRouteAvailable, setRuntimeRouteAvailable] = useState(false);
  const [mode, setMode] = useState<SecurityExecMode>('deny');
  const [profileId, setProfileId] = useState('');
  const [fallback, setFallback] = useState<'deny_and_notify' | 'deny' | 'fail_closed'>('deny_and_notify');
  const [preview, setPreview] = useState<AgentSecurityPreview | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);
  const [newEffect, setNewEffect] = useState<SecurityRuleEffect>('block');
  const [newExecutable, setNewExecutable] = useState('');
  const [newArguments, setNewArguments] = useState('');
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [breakGlassDuration, setBreakGlassDuration] = useState<BreakGlassDuration>(5);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [breakGlassPin, setBreakGlassPin] = useState('');
  const [breakGlassError, setBreakGlassError] = useState<string | null>(null);
  const [breakGlassSubmitting, setBreakGlassSubmitting] = useState(false);
  const [revokingLeaseId, setRevokingLeaseId] = useState<string | null>(null);

  const observationRoot = useRef<HTMLDivElement>(null);
  const refreshObservation = useCallback(async (isCurrent: () => boolean) => {
    try { const observed = await getAgentSecurityRuntime(agentId); if (!isCurrent()) return; setRuntime(observed); setRuntimeError(null); }
    catch (error) { if (!isCurrent()) return; setRuntimeError(error instanceof Error ? error.message : 'Runtime refresh failed'); }
  }, [agentId]);
  useVisibleSecurityPolling(observationRoot, refreshObservation);

  const hydrate = (next: AgentSecurityData) => {
    setSecurity(next);
    setMode(next.desired.mode ?? 'deny');
    setProfileId(next.desired.profile_id ?? '');
    setFallback(next.desired.unattended_fallback ?? 'deny_and_notify');
    if (next.inherited.profile?.extension_policy !== 'allow_unprotected') {
      setNewEffect((effect) => effect === 'allow' ? 'block' : effect);
    }
    setPreview(null);
  };

  const loadRuntime = useCallback(async () => {
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      setRuntime(await getAgentSecurityRuntime(agentId));
      setRuntimeRouteAvailable(true);
    } catch (runtimeLoadError) {
      setRuntime(null);
      if (runtimeLoadError instanceof ApiError && runtimeLoadError.status === 404) {
        // A missing optional route is not an observed runtime failure. The
        // primary security response remains the only source available.
        setRuntimeRouteAvailable(false);
      } else {
        setRuntimeRouteAvailable(true);
        setRuntimeError(runtimeLoadError instanceof Error
          ? runtimeLoadError.message
          : 'Could not load live runtime security');
      }
    } finally {
      setRuntimeLoading(false);
    }
  }, [agentId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPolicySettings(null);
    try {
      const [nextSecurity, nextProfiles, nextPolicySettings] = await Promise.all([
        getAgentSecurity(agentId),
        listCommandProfiles(),
        getSecuritySettings(),
      ]);
      hydrate(nextSecurity);
      setPolicySettings(nextPolicySettings);
      setProfiles(nextProfiles.filter((profile) => profile.status === 'published'));
      await loadRuntime();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load agent security');
    } finally {
      setLoading(false);
    }
  }, [agentId, loadRuntime]);

  // Initial API synchronization; `load` also owns the visible request state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const selectedProfile = profiles.find((profile) => profile.id === profileId);
  const policyInput = useMemo(() => security ? {
    expected_revision: security.desired.revision,
    requested_exec_mode: mode,
    profile_id: mode === 'deny' ? (selectedProfile?.id ?? null) : profileId,
    unattended_fallback: fallback,
  } : null, [security, mode, profileId, selectedProfile?.id, fallback]);

  const invalidProfile = mode !== 'deny' && !selectedProfile;
  const ownerMaximum = role === 'owner' ? 'auto' : (security?.inherited.owner_max_user_mode ?? 'deny');
  const profileMaximum = selectedProfile?.max_exec_mode ?? ownerMaximum;
  const maximumModeRank = Math.min(MODE_RANK[ownerMaximum], MODE_RANK[profileMaximum]);
  const modeExceedsLimit = MODE_RANK[mode] > maximumModeRank;
  const invalidPolicy = invalidProfile || modeExceedsLimit;
  const canAllowOverrides = security?.inherited.profile?.extension_policy === 'allow_unprotected';
  const canManageEmergencyAccess = role === 'owner' || role === 'admin';
  const guardHealth = observedGuardHealth(runtime, security);
  const allowedBreakGlassDurations = BREAK_GLASS_DURATIONS.filter(
    (duration) => duration <= (policySettings?.break_glass_max_minutes ?? 0),
  );
  const breakGlassUnavailableReason = (() => {
    if (!canManageEmergencyAccess) return 'Solo el owner o un administrador puede gestionar acceso temporal.';
    if (!policySettings) return 'No se pudo comprobar la configuración global de seguridad.';
    if (role === 'admin' && !policySettings.allow_admin_break_glass) return 'El owner no ha habilitado acceso temporal para administradores.';
    if (security?.desired.mode !== 'ask' && security?.desired.mode !== 'auto') return 'Guarda primero una política base Ask o Automatic.';
    if (guardHealth !== 'healthy') return `El guard de seguridad no está healthy (${guardHealth}).`;
    if (allowedBreakGlassDurations.length === 0) return 'El máximo configurado no permite ninguna duración disponible.';
    return null;
  })();

  const resetBreakGlassForm = () => {
    setBreakGlassDuration(5);
    setBreakGlassReason('');
    setBreakGlassPin('');
    setBreakGlassError(null);
  };

  const openBreakGlass = () => {
    if (breakGlassUnavailableReason) return;
    resetBreakGlassForm();
    setBreakGlassDuration(allowedBreakGlassDurations[0] ?? 5);
    setBreakGlassOpen(true);
  };

  const submitBreakGlass = async () => {
    const reason = breakGlassReason.trim();
    if (
      breakGlassUnavailableReason
      || !allowedBreakGlassDurations.includes(breakGlassDuration)
      || reason.length < 8
      || !breakGlassPin
    ) return;
    setBreakGlassSubmitting(true);
    setBreakGlassError(null);
    try {
      await requestAgentBreakGlass(agentId, {
        duration_minutes: breakGlassDuration,
        reason,
        pin: breakGlassPin,
      });
      setBreakGlassOpen(false);
      resetBreakGlassForm();
      toast.success('Solicitud de acceso temporal procesada; comprobando el estado efectivo del runtime');
      await load();
      onChanged?.();
    } catch (requestError) {
      const message = breakGlassErrorMessage(requestError);
      setBreakGlassError(message);
      setBreakGlassPin('');
      toast.error(message);
    } finally {
      setBreakGlassSubmitting(false);
    }
  };

  const revokeBreakGlass = async (leaseId: string) => {
    if (!canManageEmergencyAccess || revokingLeaseId) return;
    setRevokingLeaseId(leaseId);
    try {
      await revokeAgentBreakGlass(agentId, leaseId);
      toast.success('Acceso temporal revocado');
      await load();
      onChanged?.();
    } catch (revokeError) {
      toast.error(revokeError instanceof Error ? revokeError.message : 'No se pudo revocar el acceso temporal');
    } finally {
      setRevokingLeaseId(null);
    }
  };

  const showPreview = async () => {
    if (!policyInput || invalidPolicy) return;
    setSaving(true);
    try {
      setPreview(await previewAgentSecurity(agentId, policyInput));
    } catch (previewError) {
      toast.error(previewError instanceof Error ? previewError.message : 'Could not preview policy');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!policyInput || invalidPolicy) return;
    setSaving(true);
    try {
      hydrate(await updateAgentSecurity(agentId, policyInput));
      await loadRuntime();
      toast.success(`Security policy saved for ${agentName}`);
      onChanged?.();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save agent security');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const reconcile = async () => {
    setReconciling(true);
    try {
      await reconcileAgentSecurity(agentId);
      toast.success('Reconciliation requested');
      await load();
    } catch (reconcileError) {
      toast.error(reconcileError instanceof Error ? reconcileError.message : 'Could not reconcile runtime policy');
    } finally {
      setReconciling(false);
    }
  };

  const addOverride = async () => {
    if (!security || !newExecutable.trim() || (newEffect === 'allow' && !canAllowOverrides)) return;
    setSaving(true);
    try {
      await addAgentSecurityRule(agentId, {
        effect: newEffect,
        rule: {
          effect: newEffect,
          target: 'gateway',
          executable_pattern: newExecutable.trim(),
          argument_matcher: { kind: newArguments.trim() ? 'prefix' : 'exact', value: newArguments.trim() },
          cwd_scope: 'agent_workspace',
          cwd_path: null,
          description: `Local override for ${agentName}`,
        },
      });
      setNewExecutable('');
      setNewArguments('');
      toast.success('Agent override added');
      await load();
    } catch (overrideError) {
      toast.error(overrideError instanceof Error ? overrideError.message : 'Could not add override');
    } finally {
      setSaving(false);
    }
  };

  const tightenInheritedRule = async (fingerprint: string, effect: 'prompt' | 'block') => {
    setSaving(true);
    try {
      await addAgentSecurityRule(agentId, { effect, base_rule_fingerprint: fingerprint });
      toast.success(`Inherited rule tightened to ${effect}`);
      await load();
    } catch (overrideError) {
      toast.error(overrideError instanceof Error ? overrideError.message : 'Could not tighten inherited rule');
    } finally {
      setSaving(false);
    }
  };

  const revokeOverride = async (id: string) => {
    setSaving(true);
    try {
      await revokeAgentSecurityRule(agentId, id);
      toast.success('Agent override revoked');
      await load();
    } catch (overrideError) {
      toast.error(overrideError instanceof Error ? overrideError.message : 'Could not revoke override');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !security) {
    return <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]"><Loader2 size={15} className="animate-spin" />Loading agent security…</div>;
  }
  if (error && !security) {
    return <RetryBanner severity="error" title="Agent security unavailable" message={error} onRetry={() => void load()} loading={loading} />;
  }
  if (!security) return null;

  const legacy = security.desired.state === 'legacy_unmanaged';
  const observedDrift = runtime?.drift.state ?? security.drift.state;
  const effectiveStatus = runtime?.drift.state ?? security.effective.status;
  const drifted = observedDrift !== 'in_sync' && observedDrift !== 'unavailable' && observedDrift !== 'unmanaged';
  const runtimeFacts: Record<string, unknown> | null = runtime ? {
    requested_mode: runtime.requested_mode,
    effective_mode: runtime.effective_mode,
    guard: runtime.guard,
    openclaw_exec: runtime.openclaw_exec,
    approvals: runtime.approvals,
  } : security.effective.policy;
  const adapters = runtime?.adapters ?? security.adapters;
  const independentOverrides = security.rules.overrides.filter((override) => !override.base_rule_fingerprint);
  const inheritedOverrides = new Map<string, AgentSecurityData['rules']['overrides']>();
  for (const override of security.rules.overrides) {
    if (!override.base_rule_fingerprint) continue;
    const existing = inheritedOverrides.get(override.base_rule_fingerprint) ?? [];
    existing.push(override);
    inheritedOverrides.set(override.base_rule_fingerprint, existing);
  }
  // `effective` is an attested Core result. Never infer it in Dash from a
  // runtime snapshot, provider label, lease dates or the persisted status.
  const effectiveLeaseCount = security.break_glass.filter(
    (lease) => breakGlassLeasePresentation(lease).effective,
  ).length;
  const pendingLeaseCount = security.break_glass.filter((lease) => lease.status === 'pending_application').length;

  return (
    <div ref={observationRoot} className="space-y-4">
      {error && <RetryBanner severity="warn" message={error} onRetry={() => void load()} loading={loading} />}
      {runtimeError && (
        <div role="alert">
          <RetryBanner
            severity="error"
            title="Live runtime security unavailable"
            message={`Desired policy remains visible, but the live runtime endpoint could not be refreshed: ${runtimeError}`}
            onRetry={() => void loadRuntime()}
            loading={runtimeLoading}
          />
        </div>
      )}
      {legacy && (
        <div className="flex gap-3 rounded-[var(--radius-md)] border border-[color:rgba(245,158,11,.4)] bg-[color:rgba(245,158,11,.07)] p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--amber)]" />
          <div><div className="text-sm font-semibold text-[var(--text)]">Legacy unmanaged policy</div><p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">Choose a managed mode and published command profile. Until then Core cannot describe or reconcile the agent's desired command policy.</p></div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby={`desired-security-${agentId}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 id={`desired-security-${agentId}`} className="m-0 flex items-center gap-2 text-sm font-semibold text-[var(--text)]"><Shield size={16} className="text-[var(--amber)]" />Desired policy</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Revision {security.desired.revision} · applied {security.desired.applied_revision ?? 'not observed'}</p></div>
            <StatePill state={security.desired.state} />
          </div>
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-medium text-[var(--text-dim)]">Execution mode<select value={mode} onChange={(event) => { setMode(event.target.value as SecurityExecMode); setPreview(null); }} className={`mt-1 h-9 w-full rounded-[var(--radius-sm)] border bg-[var(--card)] px-3 text-sm text-[var(--text)] ${modeExceedsLimit ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}>{(Object.keys(MODE_LABELS) as SecurityExecMode[]).map((value) => <option key={value} value={value} disabled={MODE_RANK[value] > maximumModeRank}>{MODE_LABELS[value].label} — {MODE_LABELS[value].description}</option>)}</select>{modeExceedsLimit && <span className="mt-1 block text-[11px] text-[var(--error)]">Choose a mode at or below {MODE_LABELS[profileMaximum].label.toLowerCase()}{role === 'owner' ? '' : ` and the owner limit ${MODE_LABELS[ownerMaximum].label.toLowerCase()}`}.</span>}</label>
            <label className="text-xs font-medium text-[var(--text-dim)]">Command profile<select value={profileId} onChange={(event) => { setProfileId(event.target.value); setPreview(null); }} className={`mt-1 h-9 w-full rounded-[var(--radius-sm)] border bg-[var(--card)] px-3 text-sm text-[var(--text)] ${invalidProfile ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}><option value="">{mode === 'deny' ? 'No profile' : 'Select a published profile'}</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · v{profile.published_version} · max {profile.max_exec_mode}</option>)}</select>{invalidProfile && <span className="mt-1 block text-[11px] text-[var(--error)]">This mode requires a published command profile.</span>}{selectedProfile && <span className="mt-1 block text-[11px] text-[var(--text-muted)]">Local extensions: {selectedProfile.extension_policy.replaceAll('_', ' ')}</span>}</label>
            <label className="text-xs font-medium text-[var(--text-dim)]">Unattended fallback<select value={fallback} onChange={(event) => { setFallback(event.target.value as typeof fallback); setPreview(null); }} className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]"><option value="deny_and_notify">Deny and notify</option><option value="deny">Deny</option><option value="fail_closed">Fail closed</option></select></label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void showPreview()} disabled={saving || invalidPolicy}>Preview</Button><Button type="button" size="sm" onClick={() => void save()} disabled={saving || invalidPolicy}>{saving && <Loader2 size={13} className="animate-spin" />}Save policy</Button></div>
          {preview && (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--text-dim)]">
              <div className="font-semibold text-[var(--text)]">Preview · desired revision {preview.after.desired_revision}</div>
              <div className="mt-1">{preview.impact.profile_rules} profile rules · {preview.impact.local_overrides} local overrides</div>
              {preview.warnings.map((warning) => <div key={warning} className="mt-2 text-[var(--amber)]">{warning}</div>)}
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby={`effective-security-${agentId}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 id={`effective-security-${agentId}`} className="m-0 flex items-center gap-2 text-sm font-semibold text-[var(--text)]"><Activity size={16} className="text-[var(--amber)]" />Effective policy</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{security.effective.observed_at ? `Observed ${new Date(security.effective.observed_at).toLocaleString()}` : 'No runtime observation'}</p></div>
            <StatePill state={effectiveStatus} />
          </div>
          {security.effective.reason && <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--card)] p-3 text-xs text-[var(--text-dim)]">{security.effective.reason.replaceAll('_', ' ')}</div>}
          <SecurityRecoveryStatus recovery={runtime?.recovery ?? security.recovery} />
          <ToolSecurityRegistryStatus value={runtime?.guard.tool_registry} />
          <div className="mt-4"><JsonFacts value={runtimeFacts} /></div>
          {drifted && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:rgba(245,158,11,.35)] bg-[color:rgba(245,158,11,.06)] p-3">
              <span className="text-xs text-[var(--text-dim)]">Desired and observed state need reconciliation.</span>
              {runtimeRouteAvailable && <Button type="button" size="sm" variant="outline" onClick={() => void reconcile()} disabled={reconciling}>{reconciling ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}Reconcile</Button>}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]" aria-labelledby={`security-layers-${agentId}`}>
        <button type="button" onClick={() => setLayersOpen((open) => !open)} aria-expanded={layersOpen} className="flex w-full items-center gap-2 border-0 bg-transparent p-4 text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)]">{layersOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<Layers3 size={15} className="text-[var(--amber)]" /><span id={`security-layers-${agentId}`}>Policy layers</span></button>
        {layersOpen && (
          <>
            <div className="grid gap-3 border-t border-[var(--border)] p-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[var(--radius-sm)] bg-[var(--card)] p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Server bound</div><div className="mt-2 text-sm text-[var(--text)]">Default {security.inherited.server_default_mode}</div><div className="mt-1 text-xs text-[var(--text-muted)]">User maximum {security.inherited.owner_max_user_mode}</div></div>
              <div className="rounded-[var(--radius-sm)] bg-[var(--card)] p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Published profile</div><div className="mt-2 text-sm text-[var(--text)]">{security.inherited.profile?.name ?? 'None'}</div><div className="mt-1 text-xs text-[var(--text-muted)]">{security.rules.profile.length} rules{security.inherited.profile?.version ? ` · v${security.inherited.profile.version}` : ''}</div></div>
              <div className="rounded-[var(--radius-sm)] bg-[var(--card)] p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Agent overrides</div><div className="mt-2 text-sm text-[var(--text)]">{security.rules.overrides.length}</div><div className="mt-1 text-xs text-[var(--text-muted)]">Local block, prompt or permitted extensions</div></div>
              <div className="rounded-[var(--radius-sm)] bg-[var(--card)] p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Effective emergency leases</div><div className="mt-2 text-sm text-[var(--text)]">{effectiveLeaseCount}</div><div className="mt-1 text-xs text-[var(--text-muted)]">{pendingLeaseCount > 0 ? `${pendingLeaseCount} pending runtime application · ` : ''}{security.break_glass.length} lease record{security.break_glass.length === 1 ? '' : 's'} returned</div></div>
            </div>
            {(runtime?.layers.length ?? 0) > 0 && (
              <div className="border-t border-[var(--border)] px-4 py-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Observed runtime layers</div>
                <div className="flex flex-wrap gap-2">{runtime!.layers.map((layer, index) => <span key={`${layer.source}-${index}`} className="max-w-full rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--text-dim)]"><b>{layer.source.replaceAll('_', ' ')}</b> · <span className="break-all font-mono">{typeof layer.value === 'object' ? JSON.stringify(layer.value) : String(layer.value)}</span></span>)}</div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby={`agent-overrides-${agentId}`}>
        <div><h3 id={`agent-overrides-${agentId}`} className="m-0 text-sm font-semibold text-[var(--text)]">Agent overrides</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Protected categories stay protected. Profile extension policy decides whether a local allow rule is valid.</p></div>
        {security.rules.profile.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Inherited profile rules</div>
            <div className="space-y-2">{security.rules.profile.map((rule) => {
              const overrides = inheritedOverrides.get(rule.fingerprint) ?? [];
              const strongestRank = Math.max(
                rule.effect === 'block' ? 2 : rule.effect === 'prompt' ? 1 : 0,
                ...overrides.map((override) => override.effect === 'block' ? 2 : override.effect === 'prompt' ? 1 : 0),
              );
              return (
                <div key={rule.fingerprint} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${rule.effect === 'allow' ? 'bg-green-500/10 text-green-400' : rule.effect === 'block' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>Base · {rule.effect}</span>
                    <div className="min-w-0 flex-1"><code className="break-all text-xs text-[var(--text)]">{rule.executable_pattern}{rule.argument_matcher.value ? ` ${rule.argument_matcher.value}` : ''}</code><div className="mt-1 text-[10px] text-[var(--text-muted)]">{rule.target} · {rule.cwd_scope.replaceAll('_', ' ')} · {rule.category}</div></div>
                    <div className="flex flex-wrap gap-2">
                      {strongestRank < 1 && <Button type="button" size="sm" variant="outline" onClick={() => void tightenInheritedRule(rule.fingerprint, 'prompt')} disabled={saving}>Require prompt</Button>}
                      {strongestRank < 2 && <Button type="button" size="sm" variant="outline" onClick={() => void tightenInheritedRule(rule.fingerprint, 'block')} disabled={saving}>Block</Button>}
                    </div>
                  </div>
                  {overrides.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{overrides.map((override) => <span key={override.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-dim)]">Local {override.effect}<button type="button" aria-label={`Revoke ${override.effect} override for ${rule.executable_pattern}`} onClick={() => void revokeOverride(override.id)} disabled={saving} className="inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--error)]"><Trash2 size={11} /></button></span>)}</div>}
                </div>
              );
            })}</div>
          </div>
        )}
        {!legacy && security.inherited.profile && (
          <div className="mt-4 grid gap-2 rounded-[var(--radius-sm)] bg-[var(--card)] p-3 sm:grid-cols-[110px_minmax(120px,1fr)_minmax(140px,1fr)_auto]">
            <select aria-label="Override effect" value={newEffect} onChange={(event) => setNewEffect(event.target.value as SecurityRuleEffect)} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"><option value="block">Block</option><option value="prompt">Prompt</option>{canAllowOverrides && <option value="allow">Allow</option>}</select>
            <input aria-label="Override executable" placeholder="Executable" value={newExecutable} onChange={(event) => setNewExecutable(event.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]" />
            <input aria-label="Override argument prefix" placeholder="Argument prefix" value={newArguments} onChange={(event) => setNewArguments(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addOverride(); }} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]" />
            <Button type="button" variant="secondary" onClick={() => void addOverride()} disabled={!newExecutable.trim() || saving}><Plus size={13} />Add</Button>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {independentOverrides.length === 0 ? <div className="py-5 text-center text-sm text-[var(--text-muted)]">No independent local rules.</div> : independentOverrides.map((override) => (
            <div key={override.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-3">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${override.effect === 'allow' ? 'bg-green-500/10 text-green-400' : override.effect === 'block' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{override.effect}</span>
              <code className="min-w-0 flex-1 break-all text-xs text-[var(--text)]">{override.rule.executable_pattern}{override.rule.argument_matcher?.value ? ` ${override.rule.argument_matcher.value}` : ''}</code>
              <span className="text-[10px] text-[var(--text-muted)]">{override.source.replaceAll('_', ' ')}</span>
              <button type="button" aria-label="Revoke override" onClick={() => void revokeOverride(override.id)} disabled={saving} className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--error)]"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Runtime adapters are shown only when the API reports one. The model
          assigned to the agent never determines or labels an adapter. */}
      {adapters.length > 0 && (
        <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby={`runtime-adapters-${agentId}`}>
          <h3 id={`runtime-adapters-${agentId}`} className="m-0 text-sm font-semibold text-[var(--text)]">Runtime adapters</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Only adapters reported by Core are shown. Expand one to compare requested and observed runtime policy.</p>
          <div className="mt-3 space-y-3">{adapters.map((adapter) => <AdapterCard key={adapter.id} adapter={adapter} />)}</div>
        </section>
      )}

      {(canManageEmergencyAccess || security.break_glass.length > 0) && (
        <section className="rounded-[var(--radius-md)] border border-[color:rgba(239,68,68,.35)] bg-[color:rgba(239,68,68,.05)] p-4" aria-labelledby={`emergency-access-${agentId}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id={`emergency-access-${agentId}`} className="m-0 flex items-center gap-2 text-sm font-semibold text-[var(--error)]"><ShieldAlert size={16} />Emergency access</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">Temporary full access resolves eligible command approvals without changing the persisted base policy. Immutable protected categories remain enforced.</p>
            </div>
            {canManageEmergencyAccess && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={openBreakGlass}
                disabled={Boolean(breakGlassUnavailableReason) || breakGlassSubmitting}
                aria-describedby={`emergency-access-availability-${agentId}`}
              >
                <KeyRound size={13} />Acceso completo temporal…
              </Button>
            )}
          </div>

          {canManageEmergencyAccess && (
            <div id={`emergency-access-availability-${agentId}`} className={`mt-3 rounded-[var(--radius-sm)] p-3 text-xs ${breakGlassUnavailableReason ? 'bg-[var(--card)] text-[var(--amber)]' : 'bg-[color:rgba(34,197,94,.08)] text-[var(--text-dim)]'}`} aria-live="polite">
              {breakGlassUnavailableReason ?? `Base ${security.desired.mode} · guard healthy · máximo ${policySettings?.break_glass_max_minutes ?? '—'} minutos.`}
            </div>
          )}

          <div className="mt-3 space-y-2">
            {security.break_glass.length === 0 ? (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--text-muted)]">No emergency lease records returned.</div>
            ) : security.break_glass.map((lease) => (
              <div key={lease.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--card)] p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text)]"><Clock3 size={13} className="text-[var(--error)]" />Expires {new Date(lease.expires_at).toLocaleString()}</div>
                  <div className="mt-1 break-words text-[11px] text-[var(--text-muted)]">{BREAK_GLASS_STATUS_COPY[lease.status]} · {lease.reason} · {lease.adapter_id}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <BreakGlassLeaseState lease={lease} />
                  {canManageEmergencyAccess && breakGlassLeasePresentation(lease).revocable && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void revokeBreakGlass(lease.id)}
                      disabled={revokingLeaseId !== null}
                      aria-label={`Revocar ahora el acceso temporal que caduca ${new Date(lease.expires_at).toLocaleString()}`}
                    >
                      {revokingLeaseId === lease.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />}Revocar ahora
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {canManageEmergencyAccess && (
        <Dialog open={breakGlassOpen} onOpenChange={(open) => { setBreakGlassOpen(open); if (!open) resetBreakGlassForm(); }}>
          <DialogContent style={{ maxWidth: 560, width: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldAlert size={18} className="text-[var(--error)]" />Acceso completo temporal…</DialogTitle>
              <DialogDescription>Activa una lease excepcional y con caducidad para {agentName}.</DialogDescription>
            </DialogHeader>

            <form onSubmit={(event) => { event.preventDefault(); void submitBreakGlass(); }} className="mt-4 space-y-4">
              <div className="rounded-[var(--radius-sm)] border border-[color:rgba(239,68,68,.35)] bg-[color:rgba(239,68,68,.07)] p-3 text-xs leading-5 text-[var(--text-dim)]" role="note">
                <div className="font-semibold text-[var(--error)]">Acceso excepcional, no una nueva política</div>
                <ul className="mb-0 mt-1 list-disc space-y-1 pl-4">
                  <li>No se guarda como acceso permanente y caduca automáticamente.</li>
                  <li>No atraviesa categorías protegidas inmutables ni sus confirmaciones obligatorias.</li>
                  <li>Puedes revocarlo inmediatamente desde esta pantalla.</li>
                </ul>
              </div>

              <fieldset disabled={breakGlassSubmitting} className="border-0 p-0">
                <legend className="text-xs font-semibold text-[var(--text-dim)]">Duración · máximo {policySettings?.break_glass_max_minutes ?? '—'} minutos</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {allowedBreakGlassDurations.map((duration) => (
                    <label key={duration} className={`flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${breakGlassDuration === duration ? 'border-[var(--error)] bg-[color:rgba(239,68,68,.08)] text-[var(--text)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)]'}`}>
                      <input type="radio" name={`break-glass-duration-${agentId}`} value={duration} checked={breakGlassDuration === duration} onChange={() => setBreakGlassDuration(duration)} className="accent-[var(--error)]" />
                      {duration} min
                    </label>
                  ))}
                </div>
              </fieldset>

              <label htmlFor={`break-glass-reason-${agentId}`} className="block text-xs font-semibold text-[var(--text-dim)]">
                Motivo obligatorio
                <textarea
                  id={`break-glass-reason-${agentId}`}
                  value={breakGlassReason}
                  onChange={(event) => setBreakGlassReason(event.target.value)}
                  minLength={8}
                  maxLength={500}
                  required
                  autoFocus
                  disabled={breakGlassSubmitting}
                  aria-describedby={`break-glass-reason-help-${agentId}`}
                  className="mt-1 min-h-24 w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal text-[var(--text)] focus:border-[var(--error)] focus:outline-none"
                  placeholder="Describe por qué es necesario y qué operación se va a realizar"
                />
                <span id={`break-glass-reason-help-${agentId}`} className="mt-1 flex justify-between text-[11px] font-normal text-[var(--text-muted)]"><span>Entre 8 y 500 caracteres.</span><span>{breakGlassReason.length}/500</span></span>
              </label>

              <label htmlFor={`break-glass-pin-${agentId}`} className="block text-xs font-semibold text-[var(--text-dim)]">
                PIN de seguridad
                <input
                  id={`break-glass-pin-${agentId}`}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={breakGlassPin}
                  onChange={(event) => setBreakGlassPin(event.target.value)}
                  maxLength={128}
                  required
                  disabled={breakGlassSubmitting}
                  className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-normal text-[var(--text)] focus:border-[var(--error)] focus:outline-none"
                />
              </label>

              {breakGlassError && <div role="alert" className="rounded-[var(--radius-sm)] bg-[color:rgba(239,68,68,.1)] p-3 text-xs text-[var(--error)]">{breakGlassError}</div>}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setBreakGlassOpen(false); resetBreakGlassForm(); }} disabled={breakGlassSubmitting}>Cancelar</Button>
                <Button type="submit" variant="destructive" disabled={Boolean(breakGlassUnavailableReason) || breakGlassSubmitting || !allowedBreakGlassDurations.includes(breakGlassDuration) || breakGlassReason.trim().length < 8 || !breakGlassPin}>
                  {breakGlassSubmitting ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}Activar acceso temporal
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {showSandbox && <AgentSandboxConfig agentId={agentId} agentName={agentName} />}
    </div>
  );
}
