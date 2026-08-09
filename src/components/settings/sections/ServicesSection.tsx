/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Play, Square, RotateCcw, ChevronDown, ChevronUp, Cpu, MemoryStick } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { ServiceStatusDot } from '@/components/ui/ServiceStatusDot';
import { useServicesStore } from '@/stores/services.store';
import { HARDWARE_PROFILE_TIERS } from '@/stores/services.store';
import type {
  ServiceLifecycleState,
  HardwareProfileTier,
  LifecyclePolicy,
  ResourcePriorityClass,
  ResourcePolicyPatch,
} from '@/stores/services.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';

// ─── RAM Budget Bar ─────────────────────────────────────────────────

function RamBudgetBar() {
  const ramBudget = useServicesStore((s) => s.ramBudget);

  if (!ramBudget) return null;

  const pct = ramBudget.total_budget_mb > 0
    ? Math.round((ramBudget.used_mb / ramBudget.total_budget_mb) * 100)
    : 0;

  const barColor = pct > 85
    ? 'bg-red-500'
    : pct > 60
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[var(--text-dim)] mb-1">
        <span>RAM Usage</span>
        <span>{ramBudget.used_mb} / {ramBudget.total_budget_mb} MB ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {ramBudget.running_services.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ramBudget.running_services.map((s) => (
            <span key={s.name} className="text-[10px] text-[var(--text-dim)] bg-[var(--surface)] px-1.5 py-0.5 rounded">
              {s.name} {s.ram_mb} MB
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type MemoryIncident = {
  at: string;
  trigger: string;
  memory: { available_mb: number; file_cache_mb: number };
  cgroups: Array<{ path: string; current_mb: number }>;
  processes: Array<{ pid: number; rss_mb: number; pss_mb: number; command: string }>;
  containers: Array<{ name: string; memory: string; unlimited: boolean }>;
  lifecycle?: { action: string; service?: string };
};

type MemoryReport = {
  latest: MemoryIncident | null;
  timeline: Array<Pick<MemoryIncident, 'at' | 'trigger' | 'memory' | 'lifecycle'>>;
};

function MemoryIncidentCard() {
  const [report, setReport] = useState<MemoryReport>({ latest: null, timeline: [] });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get<{ data: MemoryReport }>('/system/memory-observer/report');
        if (active) setReport(res.data);
      } catch { /* observer may not be available during a rolling Core update */ }
    };
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const incident = report.latest;
  if (!incident) return <p className="text-xs text-[var(--text-dim)]">Waiting for the first memory sample…</p>;
  const top = incident.cgroups.slice(0, 3);
  const processes = incident.processes?.slice(0, 5) ?? [];
  const unlimited = incident.containers?.filter((container) => container.unlimited) ?? [];
  return (
    <div className="space-y-2 text-xs">
      <div className="flex justify-between text-[var(--text-dim)]">
        <span>Last sample: {new Date(incident.at).toLocaleString()}</span>
        <span className={incident.trigger === 'critical' ? 'text-red-400' : incident.trigger === 'warning' ? 'text-amber-400' : ''}>{incident.trigger}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[var(--text-dim)]">
        <span className="bg-[var(--surface)] px-1.5 py-0.5 rounded">available {incident.memory.available_mb} MB</span>
        <span className="bg-[var(--surface)] px-1.5 py-0.5 rounded">cache {incident.memory.file_cache_mb} MB</span>
        {incident.lifecycle && <span className="bg-red-500/10 text-red-300 px-1.5 py-0.5 rounded">{incident.lifecycle.action}: {incident.lifecycle.service ?? 'service'}</span>}
      </div>
      {top.length > 0 && <p className="text-[var(--text-dim)]">Largest cgroups: {top.map((c) => `${c.path || '/'} ${c.current_mb} MB`).join(' · ')}</p>}
      {processes.length > 0 && <p className="text-[var(--text-dim)]">Largest processes (PSS): {processes.map((p) => `${p.command.split(' ')[0]} ${p.pss_mb || p.rss_mb} MB`).join(' · ')}</p>}
      {unlimited.length > 0 && <p className="text-red-400">Containers without an effective limit: {unlimited.map((container) => container.name).join(', ')}</p>}
      {report.timeline.length > 0 && (
        <div className="border-t border-[var(--border)] pt-2 space-y-1">
          <p className="text-[var(--text-dim)]">Incident timeline</p>
          {report.timeline.slice(-5).map((event) => (
            <p key={`${event.at}-${event.trigger}`} className="text-[10px] text-[var(--text-muted)]">
              {new Date(event.at).toLocaleString()} · {event.trigger} · available {event.memory.available_mb} MB{event.lifecycle ? ` · ${event.lifecycle.action} ${event.lifecycle.service ?? ''}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile Badge ──────────────────────────────────────────────────

function ProfileBadge() {
  const resources = useServicesStore((s) => s.resources);
  const planResources = useServicesStore((s) => s.planResources);
  const applyResourcePlan = useServicesStore((s) => s.applyResourcePlan);
  const user = useAuthStore((s) => s.user);
  const [targetProfile, setTargetProfile] = useState<HardwareProfileTier | null>(null);
  const [cpu, setCpu] = useState<number | null>(null);
  const [planning, setPlanning] = useState(false);
  const plan = useServicesStore((s) => s.resourcePlan);
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  if (!resources) return <p className="text-xs text-[var(--text-dim)]">Loading host resources…</p>;

  const requestPlan = async (tier: HardwareProfileTier, selectedCpu = cpu ?? resources.host.configured_processors) => {
    setTargetProfile(tier);
    setPlanning(true);
    try {
      await planResources(tier, selectedCpu);
    } catch (err: any) {
      setTargetProfile(null);
      toast.error(err?.message ?? 'Could not create the resource plan');
    } finally {
      setPlanning(false);
    }
  };

  const confirmPlan = async (restartNow: boolean) => {
    if (!plan) return;
    try {
      await applyResourcePlan(plan.id, restartNow);
      setTargetProfile(null);
      toast.success(restartNow ? 'Resource change accepted; the VM will restart' : 'Lifecycle profile applied; host restart remains pending if required');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to apply resource plan');
    }
  };

  const platformLabel = resources.platform === 'wsl2' ? 'WSL2' : resources.platform === 'mac-vm' ? 'Mac VM' : resources.platform === 'bare-metal' ? 'Bare metal' : resources.platform;
  const configuredGb = resources.host.configured_ram_mb ? Math.round(resources.host.configured_ram_mb / 1024) : null;
  const recommendedGb = Math.round(resources.profile.recommended_vm_ram_mb / 1024);

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div><span className="text-[var(--text-dim)]">Platform</span><p className="text-[var(--text)] mt-1">{platformLabel}</p></div>
        <div><span className="text-[var(--text-dim)]">Host hardware</span><p className="text-[var(--text)] mt-1">{Math.round(resources.hardware.host_total_ram_mb / 1024)} GB · {resources.hardware.host_logical_cpus} CPU</p></div>
        <div><span className="text-[var(--text-dim)]">Lifecycle profile</span><p className="text-[var(--text)] mt-1">{resources.profile.effective.replace('gb', ' GB')}</p></div>
        <div><span className="text-[var(--text-dim)]">Reconciliation</span><p className="text-amber-400 mt-1">{resources.host.reconciliation}</p></div>
      </div>

      {resources.capabilities.vm_resources && (
        <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
          <div className="flex items-center gap-2"><MemoryStick className="h-4 w-4" /><span>VM resources</span></div>
          <p className="text-xs text-[var(--text-dim)]">
            Recommended: {recommendedGb} GB · Applied: {configuredGb ?? 'unknown'} GB · Swap: {resources.host.configured_swap_mb ? `${Math.round(resources.host.configured_swap_mb / 1024)} GB` : 'unknown'}
          </p>
          {resources.host.mode === 'external' && (
            <p className="text-xs text-amber-400">Recognized external exception: {configuredGb ?? '—'} GB; Lifecycle recommendation: {recommendedGb} GB. Micelclaw will not overwrite it.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[var(--text-dim)]">Profile:</label>
        <select
          value={targetProfile ?? resources.profile.desired}
          disabled={!isAdmin || planning}
          onChange={(e) => void requestPlan(e.target.value as HardwareProfileTier)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
        >
          {HARDWARE_PROFILE_TIERS.map((tier) => {
            const option = resources.profile.available.find((row) => row.tier === tier);
            return <option key={tier} value={tier} disabled={!option?.enabled}>{tier.replace('gb', ' GB')}{option?.enabled === false ? ' — unavailable' : ''}</option>;
          })}
        </select>
        {resources.capabilities.cpu_limit && (
          <label className="flex items-center gap-2 text-[var(--text-dim)]"><Cpu className="h-4 w-4" />CPU:
            <select
              value={cpu ?? resources.host.configured_processors}
              disabled={!isAdmin || planning}
              onChange={(e) => {
                const next = Number(e.target.value);
                setCpu(next);
                void requestPlan(targetProfile ?? resources.profile.desired, next);
              }}
              className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
            >
              {Array.from({ length: resources.hardware.host_logical_cpus }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}
        {!isAdmin && <span className="text-xs text-[var(--text-dim)]">Read-only for non-administrators</span>}
      </div>

      {plan && targetProfile && (
        <div role="dialog" aria-modal="true" className="rounded border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <p className="font-medium">Profile {resources.profile.effective.replace('gb', ' GB')} → {plan.profile.replace('gb', ' GB')}</p>
          <div className="text-xs text-[var(--text-dim)] space-y-1">
            <p>Will stop: {plan.services_to_stop.length ? plan.services_to_stop.join(', ') : 'none'}</p>
            <p>Will block: {plan.services_blocked.length ? plan.services_blocked.join(', ') : 'none'}</p>
            <p>Will preserve: {plan.services_preserved.length ? plan.services_preserved.join(', ') : 'none'}</p>
            {plan.requires_vm_restart && <p className="text-amber-400">The VM resource change requires a separate explicit restart. Running WSL distributions: {plan.affected_wsl_distros.join(', ') || 'none detected'}.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setTargetProfile(null)} className="px-3 py-1.5 rounded border border-[var(--border)] text-xs">Cancel</button>
            <button onClick={() => void confirmPlan(false)} className="px-3 py-1.5 rounded bg-amber-500 text-black text-xs font-medium">Apply profile only</button>
            {plan.requires_vm_restart && (
              <button onClick={() => void confirmPlan(true)} className="px-3 py-1.5 rounded bg-red-500 text-white text-xs font-medium">
                Confirm and restart {resources.platform === 'wsl2' ? 'all WSL' : 'VM'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Service Row ────────────────────────────────────────────────────

const POLICY_LABELS: Record<LifecyclePolicy, string> = {
  always: 'Always On',
  ondemand: 'On Demand',
  scheduled: 'Scheduled',
};

const PRIORITY_LABELS: Record<ResourcePriorityClass, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

const PRIORITY_CLASSES: Record<ResourcePriorityClass, string> = {
  critical: 'text-red-400 border-red-500/30 bg-red-500/10',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  normal: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ServiceRow({
  service,
  selected,
  editable,
  onSelectedChange,
}: {
  service: ServiceLifecycleState;
  selected: boolean;
  editable: boolean;
  onSelectedChange: (selected: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const startService = useServicesStore((s) => s.startService);
  const stopService = useServicesStore((s) => s.stopService);
  const forceStopService = useServicesStore((s) => s.forceStopService);
  const updatePolicy = useServicesStore((s) => s.updatePolicy);
  const updateResourcePolicy = useServicesStore((s) => s.updateResourcePolicy);
  const [loading, setLoading] = useState(false);
  const effectiveTimeout = service.timeout_seconds;

  // Schedule state for the config sub-UI
  const [scheduleType, setScheduleType] = useState<'window' | 'interval'>(service.schedule?.type ?? 'window');
  const [windowDays, setWindowDays] = useState<number[]>(service.schedule?.windows?.[0]?.days ?? [1, 2, 3, 4, 5, 6, 0]);
  const [windowStart, setWindowStart] = useState(service.schedule?.windows?.[0]?.start_time ?? '08:00');
  const [windowEnd, setWindowEnd] = useState(service.schedule?.windows?.[0]?.end_time ?? '00:00');
  const [intervalEvery, setIntervalEvery] = useState(service.schedule?.interval_every_minutes ?? 120);
  const [intervalOn, setIntervalOn] = useState(service.schedule?.interval_on_minutes ?? 10);

  const handleStart = async () => {
    setLoading(true);
    try {
      await startService(service.name);
      toast.success(`${service.display_name} started`);
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to start ${service.display_name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      if (service.state === 'draining') {
        await forceStopService(service.name);
      } else {
        await stopService(service.name);
      }
      toast.success(`${service.display_name} stopped`);
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to stop ${service.display_name}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyChange = async (newPolicy: string) => {
    setLoading(true);
    try {
      if (newPolicy === 'scheduled-window' || newPolicy === 'scheduled-interval') {
        const sType = newPolicy === 'scheduled-window' ? 'window' : 'interval';
        setScheduleType(sType);
        const schedule = sType === 'window'
          ? { type: 'window' as const, windows: [{ days: windowDays, start_time: windowStart, end_time: windowEnd }] }
          : { type: 'interval' as const, interval_every_minutes: intervalEvery, interval_on_minutes: intervalOn };
        await updatePolicy(service.name, 'scheduled', schedule);
      } else {
        await updatePolicy(service.name, newPolicy as LifecyclePolicy);
      }
      if (selected) onSelectedChange(false);
      toast.success(`${service.display_name} policy updated`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update policy');
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (priority: Exclude<ResourcePriorityClass, 'critical'>) => {
    setLoading(true);
    try {
      await updateResourcePolicy(service.name, { priority_class: priority });
      toast.success(`${service.display_name} priority updated`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update priority');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleSave = async () => {
    try {
      const schedule = scheduleType === 'window'
        ? { type: 'window' as const, windows: [{ days: windowDays, start_time: windowStart, end_time: windowEnd }] }
        : { type: 'interval' as const, interval_every_minutes: intervalEvery, interval_on_minutes: intervalOn };
      await updatePolicy(service.name, 'scheduled', schedule);
      toast.success('Schedule updated');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update schedule');
    }
  };

  const toggleDay = (day: number) => {
    setWindowDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const isRunning = service.state === 'running' || service.state === 'starting';
  const ramPercent = service.ram_mb !== null && service.ram_limit_mb > 0
    ? Math.round((service.ram_mb / service.ram_limit_mb) * 100)
    : 0;
  const isNearLimit = service.state === 'running' && ramPercent >= 80;
  const stateIndicator = !service.installed
    ? { color: 'bg-slate-500', label: 'Not installed' }
    : service.setup_hint
      ? { color: undefined, label: `Needs setup: ${service.setup_hint}` }
      : isNearLimit
        ? { color: 'bg-orange-500', label: `Near RAM limit (${ramPercent}%)` }
        : service.state === 'running'
          ? { color: undefined, label: 'Running' }
          : service.state === 'starting' || service.state === 'draining'
            ? { color: undefined, label: service.state === 'starting' ? 'Starting' : 'Stopping' }
            : { color: 'bg-red-500', label: service.state === 'failed' ? 'Failed' : 'Stopped' };
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;

  // Map policy to select value
  const policySelectValue = service.policy === 'scheduled'
    ? `scheduled-${service.schedule?.type ?? scheduleType}`
    : service.policy;

  return (
    <div className="border-b border-[var(--border)]">
      {/* Main row */}
      <div
        className={`flex items-center gap-3 py-2.5 px-3 hover:bg-[var(--surface-hover)] cursor-pointer ${selected ? 'bg-amber-500/5' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 flex justify-center" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            disabled={!editable}
            onChange={(event) => onSelectedChange(event.target.checked)}
            aria-label={`Select ${service.display_name}`}
            className="h-3.5 w-3.5 accent-amber-500 disabled:opacity-30"
          />
        </span>
        <span className="flex-1 text-sm text-[var(--text)]">
          {service.display_name}
          {service.setup_hint && (
            <span className="ml-2 text-xs text-amber-500">Needs setup</span>
          )}
        </span>
        <span className="w-28" onClick={(event) => event.stopPropagation()}>
          <select
            value={policySelectValue}
            disabled={!editable || loading}
            onChange={(event) => void handlePolicyChange(event.target.value)}
            aria-label={`${service.display_name} policy`}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
          >
            <option value="always">{POLICY_LABELS.always}</option>
            <option value="ondemand">{POLICY_LABELS.ondemand}</option>
            <option value="scheduled-window">Scheduled (Window)</option>
            <option value="scheduled-interval">Scheduled (Interval)</option>
          </select>
        </span>
        <span className="w-24" onClick={(event) => event.stopPropagation()}>
          <select
            value={service.priority_class}
            disabled={!editable || loading}
            onChange={(event) => void handlePriorityChange(event.target.value as Exclude<ResourcePriorityClass, 'critical'>)}
            aria-label={`${service.display_name} priority`}
            className={`w-full border rounded px-2 py-1 text-xs font-medium disabled:opacity-60 ${PRIORITY_CLASSES[service.priority_class]}`}
          >
            {service.priority_class === 'critical' && <option value="critical">{PRIORITY_LABELS.critical}</option>}
            {(['high', 'normal', 'low'] as const).map((priority) => (
              <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
            ))}
          </select>
        </span>
        <span className={`text-xs w-52 text-right tabular-nums ${isNearLimit ? 'text-orange-400 font-medium' : 'text-[var(--text-dim)]'}`}>
          {service.ram_mb !== null ? service.ram_mb : '\u2014'} / {service.ram_reservation_mb} / {service.ram_limit_mb} MB
        </span>
        <span className="w-12 flex justify-center">
          <ServiceStatusDot
            status={service.state}
            needsSetup={Boolean(service.setup_hint)}
            size="md"
            className={stateIndicator.color}
            title={stateIndicator.label}
          />
        </span>

        {/* Action buttons */}
        <div className="w-14 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!isRunning && service.state !== 'starting' && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-dim)] hover:text-emerald-500 disabled:opacity-50"
              title="Start"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {(isRunning || service.state === 'draining') && (
            <button
              onClick={handleStop}
              disabled={loading}
              className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-dim)] hover:text-red-500 disabled:opacity-50"
              title={service.state === 'draining' ? 'Force Stop' : 'Stop'}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          {service.state === 'failed' && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-dim)] hover:text-amber-500 disabled:opacity-50"
              title="Restart"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <ChevronIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-[var(--surface)] text-xs space-y-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[var(--text-dim)]">
            <span>RAM limit</span>
            <span className="text-[var(--text)]">{service.ram_limit_mb} MB</span>
            <span>RAM preset</span>
            <span className="text-[var(--text)]">{service.ram_reservation_mb} / {service.ram_limit_mb} MB</span>
            <span>Limit enforcement</span>
            <span className={service.resource_status?.state === 'applied' ? 'text-emerald-400' : service.resource_status?.state === 'drift' || service.resource_status?.state === 'error' ? 'text-red-400' : 'text-amber-400'}>
              {service.resource_status?.state ?? 'pending'}
            </span>
            <span>Category</span>
            <span className="text-[var(--text)]">{service.category}</span>
            <span>Tier</span>
            <span className="text-[var(--text)]">{service.tier}</span>
            {service.state === 'running' && (
              <>
                <span>Idle</span>
                <span className="text-[var(--text)]">{formatDuration(service.idle_seconds)}</span>
                {service.timeout_remaining_seconds !== null && service.timeout_remaining_seconds > 0 && (
                  <>
                    <span>Timeout in</span>
                    <span className="text-[var(--text)]">{formatDuration(service.timeout_remaining_seconds)}</span>
                  </>
                )}
              </>
            )}
            {service.setup_hint ? (
              // El servicio corre pero no sirve: `error` repite esta misma
              // frase, así que se muestra UNA vez y como lo que es (algo que
              // el operador tiene que hacer), no como un fallo del servicio.
              <>
                <span>Setup</span>
                <span className="text-amber-500">{service.setup_hint}</span>
              </>
            ) : service.error && (
              <>
                <span>Error</span>
                <span className="text-red-400">{service.error}</span>
              </>
            )}
          </div>

          {/* Closed preset: visible for diagnosis, not manually editable per service. */}
          {service.policy === 'ondemand' && (
            <div className="space-y-1 text-[var(--text-dim)]">
              <p>Auto-stop preset: {effectiveTimeout ? formatDuration(effectiveTimeout) : 'global default'}</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                Numeric service limits are managed by the Lifecycle preset.
              </p>
            </div>
          )}

          {/* Schedule config — Window */}
          {service.policy === 'scheduled' && scheduleType === 'window' && (
            <div className="space-y-2 pt-1 border-t border-[var(--border)]">
              <div className="flex items-center gap-1">
                <label className="text-[var(--text-dim)] w-12">Days:</label>
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        windowDays.includes(i)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-transparent border-[var(--border)] text-[var(--text-dim)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[var(--text-dim)] w-12">From:</label>
                <input
                  type="time"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5 text-xs text-[var(--text)]"
                />
                <label className="text-[var(--text-dim)]">To:</label>
                <input
                  type="time"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5 text-xs text-[var(--text)]"
                />
              </div>
              <button
                onClick={handleScheduleSave}
                className="px-3 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30 text-[11px]"
              >
                Save Schedule
              </button>
            </div>
          )}

          {/* Schedule config — Interval */}
          {service.policy === 'scheduled' && scheduleType === 'interval' && (
            <div className="space-y-2 pt-1 border-t border-[var(--border)]">
              <div className="flex items-center gap-2">
                <label className="text-[var(--text-dim)]">Run every</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={intervalEvery}
                  onChange={(e) => setIntervalEvery(parseInt(e.target.value) || 120)}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5 text-xs text-[var(--text)] w-16"
                />
                <span className="text-[var(--text-dim)]">min, run for</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={intervalOn}
                  onChange={(e) => setIntervalOn(parseInt(e.target.value) || 10)}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5 text-xs text-[var(--text)] w-16"
                />
                <span className="text-[var(--text-dim)]">min</span>
              </div>
              <button
                onClick={handleScheduleSave}
                className="px-3 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30 text-[11px]"
              >
                Save Schedule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ─── Filter tabs ────────────────────────────────────────────────────

type FilterTab = 'all' | 'always' | 'ondemand' | 'scheduled';

// ─── Main Section ───────────────────────────────────────────────────

export function ServicesSection() {
  const fetchServices = useServicesStore((s) => s.fetchServices);
  const fetchRamBudget = useServicesStore((s) => s.fetchRamBudget);
  const fetchProfile = useServicesStore((s) => s.fetchProfile);
  const fetchResources = useServicesStore((s) => s.fetchResources);
  const updateResourcePolicies = useServicesStore((s) => s.updateResourcePolicies);
  const services = useServicesStore((s) => s.services);
  const loading = useServicesStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [bulkPolicy, setBulkPolicy] = useState<'' | Exclude<LifecyclePolicy, 'scheduled'>>('');
  const [bulkPriority, setBulkPriority] = useState<'' | Exclude<ResourcePriorityClass, 'critical'>>('');
  const [applyingBulk, setApplyingBulk] = useState(false);
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    fetchServices();
    fetchRamBudget();
    fetchProfile();
    fetchResources();

    // Refresh every 10s while this section is mounted
    const interval = setInterval(() => {
      fetchServices();
      fetchRamBudget();
      fetchResources();
    }, 10_000);

    return () => clearInterval(interval);
  }, [fetchServices, fetchRamBudget, fetchProfile, fetchResources]);

  const filtered = activeTab === 'all'
    ? services
    : services.filter((s) => s.policy === activeTab);
  const selectableFiltered = filtered.filter((service) => service.priority_class !== 'critical');
  const allVisibleSelected = selectableFiltered.length > 0
    && selectableFiltered.every((service) => selectedNames.has(service.name));
  const someVisibleSelected = selectableFiltered.some((service) => selectedNames.has(service.name));

  const toggleSelection = (name: string, selected: boolean) => {
    setSelectedNames((current) => {
      const next = new Set(current);
      if (selected) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const toggleAllVisible = (selected: boolean) => {
    setSelectedNames((current) => {
      const next = new Set(current);
      selectableFiltered.forEach((service) => {
        if (selected) next.add(service.name);
        else next.delete(service.name);
      });
      return next;
    });
  };

  const applyBulkChanges = async () => {
    if (selectedNames.size === 0 || (!bulkPolicy && !bulkPriority)) return;
    const patch: ResourcePolicyPatch = {};
    if (bulkPolicy) patch.lifecycle = bulkPolicy;
    if (bulkPriority) patch.priority_class = bulkPriority;

    setApplyingBulk(true);
    try {
      const result = await updateResourcePolicies([...selectedNames], patch);
      if (result.failed.length === 0) {
        toast.success(`${result.updated.length} services updated`);
        setSelectedNames(new Set());
        setBulkPolicy('');
        setBulkPriority('');
      } else {
        setSelectedNames(new Set(result.failed.map((failure) => failure.name)));
        toast.error(
          `${result.updated.length} updated; ${result.failed.length} failed: ${result.failed.map((failure) => failure.name).join(', ')}`,
        );
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update selected services');
    } finally {
      setApplyingBulk(false);
    }
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${services.length})` },
    { key: 'always', label: `Always-on (${services.filter((s) => s.policy === 'always').length})` },
    { key: 'ondemand', label: `On-demand (${services.filter((s) => s.policy === 'ondemand').length})` },
    { key: 'scheduled', label: `Scheduled (${services.filter((s) => s.policy === 'scheduled').length})` },
  ];

  return (
    <div className="space-y-6">
      <SettingSection title="Resource Profile" description="Hardware profile determines RAM budget and service limits.">
        <ProfileBadge />
      </SettingSection>

      <SettingSection title="RAM Budget" description="Live memory usage across managed Docker services.">
        <RamBudgetBar />
      </SettingSection>

      <SettingSection title="Memory Incident Monitor" description="Persistent evidence captured before Lifecycle evicts a service or WSL runs out of memory.">
        <MemoryIncidentCard />
      </SettingSection>

      <SettingSection title="Managed Services" description="Edit policy and priority directly, or select multiple services to update them together.">
        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedNames(new Set());
              }}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--amber)] text-[#06060a] font-medium'
                  : 'text-[var(--text-dim)] hover:bg-[var(--surface)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {!isAdmin && <span className="ml-auto text-xs text-[var(--text-dim)]">Read-only for non-administrators</span>}
        </div>

        {selectedNames.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <span className="text-xs font-medium text-amber-400">{selectedNames.size} selected</span>
            <select
              value={bulkPolicy}
              disabled={applyingBulk}
              onChange={(event) => setBulkPolicy(event.target.value as typeof bulkPolicy)}
              aria-label="Policy for selected services"
              className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
            >
              <option value="">Policy…</option>
              <option value="always">{POLICY_LABELS.always}</option>
              <option value="ondemand">{POLICY_LABELS.ondemand}</option>
            </select>
            <select
              value={bulkPriority}
              disabled={applyingBulk}
              onChange={(event) => setBulkPriority(event.target.value as typeof bulkPriority)}
              aria-label="Priority for selected services"
              className={`border rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${bulkPriority ? PRIORITY_CLASSES[bulkPriority] : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text)]'}`}
            >
              <option value="">Priority…</option>
              {(['high', 'normal', 'low'] as const).map((priority) => (
                <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
              ))}
            </select>
            <button
              onClick={() => void applyBulkChanges()}
              disabled={applyingBulk || (!bulkPolicy && !bulkPriority)}
              className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applyingBulk ? 'Applying…' : `Apply to ${selectedNames.size}`}
            </button>
            <button
              onClick={() => setSelectedNames(new Set())}
              disabled={applyingBulk}
              className="px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-50"
            >
              Clear
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">Scheduled requires an individual schedule.</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Table header */}
            <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
              <span className="w-4 flex justify-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }}
                  disabled={!isAdmin || selectableFiltered.length === 0}
                  onChange={(event) => toggleAllVisible(event.target.checked)}
                  aria-label="Select all editable services in this tab"
                  className="h-3.5 w-3.5 accent-amber-500 disabled:opacity-30"
                />
              </span>
              <span className="flex-1">Service</span>
              <span className="w-28">Policy</span>
              <span className="w-24">Priority</span>
              <span className="w-52 text-right">Used / Reserved / Limit</span>
              <span className="w-12 text-center">State</span>
              <span className="w-14" />
              <span className="w-3.5" />
            </div>

            {/* Service rows */}
            {loading && services.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--text-dim)]">Loading services...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--text-dim)]">No services found</div>
            ) : (
              filtered.map((service) => (
                <ServiceRow
                  key={service.name}
                  service={service}
                  selected={selectedNames.has(service.name)}
                  editable={isAdmin && service.priority_class !== 'critical'}
                  onSelectedChange={(selected) => toggleSelection(service.name, selected)}
                />
              ))
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pt-3 text-[10px] text-[var(--text-muted)]">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Running</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" />RAM ≥ 80% of limit</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Stopped or failed</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Starting, stopping or setup required</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />Not installed</span>
            </div>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Advanced" description="System-level lifecycle settings.">
        <AdvancedSettings />
      </SettingSection>
    </div>
  );
}

// ─── Advanced Settings ──────────────────────────────────────────────

function AdvancedSettings() {
  const resources = useServicesStore((s) => s.resources);
  const updateGlobalSettings = useServicesStore((s) => s.updateGlobalSettings);
  const global = resources?.settings;
  const defaultTimeout = global?.default_timeout_minutes ?? 30;
  const pressureThreshold = global?.ram_pressure_threshold_percent ?? 10;
  const autoEvict = global?.auto_evict_on_pressure ?? true;
  const notifications = global?.notifications_enabled ?? true;

  const update = async (key: keyof NonNullable<typeof global>, value: number | boolean) => {
    try {
      await updateGlobalSettings({ [key]: value });
      toast.success('Services saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-dim)]">Default idle timeout</span>
        <select
          value={String(defaultTimeout)}
          onChange={(e) => update('default_timeout_minutes', parseInt(e.target.value))}
          className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
        >
          <option value="5">5 min</option>
          <option value="10">10 min</option>
          <option value="15">15 min</option>
          <option value="20">20 min</option>
          <option value="30">30 min</option>
          <option value="60">1 hour</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[var(--text-dim)]">RAM pressure threshold</span>
        <select
          value={String(pressureThreshold)}
          onChange={(e) => update('ram_pressure_threshold_percent', parseInt(e.target.value))}
          className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
        >
          <option value="5">5% free</option>
          <option value="10">10% free</option>
          <option value="15">15% free</option>
          <option value="20">20% free</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-[var(--text-dim)]">Auto-evict on pressure</label>
        <button
          onClick={() => update('auto_evict_on_pressure', !autoEvict)}
          className={`px-3 py-1 text-xs rounded ${
            autoEvict
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-[var(--surface)] text-[var(--text-dim)]'
          }`}
        >
          {autoEvict ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-[var(--text-dim)]">Lifecycle notifications</label>
        <button
          onClick={() => update('notifications_enabled', !notifications)}
          className={`px-3 py-1 text-xs rounded ${
            notifications
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-[var(--surface)] text-[var(--text-dim)]'
          }`}
        >
          {notifications ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
