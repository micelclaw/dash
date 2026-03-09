import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Play, Square, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { ServiceStatusDot } from '@/components/ui/ServiceStatusDot';
import { useServicesStore } from '@/stores/services.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { ServiceLifecycleState, HardwareProfileTier } from '@/stores/services.store';

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

// ─── Profile Badge ──────────────────────────────────────────────────

function ProfileBadge() {
  const profile = useServicesStore((s) => s.profile);
  const patchSettings = useSettingsStore((s) => s.patchSettings);

  if (!profile) return null;

  const handleChange = async (tier: HardwareProfileTier) => {
    try {
      await patchSettings({ lifecycle: { profile_override: tier } });
      await useServicesStore.getState().fetchProfile();
      await useServicesStore.getState().fetchRamBudget();
      toast.success(`Profile changed to ${tier}`);
    } catch {
      toast.error('Failed to change profile');
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[var(--text-dim)]">Profile:</span>
      <select
        value={profile.tier}
        onChange={(e) => handleChange(e.target.value as HardwareProfileTier)}
        className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
      >
        <option value="lite">Lite ({'\u2264'}6 GB)</option>
        <option value="standard">Standard (8-14 GB)</option>
        <option value="performance">Performance (16+ GB)</option>
      </select>
      <span className="text-xs text-[var(--text-dim)]">
        {profile.total_ram_mb} MB detected, {profile.budget_services_mb} MB budget
      </span>
    </div>
  );
}

// ─── Service Row ────────────────────────────────────────────────────

function ServiceRow({ service }: { service: ServiceLifecycleState }) {
  const [expanded, setExpanded] = useState(false);
  const startService = useServicesStore((s) => s.startService);
  const stopService = useServicesStore((s) => s.stopService);
  const forceStopService = useServicesStore((s) => s.forceStopService);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const settings = useSettingsStore((s) => s.settings);
  const [loading, setLoading] = useState(false);

  const lifecycleSettings = (settings as any)?.lifecycle ?? {};
  const serviceOverrides = lifecycleSettings.service_overrides ?? {};
  const override = serviceOverrides[service.name] ?? {};

  const effectiveTimeout = override.timeout_seconds
    ?? (lifecycleSettings.per_service_timeouts?.[service.name])
    ?? null;

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

  const handleTimeoutChange = async (minutes: number) => {
    try {
      const timeoutSeconds = minutes * 60;
      await patchSettings({
        lifecycle: {
          ...lifecycleSettings,
          per_service_timeouts: {
            ...lifecycleSettings.per_service_timeouts,
            [service.name]: timeoutSeconds,
          },
        },
      });
      toast.success('Timeout updated');
    } catch {
      toast.error('Failed to update timeout');
    }
  };

  const isRunning = service.state === 'running' || service.state === 'starting';
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <div className="border-b border-[var(--border)]">
      {/* Main row */}
      <div
        className="flex items-center gap-3 py-2.5 px-3 hover:bg-[var(--surface-hover)] cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <ServiceStatusDot status={service.state} size="md" />
        <span className="flex-1 text-sm text-[var(--text)]">{service.display_name}</span>
        <span className="text-xs text-[var(--text-dim)] w-20">{service.policy}</span>
        <span className="text-xs text-[var(--text-dim)] w-16 text-right">
          {service.ram_mb ? `${service.ram_mb} MB` : '—'}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
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
              disabled={loading || service.policy === 'always'}
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
            <span>Policy</span>
            <span className="text-[var(--text)]">{service.policy}</span>
            <span>RAM limit</span>
            <span className="text-[var(--text)]">{service.ram_limit_mb} MB</span>
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
            {service.error && (
              <>
                <span>Error</span>
                <span className="text-red-400">{service.error}</span>
              </>
            )}
          </div>

          {service.policy === 'ondemand' && (
            <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
              <label className="text-[var(--text-dim)]">Timeout:</label>
              <select
                value={effectiveTimeout ? String(effectiveTimeout / 60) : ''}
                onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
                className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5 text-xs text-[var(--text)]"
              >
                <option value="">Default</option>
                <option value="5">5 min</option>
                <option value="10">10 min</option>
                <option value="15">15 min</option>
                <option value="20">20 min</option>
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
              </select>
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
  const services = useServicesStore((s) => s.services);
  const loading = useServicesStore((s) => s.loading);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    fetchServices();
    fetchRamBudget();
    fetchProfile();

    // Refresh every 10s while this section is mounted
    const interval = setInterval(() => {
      fetchServices();
      fetchRamBudget();
    }, 10_000);

    return () => clearInterval(interval);
  }, [fetchServices, fetchRamBudget, fetchProfile]);

  const filtered = activeTab === 'all'
    ? services
    : services.filter((s) => s.policy === activeTab);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${services.length})` },
    { key: 'always', label: `Always-on (${services.filter((s) => s.policy === 'always').length})` },
    { key: 'ondemand', label: `On-demand (${services.filter((s) => s.policy === 'ondemand').length})` },
  ];

  return (
    <div className="space-y-6">
      <SettingSection title="Resource Profile" description="Hardware profile determines RAM budget and service limits.">
        <ProfileBadge />
      </SettingSection>

      <SettingSection title="RAM Budget" description="Live memory usage across managed Docker services.">
        <RamBudgetBar />
      </SettingSection>

      <SettingSection title="Managed Services" description="Docker services managed by the lifecycle engine. Click a row to expand configuration.">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--amber)] text-[#06060a] font-medium'
                  : 'text-[var(--text-dim)] hover:bg-[var(--surface)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
          <span className="w-2" />
          <span className="flex-1">Service</span>
          <span className="w-20">Policy</span>
          <span className="w-16 text-right">RAM</span>
          <span className="w-14" />
          <span className="w-3.5" />
        </div>

        {/* Service rows */}
        {loading && services.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-dim)]">Loading services...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-dim)]">No services found</div>
        ) : (
          filtered.map((svc) => <ServiceRow key={svc.name} service={svc} />)
        )}
      </SettingSection>

      <SettingSection title="Advanced" description="System-level lifecycle settings.">
        <AdvancedSettings />
      </SettingSection>
    </div>
  );
}

// ─── Advanced Settings ──────────────────────────────────────────────

function AdvancedSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const patchSettings = useSettingsStore((s) => s.patchSettings);

  const lifecycle = (settings as any)?.lifecycle ?? {};
  const defaultTimeout = lifecycle.default_timeout_minutes ?? 30;
  const pressureThreshold = lifecycle.ram_pressure_threshold_percent ?? 10;
  const autoEvict = lifecycle.auto_evict_on_pressure ?? true;
  const notifications = lifecycle.notifications_enabled ?? true;

  const update = async (key: string, value: unknown) => {
    try {
      await patchSettings({ lifecycle: { ...lifecycle, [key]: value } });
      toast.success('Settings saved');
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
