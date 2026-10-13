/** Approval reminders, expiry and external delivery. */

import { useEffect, useState } from 'react';
import { BellRing, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { useSecurityStore } from '@/stores/security.store';
import { ApprovalDeliveryDestinations } from './ApprovalDeliveryDestinations';

export function ApprovalDeliveryPanel() {
  const config = useSecurityStore((state) => state.config);
  const configError = useSecurityStore((state) => state.configError);
  const loading = useSecurityStore((state) => state.loading);
  const fetchConfig = useSecurityStore((state) => state.fetchConfig);
  const updateConfig = useSecurityStore((state) => state.updateConfig);
  const [reminder, setReminder] = useState(5);
  const [escalation, setEscalation] = useState(15);
  const [expiry, setExpiry] = useState(60);
  const [sessionIdle, setSessionIdle] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!config && !loading && !configError) void fetchConfig(); }, [config, configError, fetchConfig, loading]);
  // The legacy approval-timing endpoint and this local form have separate save
  // semantics; rehydrate the draft whenever the server snapshot changes.
  useEffect(() => {
    if (!config) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReminder(config.approval_timeouts.reminder_minutes);
    setEscalation(config.approval_timeouts.escalation_minutes);
    setExpiry(config.approval_timeouts.expiry_minutes);
    setSessionIdle(config.session_idle_minutes ?? 0);
  }, [config]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateConfig({
        approval_timeouts: {
          reminder_minutes: Math.max(1, Math.min(60, reminder)),
          escalation_minutes: Math.max(1, Math.min(120, escalation)),
          expiry_minutes: Math.max(5, Math.min(1440, expiry)),
        },
        session_idle_minutes: Math.max(0, Math.min(1440, sessionIdle)),
      });
      toast.success('Approval timing saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save approval timing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><BellRing size={19} className="text-[var(--amber)]" />Approval delivery</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">How pending approvals are reminded, escalated, expired and forwarded to connected channels.</p></div>
      {configError && <RetryBanner severity="error" title="Security timing unavailable" message={configError} onRetry={() => void fetchConfig()} loading={loading} />}
      <section className="max-w-[700px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="approval-timing-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="approval-timing-title" className="m-0 text-sm font-semibold text-[var(--text)]">Approval and session timing</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Applies to Core-managed approval notifications and authenticated Dash sessions.</p></div><Button type="button" size="sm" onClick={() => void save()} disabled={!config || saving}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save timing</Button></div>
        {!config ? loading && <div className="flex items-center gap-2 py-6 text-sm text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" />Loading security timing…</div> : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-[var(--text-dim)]">Reminder (minutes)<input type="number" min={1} max={60} value={reminder} onChange={(event) => setReminder(Number(event.target.value))} className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" /></label>
            <label className="text-xs font-medium text-[var(--text-dim)]">Escalation (minutes)<input type="number" min={1} max={120} value={escalation} onChange={(event) => setEscalation(Number(event.target.value))} className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" /></label>
            <label className="text-xs font-medium text-[var(--text-dim)]">Expiry (minutes)<input type="number" min={5} max={1440} value={expiry} onChange={(event) => setExpiry(Number(event.target.value))} className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" /></label>
            <label className="text-xs font-medium text-[var(--text-dim)]">Session idle (minutes)<input type="number" min={0} max={1440} value={sessionIdle} onChange={(event) => setSessionIdle(Number(event.target.value))} className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" /><span className="mt-1 block text-[10px] font-normal text-[var(--text-muted)]">0 disables automatic sign-out.</span></label>
          </div>
        )}
      </section>
      <ApprovalDeliveryDestinations />
    </div>
  );
}
