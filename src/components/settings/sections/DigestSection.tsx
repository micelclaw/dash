/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useState, useEffect } from 'react';
import { Lock, Mail as MailIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingSelect } from '../SettingSelect';
import { InlineLoading } from '../shared/InlineLoading';
import * as digestSvc from '@/services/digest.service';
import { useAuthStore } from '@/stores/auth.store';
// Shared domain registry — same list used by PermissionsSection so
// adding a domain in one place updates both.
import { DATA_DOMAINS, ALL_DOMAIN_IDS } from '@/config/domains';

const FREQUENCY_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '360', label: '6 hours' },
  { value: '1440', label: '24 hours' },
];

// Use the shared registry but expose under the legacy name to keep
// the rest of the file readable.
const ALL_DOMAINS = ALL_DOMAIN_IDS;

const EMAIL_FREQ_OPTIONS = [
  { value: '30', label: 'Every 30 min' },
  { value: '60', label: 'Every hour' },
  { value: '120', label: 'Every 2 hours' },
  { value: '360', label: 'Every 6 hours' },
  { value: '720', label: 'Every 12 hours' },
  { value: '1440', label: 'Once a day' },
];

interface DigestConfig {
  enabled: boolean;
  interval_minutes: number;
  quiet_hours: { start: string; end: string } | null;
  domains: string[] | null;
  channels?: string[];
  alert_levels?: string[];
  email_digest?: {
    account_id: string;
    recipient: string;
    interval_minutes: number;
  } | null;
}

interface EmailAccountOption {
  id: string;
  email_address: string;
  name: string;
}

export function DigestSection() {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountOption[]>([]);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [domainMode, setDomainMode] = useState<'all' | 'select'>('all');

  useEffect(() => {
    loadConfig();
    // Load email accounts for digest email sender selection
    digestSvc.listEmailAccounts().then(setEmailAccounts).catch(() => {});
  }, []);

  const loadConfig = async () => {
    try {
      if (import.meta.env.VITE_MOCK_API === 'true') {
        await new Promise((r) => setTimeout(r, 300));
        const mock: DigestConfig = {
          enabled: true,
          interval_minutes: 30,
          quiet_hours: null,
          domains: null,
        };
        setConfig(mock);
        setQuietEnabled(!!mock.quiet_hours);
        setDomainMode(mock.domains ? 'select' : 'all');
        setLoading(false);
        return;
      }
      const data = await digestSvc.getDigestConfig();
      setConfig(data);
      setQuietEnabled(!!data.quiet_hours);
      setDomainMode(data.domains ? 'select' : 'all');
    } catch {
      toast.error('Failed to load digest config');
    }
    setLoading(false);
  };

  const saveConfig = async (patch: Partial<DigestConfig>) => {
    try {
      if (import.meta.env.VITE_MOCK_API === 'true') {
        setConfig((c) => c ? { ...c, ...patch } : c);
        toast.success('Digest saved');
        return;
      }
      setConfig(await digestSvc.updateDigestConfig(patch));
      toast.success('Digest saved');
    } catch {
      toast.error('Failed to save digest config');
    }
  };

  if (loading || !config) {
    return (
      <SettingSection title="Digest">
        <InlineLoading />
      </SettingSection>
    );
  }

  return (
    <>
      <SettingSection title="Digest">
        <SettingToggle
          label="Digest Enabled"
          description="Enables digest GENERATION — Claw compiles periodic summaries of your activity. (Whether they appear as toasts is controlled separately in Notifications → Show Digest Alerts.)"
          checked={config.enabled}
          onChange={(v) => saveConfig({ enabled: v })}
        />

        <SettingSelect
          label="Frequency"
          description="How often to compile and deliver digests."
          value={String(config.interval_minutes)}
          options={FREQUENCY_OPTIONS}
          onChange={(v) => saveConfig({ interval_minutes: parseInt(v) })}
        />
      </SettingSection>

      {/* Quiet Hours */}
      <SettingSection title="Quiet Hours" description="During quiet hours, only URGENT alerts are delivered.">
        <SettingToggle
          label="Enable Quiet Hours"
          checked={quietEnabled}
          onChange={(v) => {
            setQuietEnabled(v);
            if (!v) {
              saveConfig({ quiet_hours: null });
            } else {
              saveConfig({ quiet_hours: { start: '23:00', end: '07:00' } });
            }
          }}
        />

        {quietEnabled && (
          <div style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>From</label>
            <input
              type="time"
              value={config.quiet_hours?.start || '23:00'}
              onChange={(e) => {
                const qh = { start: e.target.value, end: config.quiet_hours?.end || '07:00' };
                saveConfig({ quiet_hours: qh });
              }}
              style={{
                height: 30, padding: '0 8px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>To</label>
            <input
              type="time"
              value={config.quiet_hours?.end || '07:00'}
              onChange={(e) => {
                const qh = { start: config.quiet_hours?.start || '23:00', end: e.target.value };
                saveConfig({ quiet_hours: qh });
              }}
              style={{
                height: 30, padding: '0 8px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
          </div>
        )}
      </SettingSection>

      {/* Domains */}
      <SettingSection title="Domains" description="Select which domains to include in digests.">
        <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
          {(['all', 'select'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setDomainMode(m);
                if (m === 'all') saveConfig({ domains: null });
              }}
              style={{
                height: 28, padding: '0 12px',
                background: domainMode === m ? 'var(--amber)' : 'var(--surface)',
                color: domainMode === m ? '#06060a' : 'var(--text-dim)',
                border: domainMode === m ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem', fontWeight: domainMode === m ? 600 : 400,
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {m === 'all' ? 'All Domains' : 'Select Specific'}
            </button>
          ))}
        </div>

        {domainMode === 'select' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
            {DATA_DOMAINS.map((d) => {
              const Icon = d.icon;
              const checked = (config.domains || ALL_DOMAINS).includes(d.id);
              return (
                <label key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px',
                  background: checked ? 'rgba(212,160,23,0.1)' : 'var(--surface)',
                  border: `1px solid ${checked ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem', color: 'var(--text)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const current = config.domains || [...ALL_DOMAINS];
                      const next = checked
                        ? current.filter((x) => x !== d.id)
                        : [...current, d.id];
                      saveConfig({ domains: next.length === ALL_DOMAINS.length ? null : next });
                    }}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  <Icon size={12} />
                  {d.label}
                </label>
              );
            })}
          </div>
        )}
      </SettingSection>

      {/* Pro Features */}
      <SettingSection title="Pro Features" description={isPro ? 'Configure advanced digest options.' : undefined}>
        {/* Pro gate: full banner + real `disabled` on every control under
            it. Replaces the old pointerEvents:none + opacity:0.5 trick
            which left controls visually-but-not-actually clickable. */}
        {!isPro && (
          <div
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', marginBottom: 12,
              background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--amber)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, lineHeight: 1.5 }}>
              <strong>Pro feature</strong> — Deliver your digest to Telegram or Email, and filter by alert level (Silent / Normal / Urgent).{' '}
              <a
                href="https://micelclaw.com/pricing"
                target="_blank"
                rel="noopener"
                style={{ color: 'var(--amber)', textDecoration: 'underline' }}
              >
                Upgrade
              </a>
            </div>
          </div>
        )}
        <div>
          <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Delivery Channels
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {/* Dash — always on */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                <input type="checkbox" checked disabled style={{ accentColor: 'var(--amber)' }} />
                Dash (always on)
              </label>

              {/* Telegram — placeholder */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', cursor: isPro ? 'pointer' : 'not-allowed', opacity: isPro ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  disabled={!isPro}
                  checked={(config.channels ?? ['dash']).includes('telegram')}
                  onChange={() => {
                    const channels = config.channels ?? ['dash'];
                    const has = channels.includes('telegram');
                    const next = has ? channels.filter(c => c !== 'telegram') : [...channels, 'telegram'];
                    if (!next.includes('dash')) next.unshift('dash');
                    saveConfig({ channels: next });
                  }}
                  style={{ accentColor: 'var(--amber)', cursor: isPro ? 'pointer' : 'not-allowed' }}
                />
                Telegram
              </label>

              {/* Email digest — with expanded config */}
              {(() => {
                const channels = config.channels ?? ['dash'];
                const emailEnabled = channels.includes('email');
                const emailCfg = config.email_digest;
                const noMailAccounts = emailAccounts.length === 0;
                // Email needs Pro AND at least one configured mail account.
                const emailToggleDisabled = !isPro || noMailAccounts;
                const inputStyle: React.CSSProperties = {
                  height: 28, padding: '0 8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                  fontSize: '0.75rem', fontFamily: 'var(--font-sans)', outline: 'none',
                };
                return (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', cursor: emailToggleDisabled ? 'not-allowed' : 'pointer', opacity: emailToggleDisabled ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        disabled={emailToggleDisabled}
                        checked={emailEnabled}
                        onChange={() => {
                          // Defensive: shouldn't happen because input is
                          // disabled, but keep the guard so the patch
                          // never goes out with an empty account_id.
                          if (noMailAccounts) {
                            toast.error('Configure a mail account first in Settings → Apps → Mail');
                            return;
                          }
                          const next = emailEnabled ? channels.filter(c => c !== 'email') : [...channels, 'email'];
                          if (!next.includes('dash')) next.unshift('dash');
                          const patch: Partial<DigestConfig> = { channels: next };
                          // Initialize email_digest config when enabling
                          if (!emailEnabled && !emailCfg) {
                            patch.email_digest = {
                              account_id: emailAccounts[0]?.id ?? '',
                              recipient: emailAccounts[0]?.email_address ?? '',
                              interval_minutes: 360,
                            };
                          }
                          if (emailEnabled) patch.email_digest = null;
                          saveConfig(patch);
                        }}
                        style={{ accentColor: 'var(--amber)', cursor: emailToggleDisabled ? 'not-allowed' : 'pointer' }}
                      />
                      Email digest
                    </label>
                    {/* Banner: no mail accounts configured. Only shows for
                        Pro users so non-Pro see the Pro banner above and
                        not a confusing chain of caveats. */}
                    {isPro && noMailAccounts && (
                      <div
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          marginTop: 6, padding: '6px 10px',
                          background: 'rgba(212,160,23,0.08)',
                          border: '1px solid rgba(212,160,23,0.3)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.6875rem', color: 'var(--amber)',
                          fontFamily: 'var(--font-sans)', lineHeight: 1.5,
                        }}
                      >
                        <MailIcon size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>
                          Configure at least one mail account first → <strong>Settings → Apps → Mail</strong>.
                        </span>
                      </div>
                    )}

                    {emailEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, marginLeft: 22, padding: '8px 12px', borderLeft: '2px solid var(--border)', background: 'var(--surface)' }}>
                        {/* Send from account */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', minWidth: 60 }}>Send from</span>
                          <select
                            value={emailCfg?.account_id ?? ''}
                            onChange={(e) => {
                              const acct = emailAccounts.find(a => a.id === e.target.value);
                              saveConfig({ email_digest: { ...emailCfg!, account_id: e.target.value, recipient: emailCfg?.recipient ?? acct?.email_address ?? '', interval_minutes: emailCfg?.interval_minutes ?? 360 } });
                            }}
                            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                          >
                            {emailAccounts.map(a => (
                              <option key={a.id} value={a.id}>{a.name || a.email_address}</option>
                            ))}
                          </select>
                        </div>

                        {/* Recipient */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', minWidth: 60 }}>Send to</span>
                          <input
                            type="email"
                            value={emailCfg?.recipient ?? ''}
                            placeholder="you@example.com"
                            onChange={(e) => {
                              saveConfig({ email_digest: { ...emailCfg!, recipient: e.target.value } });
                            }}
                            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                          />
                        </div>

                        {/* Frequency */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', minWidth: 60 }}>Frequency</span>
                          <select
                            value={String(emailCfg?.interval_minutes ?? 360)}
                            onChange={(e) => {
                              saveConfig({ email_digest: { ...emailCfg!, interval_minutes: parseInt(e.target.value) } });
                            }}
                            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                          >
                            {EMAIL_FREQ_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Alert Levels
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {['SILENT', 'NORMAL', 'URGENT'].map((level) => {
                const levels = config.alert_levels ?? ['SILENT', 'NORMAL', 'URGENT'];
                const checked = levels.includes(level);
                return (
                  <label key={level} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', cursor: isPro ? 'pointer' : 'not-allowed', opacity: isPro ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      disabled={!isPro}
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? levels.filter(l => l !== level)
                          : [...levels, level];
                        saveConfig({ alert_levels: next });
                      }}
                      style={{ accentColor: 'var(--amber)', cursor: isPro ? 'pointer' : 'not-allowed' }}
                    />
                    {level}
                  </label>
                );
              })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
              Select which alert levels to receive in the digest.
            </div>
          </div>
        </div>
      </SettingSection>
    </>
  );
}
