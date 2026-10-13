import { useVisibleSecurityPolling } from '@/hooks/useVisibleSecurityPolling';
/** Security posture overview and machine-wide owner bounds. */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { ApiError } from '@/services/api';
import { resolveObservedRuntimeHealth } from '@/services/security-policy.ui-state';
import {
  getSecurityPosture,
  listCommandProfiles,
  listRuntimeAdapters,
  updateSecuritySettings,
  type CommandProfileSummary,
  type SecurityExecMode,
  type SecurityPosture,
  type SecurityRuntimeHealth,
  type SecurityRuntimeAdapterStatus,
} from '@/services/security-policy.service';
import { useAuthStore } from '@/stores/auth.store';

const MODE_OPTIONS: Array<{ value: SecurityExecMode; label: string }> = [
  { value: 'deny', label: 'Deny command execution' },
  { value: 'allowlist', label: 'Published allowlist only' },
  { value: 'ask', label: 'Ask when a rule requires it' },
  { value: 'auto', label: 'Automatic policy decision' },
];

function SummaryCard({
  label,
  value,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'ok' | 'warn' | 'error';
  icon: typeof Bot;
}) {
  const color = tone === 'ok' ? '#22c55e' : tone === 'warn' ? '#f59e0b' : tone === 'error' ? '#ef4444' : 'var(--text-dim)';
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Icon size={14} style={{ color }} /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}

type RuntimeStatusPresentation = {
  health: SecurityRuntimeHealth;
  title: string;
  description: string;
  borderClass: string;
  iconClass: string;
  Icon: typeof CheckCircle2;
};

export function observedRuntimeHealth(posture: SecurityPosture): SecurityRuntimeHealth {
  return resolveObservedRuntimeHealth(posture.runtime);
}

function runtimeStatusPresentation(health: SecurityRuntimeHealth): RuntimeStatusPresentation {
  if (health === 'healthy') return {
    health,
    title: 'Security guard healthy',
    description: 'Core has verified live runtime enforcement. Agent pages show the exact effective policy and source layers.',
    borderClass: 'border-[color:rgba(34,197,94,.35)] bg-[color:rgba(34,197,94,.06)]',
    iconClass: 'text-green-500',
    Icon: CheckCircle2,
  };
  if (health === 'degraded') return {
    health,
    title: 'Security guard degraded',
    description: 'The guard is reachable but reports degraded enforcement. Treat affected automatic decisions as unavailable until the guard recovers.',
    borderClass: 'border-[color:rgba(245,158,11,.4)] bg-[color:rgba(245,158,11,.07)]',
    iconClass: 'text-[var(--amber)]',
    Icon: AlertTriangle,
  };
  if (health === 'unhealthy') return {
    health,
    title: 'Security guard unhealthy',
    description: 'Runtime enforcement failed its health check. Managed automatic review and temporary full access must not be considered operational.',
    borderClass: 'border-[color:rgba(239,68,68,.4)] bg-[color:rgba(239,68,68,.07)]',
    iconClass: 'text-[var(--error)]',
    Icon: ShieldAlert,
  };
  return {
    health,
    title: 'Security guard unavailable',
    description: 'Core can store desired policy, but no live guard enforcement has been verified. This is not a healthy runtime state.',
    borderClass: 'border-[color:rgba(148,163,184,.35)] bg-[color:rgba(148,163,184,.06)]',
    iconClass: 'text-[var(--text-muted)]',
    Icon: AlertTriangle,
  };
}

function adapterTone(availability: SecurityRuntimeAdapterStatus['availability']): string {
  if (availability === 'healthy' || availability === 'active') return 'border-green-500/30 text-green-400';
  if (availability === 'unavailable') return 'border-red-500/30 text-red-400';
  return 'border-amber-500/30 text-[var(--amber)]';
}

function RuntimeStatus({ posture, adapters }: { posture: SecurityPosture; adapters: SecurityRuntimeAdapterStatus[] | null }) {
  const presentation = runtimeStatusPresentation(observedRuntimeHealth(posture));
  const StatusIcon = presentation.Icon;
  const guardErrorCount = posture.runtime.guard_errors?.length ?? 0;
  return (
    <div
      className={`rounded-[var(--radius-md)] border p-4 ${presentation.borderClass}`}
      role={presentation.health === 'unhealthy' || presentation.health === 'unavailable' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <StatusIcon size={18} className={`mt-0.5 shrink-0 ${presentation.iconClass}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[var(--text)]">{presentation.title}</div>
            <span className={`rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold uppercase ${presentation.iconClass}`}>{presentation.health}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{presentation.description}</p>
          {posture.runtime.reason && (
            <code className="mt-2 block break-all text-[11px] text-[var(--text-muted)]">{posture.runtime.reason}</code>
          )}
          {posture.runtime.guard_version !== null && posture.runtime.guard_version !== undefined && (
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">Guard policy version {String(posture.runtime.guard_version)}</div>
          )}
          {guardErrorCount > 0 && (
            <div className="mt-1 text-[11px] text-[var(--error)]">{guardErrorCount} sanitized guard error{guardErrorCount === 1 ? '' : 's'} reported</div>
          )}
          {adapters && adapters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Runtime adapter availability">
              {adapters.map((adapter) => (
                <span key={adapter.id} className={`rounded-full border bg-[var(--surface)] px-2 py-1 text-[11px] ${adapterTone(adapter.availability)}`}>
                  {adapter.label ?? adapter.id} · {adapter.availability}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SecurityOverviewPanel() {
  const role = useAuthStore((state) => state.user?.role ?? 'user');
  const isOwner = role === 'owner';
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [profiles, setProfiles] = useState<CommandProfileSummary[]>([]);
  const [adapters, setAdapters] = useState<SecurityRuntimeAdapterStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [defaultMode, setDefaultMode] = useState<SecurityExecMode>('deny');
  const [maxUserMode, setMaxUserMode] = useState<SecurityExecMode>('deny');
  const [defaultProfileId, setDefaultProfileId] = useState<string>('');
  const [allowAdminBreakGlass, setAllowAdminBreakGlass] = useState(false);
  const [breakGlassMaxMinutes, setBreakGlassMaxMinutes] = useState(60);

  const observationRoot = useRef<HTMLDivElement>(null);
  const refreshObservation = useCallback(async (isCurrent: () => boolean) => {
    try {
      const observed = await getSecurityPosture();
      if (!isCurrent()) return;
      setPosture(current => current ? { ...current, runtime: observed.runtime, counts: observed.counts, recovery: observed.recovery } : current);
      setError(null);
    } catch (error) { if (!isCurrent()) return; setError(error instanceof Error ? error.message : 'Runtime refresh failed'); }
  }, []);
  useVisibleSecurityPolling(observationRoot, refreshObservation);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAdapterError(null);
    try {
      const [nextPosture, nextProfiles] = await Promise.all([
        getSecurityPosture(),
        listCommandProfiles(),
      ]);
      setPosture(nextPosture);
      setProfiles(nextProfiles);
      setDefaultMode(nextPosture.settings.default_exec_mode);
      setMaxUserMode(nextPosture.settings.max_user_exec_mode);
      setDefaultProfileId(nextPosture.settings.default_profile_id ?? '');
      setAllowAdminBreakGlass(nextPosture.settings.allow_admin_break_glass);
      setBreakGlassMaxMinutes(nextPosture.settings.break_glass_max_minutes);

      try {
        setAdapters(await listRuntimeAdapters());
      } catch (runtimeError) {
        // Runtime discovery is a separately deployed capability. A missing
        // route is expected during rollout and must not hide desired state.
        if (runtimeError instanceof ApiError && runtimeError.status === 404) {
          setAdapters(null);
        } else {
          setAdapters(null);
          setAdapterError(runtimeError instanceof Error ? runtimeError.message : 'Could not load runtime adapters');
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load security posture');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!posture || !isOwner) return;
    setSaving(true);
    try {
      const settings = await updateSecuritySettings({
        expected_revision: posture.settings.revision,
        default_exec_mode: defaultMode,
        max_user_exec_mode: maxUserMode,
        default_profile_id: defaultProfileId || null,
        allow_admin_break_glass: allowAdminBreakGlass,
        break_glass_max_minutes: breakGlassMaxMinutes,
      });
      setPosture({ ...posture, settings });
      toast.success('Security defaults saved');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save security defaults');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading && !posture) {
    return <div className="flex items-center gap-2 py-12 text-sm text-[var(--text-muted)]"><Loader2 size={16} className="animate-spin" /> Loading security posture…</div>;
  }
  if (error && !posture) {
    return <RetryBanner severity="error" title="Security unavailable" message={error} onRetry={() => void load()} loading={loading} />;
  }
  if (!posture) return null;

  const counts = posture.counts;
  return (
    <div ref={observationRoot} className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><ShieldCheck size={19} className="text-[var(--amber)]" />Security overview</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Desired policy in Core, observed runtime enforcement and items that still need reconciliation.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {error && <RetryBanner severity="warn" message={error} onRetry={() => void load()} loading={loading} />}
      {adapterError && <RetryBanner severity="warn" title="Runtime adapter inventory unavailable" message={adapterError} onRetry={() => void load()} loading={loading} />}
      {posture.recovery && <div role="status" className="rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-xs text-[var(--text-dim)]">
        Automatic recovery: {posture.recovery.enabled ? 'enabled' : 'disabled'} · waiting {Number(posture.recovery.counts.waiting_guard ?? 0) + Number(posture.recovery.counts.retry_wait ?? 0)} · recovering {posture.recovery.counts.recovering ?? 0} · manual {posture.recovery.counts.manual_required ?? 0}
      </div>}

      {(counts.legacy_unmanaged > 0 || counts.reconciliation_required > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {counts.legacy_unmanaged > 0 && (
            <div className="flex gap-3 rounded-[var(--radius-md)] border border-[color:rgba(245,158,11,.35)] bg-[color:rgba(245,158,11,.06)] p-4">
              <ShieldAlert size={18} className="shrink-0 text-[var(--amber)]" />
              <div><div className="text-sm font-semibold text-[var(--text)]">Legacy unmanaged agents</div><p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{counts.legacy_unmanaged} agent{counts.legacy_unmanaged === 1 ? '' : 's'} still need a managed execution mode and published profile.</p></div>
            </div>
          )}
          {counts.reconciliation_required > 0 && (
            <div className="flex gap-3 rounded-[var(--radius-md)] border border-[color:rgba(239,68,68,.35)] bg-[color:rgba(239,68,68,.06)] p-4">
              <Activity size={18} className="shrink-0 text-[var(--error)]" />
              <div><div className="text-sm font-semibold text-[var(--text)]">Reconciliation required</div><p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{counts.reconciliation_required} policy state{counts.reconciliation_required === 1 ? '' : 's'} differ from the last observed runtime state.</p></div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Agents" value={counts.total_agents} icon={Bot} />
        <SummaryCard label="Managed" value={counts.managed_agents} icon={ShieldCheck} tone="ok" />
        <SummaryCard label="Published profiles" value={counts.published_profiles} icon={Layers3} />
        <SummaryCard label="Active emergency leases" value={counts.active_leases} icon={AlertTriangle} tone={counts.active_leases > 0 ? 'warn' : 'neutral'} />
      </div>

      <RuntimeStatus posture={posture} adapters={adapters} />

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="security-defaults-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="security-defaults-title" className="m-0 text-sm font-semibold text-[var(--text)]">Control-plane defaults</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Owner-defined bounds apply before profile and agent overrides.</p>
          </div>
          {isOwner ? (
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" />} Save defaults
            </Button>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">Owner only</span>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-medium text-[var(--text-dim)]">Default execution mode
            <select className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" value={defaultMode} onChange={(event) => setDefaultMode(event.target.value as SecurityExecMode)} disabled={!isOwner}>
              {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--text-dim)]">Maximum mode for non-owner users
            <select className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" value={maxUserMode} onChange={(event) => setMaxUserMode(event.target.value as SecurityExecMode)} disabled={!isOwner}>
              {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--text-dim)]">Default command profile
            <select className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" value={defaultProfileId} onChange={(event) => setDefaultProfileId(event.target.value)} disabled={!isOwner}>
              <option value="">No default profile</option>
              {profiles.filter((profile) => profile.status === 'published').map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · v{profile.published_version}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--text-dim)]">Emergency access maximum
            <select className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" value={breakGlassMaxMinutes} onChange={(event) => setBreakGlassMaxMinutes(Number(event.target.value))} disabled={!isOwner}>
              {[5, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm text-[var(--text)]">
          <input type="checkbox" checked={allowAdminBreakGlass} onChange={(event) => setAllowAdminBreakGlass(event.target.checked)} disabled={!isOwner} className="mt-0.5 accent-[var(--amber)]" />
          <span>Allow administrators to request emergency access <span className="block text-xs font-normal text-[var(--text-muted)]">A PIN, reason and short expiry are still required.</span></span>
        </label>
      </section>
    </div>
  );
}
