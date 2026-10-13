import type { SecurityRecovery } from '@/services/security-policy.service';

const labels: Record<SecurityRecovery['state'], string> = {
  waiting_guard: 'Waiting for verified guard', recovering: 'Recovering existing policy',
  retry_wait: 'Automatic recovery will retry', manual_required: 'Manual reconciliation required',
  recovered: 'Policy recovered automatically', superseded: 'Recovery superseded',
};
export function SecurityRecoveryStatus({ recovery }: { recovery?: SecurityRecovery | null }) {
  if (!recovery) return null;
  return <div role="status" aria-live="polite" className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] p-3 text-xs text-[var(--text-dim)]">
    <div className="font-medium">{labels[recovery.state]}</div>
    <div className="mt-1">Cause: {recovery.cause.replaceAll('_', ' ').toLowerCase()}</div>
    {recovery.next_attempt_at && <div className="mt-1">Next attempt: {new Date(recovery.next_attempt_at).toLocaleTimeString()}</div>}
    {recovery.last_error && <div className="mt-1">{recovery.last_error.replaceAll('_', ' ').toLowerCase()}</div>}
  </div>;
}
