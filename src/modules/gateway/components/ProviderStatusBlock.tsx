/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Informational overview of configured providers and their auth profiles.
 * Reestructuración 2026-07-13: las filas derivan del providers-overview
 * (la SSOT de auth del módulo Models), no del antiguo fan-out de 3
 * endpoints que mezclaba señales (mirrors spliceados como "1 profile" no
 * desplegable, api_key enmascarada, etc.). Acciones por fila:
 *   - declared_only        → "Clean up"  (mirror sin secreto → logout)
 *   - orphan_credentials   → "Rescue key" (promueve la key huérfana)
 *   - has_credential       → borrar credencial del PROVIDER (logout)
 * Los toasts son honestos: condicionados a removed/rescued reales.
 */

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, ChevronDown, ChevronRight, Save, AlertTriangle, LifeBuoy, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { useGatewayStore } from '@/stores/gateway.store';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { describeCredentialError } from '../lib/credential-errors';
import type { AuthProfileEntry, ProviderOverview } from '../types';

// Texto humano de la fuente de credencial del overview.
const SOURCE_LABELS: Record<string, string> = {
  api_key: 'API key',
  local_marker: 'local (no key needed)',
  auth_store: 'auth store',
};

export function ProviderStatusBlock() {
  const { providersOverview, providersOverviewError } = useGatewayStore();

  const [profiles, setProfiles] = useState<AuthProfileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removingProfile, setRemovingProfile] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  // Acción por-provider en vuelo ('<provider>' → clean up / logout / rescue).
  // Los writes de credenciales pueden tardar (cola del Gateway reintenta
  // hasta ~120s) → loading persistente, nunca estados optimistas.
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState<string | null>(null);

  // Cooldowns
  const [cooldownsExpanded, setCooldownsExpanded] = useState(false);
  const [billingBackoff, setBillingBackoff] = useState(5);
  const [billingMax, setBillingMax] = useState(24);
  const [failureWindow, setFailureWindow] = useState(24);
  const [cooldownsDirty, setCooldownsDirty] = useState(false);
  const [savingCooldowns, setSavingCooldowns] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // El overview lo sirve el store (SSOT compartida con el Catalog);
      // aquí solo se cargan los extras: perfiles y cooldowns.
      const [profilesData, providersConfig] = await Promise.all([
        gwService.getAuthProfiles(),
        gwService.getProvidersConfig(),
        useGatewayStore.getState().fetchProvidersOverview(),
      ]);
      setProfiles(profilesData);
      const cooldowns = (providersConfig.auth?.cooldowns ?? {}) as Record<string, unknown>;
      setBillingBackoff((cooldowns.billing_backoff_hours ?? 5) as number);
      setBillingMax((cooldowns.billing_max_hours ?? 24) as number);
      setFailureWindow((cooldowns.failure_window_hours ?? 24) as number);
      setCooldownsDirty(false);
    } catch {
      setError('Failed to load provider status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const doRemoveProfile = async () => {
    const profileId = confirmTarget;
    if (!profileId) return;
    setRemovingProfile(profileId);
    setConfirmTarget(null);
    try {
      const { removed } = await gwService.removeAuthProfile(profileId);
      // Toast honesto: solo "removed" si el backend borró algo de verdad
      // (antes era optimista y decía OK aunque el perfil siguiera vivo).
      if (removed) toast.success('Auth profile removed');
      else toast.warning('Nothing to remove for this profile');
      await fetchAll();
    } catch (err) {
      toast.error(describeCredentialError(err, 'Failed to remove profile'));
    } finally {
      setRemovingProfile(null);
    }
  };

  // "Clean up" (declared_only) y borrado de credencial por provider comparten
  // el mismo write canónico: POST /gateway/models/auth/logout.
  const doLogoutProvider = async (provider: string, kind: 'cleanup' | 'logout') => {
    setProviderAction(provider);
    try {
      const { removed } = await gwService.logoutProvider(provider);
      if (removed) {
        toast.success(kind === 'cleanup'
          ? `Cleaned up declared entry for ${provider}`
          : `Credential removed for ${provider}`);
      } else {
        toast.warning(`Nothing to remove for ${provider}`);
      }
      await fetchAll();
    } catch (err) {
      toast.error(describeCredentialError(err, `Failed to remove credential for ${provider}`));
    } finally {
      setProviderAction(null);
    }
  };

  const doRescue = async (provider: string) => {
    setProviderAction(provider);
    try {
      const { rescued, donor } = await gwService.rescueProviderKey(provider);
      if (rescued) toast.success(`Key rescued for ${provider}${donor ? ` (from ${donor})` : ''}`);
      else toast.warning(`No orphan key found to rescue for ${provider}`);
      await fetchAll();
    } catch (err) {
      toast.error(describeCredentialError(err, `Failed to rescue key for ${provider}`));
    } finally {
      setProviderAction(null);
    }
  };

  const handleSaveCooldowns = async () => {
    setSavingCooldowns(true);
    try {
      await gwService.updateProvidersConfig({
        auth: {
          cooldowns: {
            billingBackoffHours: billingBackoff,
            billingMaxHours: billingMax,
            failureWindowHours: failureWindow,
          },
        },
      });
      toast.success('Cooldown config updated');
      setCooldownsDirty(false);
    } catch {
      toast.error('Failed to update cooldowns');
    } finally {
      setSavingCooldowns(false);
    }
  };

  if (loading && providersOverview === null) {
    return (
      <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Loader2 size={12} className="spin" /> Loading provider status...
      </div>
    );
  }

  if (error || providersOverviewError) {
    return (
      <div style={{ padding: 12 }}>
        <p style={{ color: 'var(--error, #ef4444)', fontSize: '0.8125rem', marginBottom: 8 }}>
          {error ?? providersOverviewError}
        </p>
        <button onClick={fetchAll} style={{
          padding: '4px 12px', fontSize: '0.75rem', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
        }}>
          Retry
        </button>
      </div>
    );
  }

  // Filas con alguna señal real: credencial, mirror declarado, key huérfana o
  // entrada en config. Providers meramente "destacados" del catálogo no
  // aportan nada aquí.
  const providerList: ProviderOverview[] = (providersOverview ?? []).filter(
    (p) => p.has_credential || p.declared_only || p.orphan_credentials || p.entry_in_config,
  );

  const smallButton = (opts: { color: string; border: string }): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600,
    background: 'transparent', border: `1px solid ${opts.border}`,
    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    color: opts.color, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
  });

  return (
    <div>
      <h3 style={{
        margin: '0 0 4px', fontSize: '0.875rem', fontWeight: 600,
        color: 'var(--text)', fontFamily: 'var(--font-display)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>Provider status</h3>
      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
        Overview of configured providers and credentials. To add or change credentials, use the <strong>Catalog</strong> tab.
      </p>

      {providerList.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '4px 0' }}>
          No providers configured yet. Go to the Catalog tab to add your first model.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {providerList.map((prov) => {
            const isExpanded = expanded === prov.id;
            const provProfiles = profiles.filter(p => p.provider === prov.id);
            const busy = providerAction === prov.id;
            // If the provider has profiles and *all* of them are expired,
            // surface that as a warning (orange dot) instead of green.
            const now = Date.now();
            const allProfilesExpired = provProfiles.length > 0 &&
              provProfiles.every(p => typeof p.expires === 'number' && p.expires < now);
            const dotColor = prov.has_credential
              ? (allProfilesExpired ? '#f59e0b' : '#22c55e')
              : prov.orphan_credentials
                ? '#f59e0b'
                : prov.declared_only
                  ? 'var(--text-muted)'
                  : '#ef4444';
            const detail = prov.has_credential
              ? (SOURCE_LABELS[prov.credential_source ?? ''] ?? prov.credential_source ?? 'credential')
              : prov.declared_only
                ? 'Declared in config — no credential'
                : prov.orphan_credentials
                  ? 'Orphan key (rescuable)'
                  : 'No credential';
            const canExpand = provProfiles.length > 0;

            return (
              <div key={prov.id}>
                {/* Provider row */}
                <div
                  onClick={() => canExpand && setExpanded(isExpanded ? null : prov.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: isExpanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
                    cursor: canExpand ? 'pointer' : 'default',
                  }}
                >
                  {/* Status dot */}
                  <span
                    title={allProfilesExpired ? 'All profiles expired' : detail}
                    style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: dotColor,
                    }}
                  />

                  {/* Name */}
                  <span style={{
                    flex: 1, fontSize: '0.8125rem', fontWeight: 500,
                    color: 'var(--text)', fontFamily: 'var(--font-mono)',
                    textTransform: 'capitalize',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {prov.id}
                  </span>

                  {/* Detail (source / declared / orphan) */}
                  <span style={{
                    fontSize: '0.6875rem',
                    color: prov.declared_only || prov.orphan_credentials ? '#f59e0b' : 'var(--text-dim)',
                    whiteSpace: 'nowrap',
                  }}>
                    {detail}
                  </span>

                  {/* Profile count (solo si hay perfiles desplegables) */}
                  {canExpand && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {provProfiles.length} profile{provProfiles.length !== 1 ? 's' : ''}
                    </span>
                  )}

                  {/* Actions */}
                  {prov.declared_only && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void doLogoutProvider(prov.id, 'cleanup'); }}
                      disabled={busy}
                      title="Remove the declared entry (it has no credential material behind it)"
                      style={{ ...smallButton({ color: '#f59e0b', border: '#f59e0b55' }), opacity: busy ? 0.6 : 1 }}
                    >
                      {busy ? <Loader2 size={11} className="spin" /> : <Eraser size={11} />} Clean up
                    </button>
                  )}
                  {prov.orphan_credentials && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void doRescue(prov.id); }}
                      disabled={busy}
                      title="Promote the orphan key (pasted before the 2026.6.11 migration) so the runtime can use it"
                      style={{ ...smallButton({ color: '#22c55e', border: '#22c55e55' }), opacity: busy ? 0.6 : 1 }}
                    >
                      {busy ? <Loader2 size={11} className="spin" /> : <LifeBuoy size={11} />} Rescue key
                    </button>
                  )}
                  {prov.has_credential && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmLogout(prov.id); }}
                      disabled={busy}
                      title={`Remove ${prov.id} credential`}
                      style={{
                        background: 'transparent', border: 'none', cursor: busy ? 'wait' : 'pointer',
                        color: 'var(--text-dim)', padding: 2, display: 'flex', opacity: busy ? 0.5 : 1,
                      }}
                    >
                      {busy ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                    </button>
                  )}

                  {/* Expand arrow */}
                  {canExpand && (
                    isExpanded
                      ? <ChevronDown size={12} style={{ color: 'var(--text-dim)' }} />
                      : <ChevronRight size={12} style={{ color: 'var(--text-dim)' }} />
                  )}
                </div>

                {/* Expanded profiles */}
                {isExpanded && provProfiles.length > 0 && (
                  <div style={{
                    border: '1px solid var(--border)', borderTop: 'none',
                    borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                    background: 'var(--surface)',
                  }}>
                    {provProfiles.map((prof) => {
                      const isExpired = prof.expires ? prof.expires < Date.now() : false;
                      return (
                        <div key={prof.profile_id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 12px 6px 32px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.6875rem',
                        }}>
                          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', flex: 1 }}>
                            {prof.profile_id}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{prof.type}</span>
                          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {prof.token_masked}
                          </span>
                          {prof.expires && (
                            <span style={{
                              color: isExpired ? '#ef4444' : 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              {isExpired && <AlertTriangle size={10} />}
                              {isExpired ? 'expired' : `exp ${new Date(prof.expires).toLocaleDateString()}`}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmTarget(prof.profile_id); }}
                            disabled={removingProfile === prof.profile_id}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: 'var(--text-dim)', padding: 2, display: 'flex',
                              opacity: removingProfile === prof.profile_id ? 0.5 : 1,
                            }}
                          >
                            {removingProfile === prof.profile_id
                              ? <Loader2 size={11} className="spin" />
                              : <Trash2 size={11} />
                            }
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Auth Cooldowns (collapsible) */}
      <button
        onClick={() => setCooldownsExpanded(!cooldownsExpanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '8px 0', background: 'transparent', border: 'none',
          borderTop: '1px solid var(--border)',
          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
          color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
          textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}
      >
        {cooldownsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Auth cooldowns
      </button>

      {cooldownsExpanded && (
        <div style={{ paddingTop: 8 }}>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            When a provider is rate-limited or has billing issues, the system backs off exponentially.
          </p>
          {[
            { label: 'Billing backoff start (hours)', value: billingBackoff, set: setBillingBackoff, min: 1, max: 48 },
            { label: 'Billing max cooldown (hours)', value: billingMax, set: setBillingMax, min: 1, max: 72 },
            { label: 'Failure window (hours)', value: failureWindow, set: setFailureWindow, min: 1, max: 72 },
          ].map(field => (
            <div key={field.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{field.label}</span>
              <input
                type="number"
                value={field.value}
                min={field.min}
                max={field.max}
                onChange={(e) => { field.set(parseInt(e.target.value, 10) || field.min); setCooldownsDirty(true); }}
                style={{
                  padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                }}
              />
            </div>
          ))}
          {cooldownsDirty && (
            <button onClick={handleSaveCooldowns} disabled={savingCooldowns} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', marginTop: 8,
              fontSize: '0.75rem', fontWeight: 600, background: 'var(--amber)', border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#000',
              fontFamily: 'var(--font-sans)', opacity: savingCooldowns ? 0.7 : 1,
            }}>
              <Save size={12} /> Save
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={doRemoveProfile}
        title="Remove auth profile?"
        description={confirmTarget ? `Models that depend on "${confirmTarget}" will stop working until you reconfigure the provider.` : ''}
        confirmLabel="Remove"
        variant="danger"
      />
      <ConfirmDialog
        open={confirmLogout !== null}
        onClose={() => setConfirmLogout(null)}
        onConfirm={() => { if (confirmLogout) void doLogoutProvider(confirmLogout, 'logout'); }}
        title="Remove provider credential?"
        description={confirmLogout ? `Models from "${confirmLogout}" will stop working until you add a new API key.` : ''}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
