import { useEffect } from 'react';
import { useStore } from 'zustand';
import { LoaderCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/stores/auth.store';
import { globalCodeModeStore } from '@/stores/global-code-mode.store';

export function GlobalCodeModeControl() {
  const user = useAuthStore(state => state.user);
  const { owner, observed, phase, draft, error, initialize, refresh, choose, resume } = useStore(globalCodeModeStore);
  useEffect(() => { if (user?.id) void initialize(user.id); }, [user?.id, initialize]);
  const current = owner === user?.id ? observed : null;
  const canEdit = user?.role === 'owner' || user?.role === 'admin';
  const busy = phase === 'loading' || phase === 'saving';
  const exceptions = current ? Object.values(current.overrides).reduce((sum, value) => sum + value, 0) : 0;
  return <section aria-labelledby="global-code-mode-label" aria-busy={busy} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 id="global-code-mode-label" className="m-0 text-sm font-semibold text-[var(--text)]">Code Mode</h3>
        <p id="global-code-mode-help" className="mt-1 text-xs text-[var(--text-dim)]">Use code to query and execute tools. When off, use tools without this code layer.</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Global setting. Applies to future runs; tool permissions and approvals still apply.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {busy && <LoaderCircle size={15} aria-hidden="true" className="animate-spin" />}
        {current && <><span className="text-xs text-[var(--text-dim)]">{current.state === 'off' ? 'OFF' : 'ON'}</span><Switch aria-labelledby="global-code-mode-label" aria-describedby="global-code-mode-help" checked={current.state !== 'off'} disabled={!canEdit || phase !== 'ready'} onCheckedChange={on => { void choose(on ? 'auto' : false); }} /></>}
      </div>
    </div>
    <div role="status" aria-live="polite" className="mt-2 text-xs text-[var(--text-dim)]">
      {!current && !error && 'Checking the native setting…'}
      {phase === 'saving' && 'Saving and verifying the native receipt…'}
      {current?.presence === 'absent' && 'No global value is set. OpenClaw uses automatic Code Mode; it is not OFF.'}
      {current?.presence === 'object_implicit' && 'The existing native object has no enabled value. OpenClaw treats it as OFF.'}
      {current?.state === 'forced_on' && 'The existing value is explicitly true. Reading does not change it; switching ON writes automatic mode.'}
      {exceptions > 0 && <p>{exceptions} agent or model exceptions exist. This global switch preserves them.</p>}
      {draft !== null && phase !== 'saving' && <p>Unconfirmed choice: {draft === false ? 'OFF' : 'automatic ON'}.</p>}
      {error && <p className="text-[var(--amber)]">{error}</p>}
      {phase === 'uncertain' && <p>Only a saved receipt for this attempt can confirm it. A crash before that receipt remains uncertain; refreshing never resends the change.</p>}
      {phase === 'prepared' && <button type="button" disabled={!canEdit} onClick={() => { void resume(); }} className="mt-2 rounded border px-2 py-1">Apply saved proposal</button>}
      {!canEdit && <p>Only the owner or an administrator can change this setting.</p>}
    </div>
    <button type="button" onClick={() => { void refresh(); }} disabled={busy} className="mt-2 rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50">Check attempt and observed state</button>
  </section>;
}
