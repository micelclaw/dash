/**
 * Legacy approval-forwarding status.
 *
 * The historical Gateway contract contains raw `to`/`account_id` values. Dash
 * deliberately treats it as unmanaged and read-only: identifiers are never
 * rendered and this module exposes no mutation controls. Secure delivery is
 * configured only through verified, opaque destination references.
 */

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeError } from '@/lib/api-errors';
import * as gatewayService from '@/services/gateway.service';

export function LegacyApprovalDeliveryStatus() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<gatewayService.LegacyApprovalsConfigStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConfig(await gatewayService.getLegacyApprovalsConfigStatus());
    } catch (loadError) {
      setError(describeError(loadError, 'Could not inspect the legacy delivery configuration'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Loading is intentionally driven by the mounted settings panel.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return (
    <section className="max-w-[700px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="delivery-destinations-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="delivery-destinations-title" className="m-0 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <ShieldCheck size={16} className="text-[var(--success)]" />Verified destinations
          </h3>
          <p className="mt-1 max-w-xl text-xs text-[var(--text-muted)]">
            New destinations must come from a verified channel binding. Raw chat, user and account identifiers cannot be edited here.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" />Inspecting delivery configuration…</div>
      ) : error ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--card)] p-3 text-xs text-[var(--error)]">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />{error}
        </div>
      ) : config ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full bg-[var(--card)] px-2 py-1 font-medium ${config.enabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
              {config.enabled ? 'Legacy forwarding enabled' : 'Legacy forwarding disabled'}
            </span>
            <span className="rounded-full bg-[var(--card)] px-2 py-1 text-[var(--text-dim)]">Mode: {config.mode || 'unknown'}</span>
          </div>

          {config.targets.length > 0 && (
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2" aria-label="Read-only legacy delivery destinations">
              {config.targets.map((target, index) => (
                <li key={`${target.channel}-${index}`} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  <div className="text-xs font-medium capitalize text-[var(--text)]">{target.channel}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">Configured legacy destination {index + 1}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--amber-dim)] bg-[var(--amber-dim)] p-3 text-xs text-[var(--text-dim)]">
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-[var(--amber)]" />
            <span>This is an unmanaged, read-only legacy configuration. Migrate it to verified destination references when secure approval delivery becomes available.</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Bookmark compatibility until `/settings/approvals-forwarding` redirects. */
export function ApprovalsForwardingSection() {
  return <LegacyApprovalDeliveryStatus />;
}
