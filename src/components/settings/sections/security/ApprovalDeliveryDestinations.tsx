/** Secure approval delivery configured with opaque, verified destinations. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { ToggleSwitch } from '@/components/settings/shared/ToggleSwitch';
import { ApiError } from '@/services/api';
import { evaluateDeliverySelection } from '@/services/security-policy.ui-state';
import {
  getSecurityApprovalDelivery,
  updateSecurityApprovalDelivery,
  type SecurityApprovalAuthority,
  type SecurityApprovalDelivery,
} from '@/services/security-policy.service';
import { LegacyApprovalDeliveryStatus } from '../ApprovalsForwardingSection';

const AUTHORITIES: Array<{ id: SecurityApprovalAuthority; label: string }> = [
  { id: 'core_action', label: 'Micelclaw actions' },
  { id: 'openclaw_exec', label: 'Host commands' },
  { id: 'openclaw_plugin', label: 'Runtime actions' },
  { id: 'runtime_native', label: 'Runtime-native' },
  { id: 'external_mcp', label: 'External MCP' },
];

const UNAVAILABLE_REASON: Record<string, string> = {
  binding_required: 'Verify a channel binding first',
  account_binding_required: 'Vuelve a vincular este canal indicando la cuenta',
  channel_disconnected: 'Channel is disconnected',
};

function sameValues(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const expected = new Set(right);
  return left.every((value) => expected.has(value));
}

export function ApprovalDeliveryDestinations() {
  const [state, setState] = useState<'loading' | 'secure' | 'legacy' | 'error'>('loading');
  const [delivery, setDelivery] = useState<SecurityApprovalDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [destinationIds, setDestinationIds] = useState<string[]>([]);
  const [authorityFilters, setAuthorityFilters] = useState<SecurityApprovalAuthority[]>([]);

  const hydrate = useCallback((snapshot: SecurityApprovalDelivery) => {
    setDelivery(snapshot);
    setEnabled(snapshot.enabled);
    setDestinationIds(snapshot.destinations.filter((item) => item.selected).map((item) => item.id));
    setAuthorityFilters(snapshot.authority_filters);
  }, []);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const snapshot = await getSecurityApprovalDelivery();
      hydrate(snapshot);
      setState('secure');
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 404) {
        // Transitional compatibility only. The legacy surface is read-only and
        // never receives raw recipient identifiers back from this component.
        setDelivery(null);
        setState('legacy');
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Could not load approval delivery');
        setState('error');
      }
    }
  }, [hydrate]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const persistedDestinationIds = useMemo(
    () => delivery?.destinations.filter((item) => item.selected).map((item) => item.id) ?? [],
    [delivery],
  );
  const dirty = Boolean(delivery && (
    enabled !== delivery.enabled
    || !sameValues(destinationIds, persistedDestinationIds)
    || !sameValues(authorityFilters, delivery.authority_filters)
  ));
  const deliveryValidation = useMemo(() => evaluateDeliverySelection({
    enabled,
    authorityCount: authorityFilters.length,
    destinationIds,
    destinations: delivery?.destinations ?? [],
  }), [authorityFilters.length, delivery?.destinations, destinationIds, enabled]);
  const {
    availableDestinationCount,
    hasUnavailableSelection,
    invalidAuthorities,
    missingEnabledDestination,
    invalid: invalidDelivery,
  } = deliveryValidation;

  const toggleDestination = (id: string, selected: boolean) => {
    setDestinationIds((current) => selected
      ? current.includes(id) ? current : [...current, id]
      : current.filter((value) => value !== id));
  };

  const toggleAuthority = (authority: SecurityApprovalAuthority, selected: boolean) => {
    setAuthorityFilters((current) => selected
      ? current.includes(authority) ? current : [...current, authority]
      : current.filter((value) => value !== authority));
  };

  const save = async () => {
    if (!delivery || !dirty || invalidDelivery) return;
    setSaving(true);
    try {
      const updated = await updateSecurityApprovalDelivery({
        expected_revision: delivery.revision,
        enabled,
        destination_ids: destinationIds,
        authority_filters: authorityFilters,
      });
      hydrate(updated);
      toast.success('Approval delivery saved');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save approval delivery');
      if (saveError instanceof ApiError && saveError.status === 409) await load();
    } finally {
      setSaving(false);
    }
  };

  if (state === 'legacy') return <LegacyApprovalDeliveryStatus />;
  if (state === 'loading') {
    return <div className="flex max-w-[700px] items-center gap-2 py-8 text-sm text-[var(--text-muted)]"><Loader2 size={15} className="animate-spin" />Loading verified destinations…</div>;
  }
  if (state === 'error' || !delivery) {
    return <div className="max-w-[700px]"><RetryBanner severity="error" title="Approval delivery unavailable" message={error ?? 'No delivery state returned'} onRetry={() => void load()} loading={false} /></div>;
  }

  return (
    <section className="max-w-[700px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="delivery-destinations-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="delivery-destinations-title" className="m-0 flex items-center gap-2 text-sm font-semibold text-[var(--text)]"><ShieldCheck size={16} className="text-[var(--success)]" />Verified destinations</h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--text-muted)]">Dash submits only destination references issued by Core; recipient addressing is not editable here.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={saving}><RefreshCw size={13} />Refresh</Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || saving || invalidDelivery}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save delivery</Button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-[var(--radius-sm)] bg-[var(--card)] p-3">
        <div><div className="text-sm font-medium text-[var(--text)]">External approval delivery</div><div className="mt-0.5 text-xs text-[var(--text-muted)]">In-app chat, Activity Center and inbox delivery remain enabled.</div></div>
        <ToggleSwitch
          checked={enabled}
          onChange={setEnabled}
          disabled={saving || (!enabled && availableDestinationCount === 0)}
          ariaLabel="Enable external approval delivery"
        />
      </div>
      {!enabled && availableDestinationCount === 0 && (
        <p role="status" className="mt-2 text-xs text-[var(--amber)]">Connect and verify at least one channel destination before enabling external delivery.</p>
      )}
      {missingEnabledDestination && (
        <p role="alert" className="mt-2 text-xs text-[var(--error)]">Select at least one available verified destination, or turn external delivery off.</p>
      )}
      {hasUnavailableSelection && (
        <p role="alert" className="mt-2 text-xs text-[var(--error)]">Remove inactive destination selections before saving. Dash will not choose a replacement destination automatically.</p>
      )}

      <fieldset className="mt-4 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Authorities to deliver · choose at least one</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {AUTHORITIES.map((authority) => (
            <label key={authority.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-dim)]">
              <input type="checkbox" checked={authorityFilters.includes(authority.id)} onChange={(event) => toggleAuthority(authority.id, event.target.checked)} disabled={saving || (authorityFilters.length === 1 && authorityFilters.includes(authority.id))} className="accent-[var(--amber)]" />
              {authority.label}
            </label>
          ))}
        </div>
        {invalidAuthorities && <p role="alert" className="mt-2 text-xs text-[var(--error)]">Select at least one approval authority.</p>}
      </fieldset>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Verified channel bindings</legend>
        {delivery.destinations.length === 0 ? (
          <div className="mt-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--text-muted)]">No verified delivery destinations are available.</div>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {delivery.destinations.map((destination) => {
              const unavailable = destination.unavailable_reason
                ? UNAVAILABLE_REASON[destination.unavailable_reason] ?? destination.unavailable_reason
                : null;
              const selected = destinationIds.includes(destination.id);
              return (
                <div key={destination.id} className={`rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-3 ${destination.available ? '' : 'opacity-70'}`}>
                  <label className={`flex items-start gap-3 ${destination.available ? 'cursor-pointer' : ''}`}>
                    <input type="checkbox" checked={selected} onChange={(event) => toggleDestination(destination.id, event.target.checked)} disabled={!destination.available || saving} className="mt-0.5 accent-[var(--amber)]" />
                    <span className="min-w-0"><span className="block text-xs font-medium text-[var(--text)]">{destination.label}</span><span className="mt-0.5 block text-[11px] capitalize text-[var(--text-muted)]">{destination.channel}{destination.account_label ? ` · ${destination.account_label}` : ''}</span>{unavailable && <span className="mt-1 block text-[10px] text-[var(--amber)]">{unavailable}{destination.selected ? ' · previous selection is inactive' : ''}</span>}</span>
                  </label>
                  {!destination.available && selected && (
                    <button type="button" className="mt-2 text-[11px] font-medium text-[var(--amber)] underline-offset-2 hover:underline disabled:opacity-50" onClick={() => toggleDestination(destination.id, false)} disabled={saving}>
                      Remove inactive selection
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Immutable in-app delivery">
        {delivery.in_app.chat && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--success)]"><CheckCircle2 size={11} />Chat</span>}
        {delivery.in_app.activity_center && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--success)]"><CheckCircle2 size={11} />Activity Center</span>}
        {delivery.in_app.inbox && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--success)]"><CheckCircle2 size={11} />Approval inbox</span>}
      </div>

      {delivery.legacy_forwarding.state === 'unmanaged' && (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--amber-dim)] bg-[var(--amber-dim)] p-3 text-xs text-[var(--text-dim)]">
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-[var(--amber)]" />
          <span>{delivery.legacy_forwarding.reason ?? 'Legacy forwarding is enabled outside the managed security control plane.'} It remains read-only here.</span>
        </div>
      )}
    </section>
  );
}
