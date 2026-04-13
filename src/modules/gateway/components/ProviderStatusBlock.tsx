/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Informational overview of configured providers and their auth profiles.
 * Replaces the old BuiltinProviderKeysBlock + ModelProvidersBlock + AuthProfilesBlock
 * with a single read-oriented panel. Credentials are added via the Catalog tab.
 */

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, ChevronDown, ChevronRight, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { ModelsStatus, AuthProfileEntry } from '../types';

export function ProviderStatusBlock() {
  const [status, setStatus] = useState<ModelsStatus | null>(null);
  const [profiles, setProfiles] = useState<AuthProfileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removingProfile, setRemovingProfile] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

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
      const [statusData, profilesData, providersConfig] = await Promise.all([
        gwService.getModelsStatus(),
        gwService.getAuthProfiles(),
        gwService.getProvidersConfig(),
      ]);
      setStatus(statusData);
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
      await gwService.removeAuthProfile(profileId);
      toast.success('Auth profile removed');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove profile');
    } finally {
      setRemovingProfile(null);
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

  if (loading) {
    return (
      <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Loader2 size={12} className="spin" /> Loading provider status...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 12 }}>
        <p style={{ color: 'var(--error, #ef4444)', fontSize: '0.8125rem', marginBottom: 8 }}>{error}</p>
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

  const providerList = status?.auth?.providers ?? [];

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
            const isExpanded = expanded === prov.provider;
            const provProfiles = profiles.filter(p => p.provider === prov.provider);
            const hasAuth = prov.effective.kind !== 'none';
            const canExpand = provProfiles.length > 0;

            return (
              <div key={prov.provider}>
                {/* Provider row */}
                <div
                  onClick={() => canExpand && setExpanded(isExpanded ? null : prov.provider)}
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
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: hasAuth ? '#22c55e' : '#ef4444',
                  }} />

                  {/* Name */}
                  <span style={{
                    flex: 1, fontSize: '0.8125rem', fontWeight: 500,
                    color: 'var(--text)', fontFamily: 'var(--font-mono)',
                    textTransform: 'capitalize',
                  }}>
                    {prov.provider}
                  </span>

                  {/* Profile count */}
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                    {prov.profiles.count} profile{prov.profiles.count !== 1 ? 's' : ''}
                  </span>

                  {/* Token preview */}
                  <span style={{
                    fontSize: '0.6875rem', color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)', minWidth: 70, textAlign: 'right',
                  }}>
                    {prov.effective.detail || '—'}
                  </span>

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
    </div>
  );
}
