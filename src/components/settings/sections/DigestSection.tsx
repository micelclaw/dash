import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingSelect } from '../SettingSelect';
import { api } from '@/services/api';

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

const ALL_DOMAINS = ['notes', 'events', 'contacts', 'emails', 'files', 'diary'];

interface DigestConfig {
  enabled: boolean;
  interval_minutes: number;
  quiet_hours: { start: string; end: string } | null;
  domains: string[] | null;
  channels?: string[];
  alert_levels?: string[];
}

export function DigestSection() {
  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [domainMode, setDomainMode] = useState<'all' | 'select'>('all');

  useEffect(() => {
    loadConfig();
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
      const data = await api.get<DigestConfig>('/digest/config');
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
        toast.success('Digest settings saved');
        return;
      }
      const updated = await api.patch<DigestConfig>('/digest/config', patch);
      setConfig(updated);
      toast.success('Digest settings saved');
    } catch {
      toast.error('Failed to save digest config');
    }
  };

  if (loading || !config) {
    return (
      <SettingSection title="Digest">
        <div style={{ padding: '16px 0', fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          Loading...
        </div>
      </SettingSection>
    );
  }

  return (
    <>
      <SettingSection title="Digest">
        <SettingToggle
          label="Digest Enabled"
          description="When enabled, Claw compiles periodic summaries of your activity."
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
            {ALL_DOMAINS.map((d) => {
              const checked = (config.domains || ALL_DOMAINS).includes(d);
              return (
                <label key={d} style={{
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
                        ? current.filter((x) => x !== d)
                        : [...current, d];
                      saveConfig({ domains: next.length === ALL_DOMAINS.length ? null : next });
                    }}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </label>
              );
            })}
          </div>
        )}
      </SettingSection>

      {/* Pro Features */}
      <SettingSection title="Pro Features" description="Available with a Pro license.">
        <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
          <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Delivery Channels
              </span>
              <span style={{
                fontSize: '0.625rem', padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(212,160,23,0.15)', color: 'var(--amber)',
                fontWeight: 600, fontFamily: 'var(--font-sans)',
              }}>
                PRO
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                <input type="checkbox" checked disabled style={{ accentColor: 'var(--amber)' }} />
                Dash (always on)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                <input type="checkbox" disabled style={{ accentColor: 'var(--amber)' }} />
                Telegram
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                <input type="checkbox" disabled style={{ accentColor: 'var(--amber)' }} />
                Email digest
              </label>
            </div>
          </div>

          <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Alert Levels
              </span>
              <span style={{
                fontSize: '0.625rem', padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(212,160,23,0.15)', color: 'var(--amber)',
                fontWeight: 600, fontFamily: 'var(--font-sans)',
              }}>
                PRO
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {['SILENT', 'NORMAL', 'URGENT'].map((level) => (
                <label key={level} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                  <input type="checkbox" checked disabled style={{ accentColor: 'var(--amber)' }} />
                  {level}
                </label>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
              Select which alert levels to receive.
            </div>
          </div>
        </div>
      </SettingSection>
    </>
  );
}
