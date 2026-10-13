/** Append-only security-policy audit log. */

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, FileClock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { listSecurityAudit, type SecurityAuditEntry } from '@/services/security-policy.service';

const PAGE_SIZE = 25;

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Unable to display this state';
  }
}

export function SecurityAuditPanel() {
  const [rows, setRows] = useState<SecurityAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listSecurityAudit({ limit: PAGE_SIZE, offset });
      setRows(page.data ?? []);
      setTotal(page.meta?.total ?? page.data?.length ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load security audit');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><FileClock size={19} className="text-[var(--amber)]" />Security audit log</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Append-only changes to settings, profiles, agent policies, overrides and runtime reconciliation.</p></div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</Button>
      </div>
      {error && <RetryBanner severity="error" title="Audit unavailable" message={error} onRetry={() => void load()} loading={loading} />}
      {loading && rows.length === 0 ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]"><Loader2 size={15} className="animate-spin" />Loading audit events…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">No security policy events yet.</div>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]" aria-label="Security audit events">
          <div className="divide-y divide-[var(--border)]">
            {rows.map((row) => {
              const success = row.result === 'success';
              return (
                <details key={row.id} className="group p-4 open:bg-[var(--card)]">
                  <summary className="flex cursor-pointer list-none flex-wrap items-start gap-3">
                    {success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-500" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-[var(--error)]" />}
                    <div className="min-w-0 flex-1"><div className="break-words text-sm font-medium text-[var(--text)]">{row.action.replaceAll('.', ' › ')}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]"><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>{row.agent_id && <span>Agent {row.agent_id.slice(0, 8)}</span>}{row.profile_id && <span>Profile {row.profile_id.slice(0, 8)}</span>}</div></div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${success ? 'bg-green-500/10 text-green-400' : row.result === 'partial' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{row.result}</span>
                  </summary>
                  <div className="mt-4 grid gap-3 pl-7 lg:grid-cols-2">
                    <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Before</div><pre className="max-h-72 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface)] p-3 text-[11px] text-[var(--text-dim)]">{safeJson(row.before_state)}</pre></div>
                    <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">After</div><pre className="max-h-72 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface)] p-3 text-[11px] text-[var(--text-dim)]">{safeJson(row.after_state)}</pre></div>
                    <div className="lg:col-span-2"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Metadata</div><pre className="max-h-52 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface)] p-3 text-[11px] text-[var(--text-dim)]">{safeJson(row.metadata)}</pre></div>
                    <div className="text-[10px] text-[var(--text-muted)] lg:col-span-2">Correlation {row.correlation_id}</div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <span>{total === 0 ? '0 events' : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}</span>
        <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0 || loading}><ChevronLeft size={13} />Previous</Button><Button type="button" size="sm" variant="outline" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total || loading}>Next<ChevronRight size={13} /></Button></div>
      </div>
    </div>
  );
}
