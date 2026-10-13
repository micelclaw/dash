/** Platform security floors plus legacy Core action confirmation levels. */

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, LockKeyhole, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { useSensitiveInputs } from '@/hooks/use-sensitive-inputs';
import {
  listProtectedCategories,
  updateProtectedCategory,
  type ProtectedSecurityCategory,
  type SecurityFloor,
} from '@/services/security-policy.service';
import { useAuthStore } from '@/stores/auth.store';
import { useSecurityStore } from '@/stores/security.store';

const FLOOR_META: Record<SecurityFloor, { label: string; description: string; rank: number; color: string }> = {
  human_confirmation: { label: 'Human confirmation', description: 'A person must approve the action.', rank: 1, color: '#f59e0b' },
  secure_confirmation: { label: 'Secure confirmation', description: 'Approval requires PIN or password verification.', rank: 2, color: '#f97316' },
  deny: { label: 'Always deny', description: 'The action cannot be approved from the agent path.', rank: 3, color: '#ef4444' },
};

const LEVEL_LABELS = [
  { value: 0, label: 'Auto' },
  { value: 1, label: 'Logged' },
  { value: 2, label: 'Confirm' },
  { value: 3, label: 'Secure' },
];

function SecurityPinCard() {
  const config = useSecurityStore((state) => state.config);
  const fetchConfig = useSecurityStore((state) => state.fetchConfig);
  const setupPin = useSecurityStore((state) => state.setupPin);
  const removePin = useSecurityStore((state) => state.removePin);
  const [mode, setMode] = useState<'closed' | 'setup' | 'remove'>('closed');
  const [saving, setSaving] = useState(false);
  const sensitive = useSensitiveInputs(['pin', 'confirm', 'password'] as const);

  useEffect(() => { if (!config) void fetchConfig(); }, [config, fetchConfig]);

  const close = () => {
    sensitive.wipe();
    setMode('closed');
  };

  const savePin = async () => {
    const pin = sensitive.values.pin;
    if (!/^\d{4,6}$/.test(pin)) return toast.error('PIN must contain 4–6 digits');
    if (pin !== sensitive.values.confirm) return toast.error('PIN values do not match');
    if (!sensitive.values.password) return toast.error('Current password is required');
    setSaving(true);
    try {
      await setupPin(pin, sensitive.values.password);
      toast.success('Security PIN configured');
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not configure PIN');
      sensitive.wipe();
    } finally {
      setSaving(false);
    }
  };

  const deletePin = async () => {
    if (!sensitive.values.password) return toast.error('Current password is required');
    setSaving(true);
    try {
      await removePin(sensitive.values.password);
      toast.success('Security PIN removed');
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove PIN');
      sensitive.wipe();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="security-pin-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <KeyRound size={18} className="mt-0.5 shrink-0 text-[var(--amber)]" />
          <div><h3 id="security-pin-title" className="m-0 text-sm font-semibold text-[var(--text)]">Security PIN</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Required by secure-confirmation actions and emergency access.</p></div>
        </div>
        {config && mode === 'closed' && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${config.pin_configured ? 'text-green-500' : 'text-[var(--amber)]'}`}>{config.pin_configured ? 'Configured' : 'Not configured'}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode(config.pin_configured ? 'remove' : 'setup')}>{config.pin_configured ? 'Manage' : 'Set up'}</Button>
          </div>
        )}
      </div>

      {mode === 'setup' && (
        <div className="mt-4 grid max-w-lg gap-3 rounded-[var(--radius-sm)] bg-[var(--card)] p-4 sm:grid-cols-2">
          <label className="text-xs text-[var(--text-dim)]">New PIN<input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" value={sensitive.values.pin} onChange={(event) => sensitive.set('pin', event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 tracking-[.25em] text-[var(--text)]" /></label>
          <label className="text-xs text-[var(--text-dim)]">Confirm PIN<input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" value={sensitive.values.confirm} onChange={(event) => sensitive.set('confirm', event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 tracking-[.25em] text-[var(--text)]" /></label>
          <label className="text-xs text-[var(--text-dim)] sm:col-span-2">Current password<input type="password" autoComplete="current-password" {...sensitive.bind('password')} className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]" /></label>
          <div className="flex gap-2 sm:col-span-2"><Button type="button" size="sm" onClick={() => void savePin()} disabled={saving}>{saving && <Loader2 size={13} className="animate-spin" />}Save PIN</Button><Button type="button" size="sm" variant="outline" onClick={close} disabled={saving}>Cancel</Button></div>
        </div>
      )}

      {mode === 'remove' && (
        <div className="mt-4 max-w-lg rounded-[var(--radius-sm)] bg-[var(--card)] p-4">
          <p className="m-0 text-xs leading-5 text-[var(--text-dim)]">Change the PIN by removing it and setting a new one. Removing it makes secure actions unavailable until a new PIN is configured.</p>
          <label className="mt-3 block text-xs text-[var(--text-dim)]">Current password<input type="password" autoComplete="current-password" {...sensitive.bind('password')} className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]" /></label>
          <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="destructive" onClick={() => void deletePin()} disabled={saving}>{saving && <Loader2 size={13} className="animate-spin" />}Remove PIN</Button><Button type="button" size="sm" variant="outline" onClick={() => { close(); setMode('setup'); }} disabled={saving}>Change instead</Button><Button type="button" size="sm" variant="outline" onClick={close} disabled={saving}>Cancel</Button></div>
        </div>
      )}
    </section>
  );
}

function CoreActionLevels() {
  const config = useSecurityStore((state) => state.config);
  const updateConfig = useSecurityStore((state) => state.updateConfig);
  const role = useAuthStore((state) => state.user?.role ?? 'user');
  const rank: Record<string, number> = { user: 0, admin: 1, owner: 2 };

  if (!config?.operation_defaults?.length) return null;
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="core-action-levels-title">
      <h3 id="core-action-levels-title" className="m-0 text-sm font-semibold text-[var(--text)]">Core action confirmation</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Confirmation levels for native Micelclaw actions. Command execution is controlled by profiles, not by these levels.</p>
      <div className="mt-3 divide-y divide-[var(--border)]">
        {config.operation_defaults.map((operation) => {
          const editable = (rank[role] ?? 0) >= (rank[operation.edit_role] ?? 99);
          const value = config.approval_levels[operation.operation] ?? operation.default_level;
          return (
            <label key={operation.operation} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-[var(--text)]">
              <span>{operation.label}<span className="mt-0.5 block text-xs text-[var(--text-muted)]">Minimum L{operation.min_level}{!editable ? ` · requires ${operation.edit_role}` : ''}</span></span>
              <select
                value={value}
                disabled={!editable}
                onChange={async (event) => {
                  try {
                    await updateConfig({ approval_levels: { ...config.approval_levels, [operation.operation]: Number(event.target.value) } });
                    toast.success('Confirmation level updated');
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Could not update level');
                  }
                }}
                className="h-8 min-w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--text)]"
              >
                {LEVEL_LABELS.filter((level) => level.value >= operation.min_level).map((level) => <option key={level.value} value={level.value}>L{level.value} · {level.label}</option>)}
              </select>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function ProtectedActionsPanel() {
  const role = useAuthStore((state) => state.user?.role ?? 'user');
  const isOwner = role === 'owner';
  const configError = useSecurityStore((state) => state.configError);
  const configLoading = useSecurityStore((state) => state.loading);
  const fetchConfig = useSecurityStore((state) => state.fetchConfig);
  const [categories, setCategories] = useState<ProtectedSecurityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await listProtectedCategories());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load protected actions');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const changeFloor = async (category: ProtectedSecurityCategory, floor: SecurityFloor) => {
    setSavingId(category.id);
    try {
      const updated = await updateProtectedCategory(category.id, { expected_revision: category.revision, floor });
      setCategories((current) => current.map((item) => item.id === category.id ? updated : item));
      toast.success(`${category.label} updated`);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not update security floor');
      await load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><LockKeyhole size={19} className="text-[var(--amber)]" />Protected actions</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Platform floors cannot be weakened by command profiles, agent overrides or approvals.</p></div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</Button>
      </div>
      <SecurityPinCard />
      {configError && <RetryBanner severity="error" title="Core action settings unavailable" message={configError} onRetry={() => void fetchConfig()} loading={configLoading} />}
      {error && <RetryBanner severity="error" title="Protected actions unavailable" message={error} onRetry={() => void load()} loading={loading} />}
      {loading && categories.length === 0 ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]"><Loader2 size={15} className="animate-spin" />Loading protected categories…</div>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]" aria-label="Protected action categories">
          <div className="divide-y divide-[var(--border)]">
            {categories.map((category) => {
              const floor = FLOOR_META[category.floor];
              const minimumRank = FLOOR_META[category.default_floor].rank;
              return (
                <div key={category.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                  <div className="flex min-w-0 gap-3">
                    <ShieldAlert size={16} style={{ color: floor.color }} className="mt-0.5 shrink-0" />
                    <div><div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text)]">{category.label}{category.immutable && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] uppercase text-red-400">immutable</span>}</div><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{category.description}</p><code className="mt-1 block text-[10px] text-[var(--text-muted)]">{category.key}</code></div>
                  </div>
                  <label className="text-xs text-[var(--text-muted)]">Minimum decision
                    <select
                      value={category.floor}
                      disabled={!isOwner || category.immutable || savingId === category.id}
                      onChange={(event) => void changeFloor(category, event.target.value as SecurityFloor)}
                      className="mt-1 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--text)] disabled:opacity-60"
                    >
                      {(Object.keys(FLOOR_META) as SecurityFloor[]).filter((value) => FLOOR_META[value].rank >= minimumRank).map((value) => <option key={value} value={value}>{FLOOR_META[value].label}</option>)}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <CoreActionLevels />
    </div>
  );
}
