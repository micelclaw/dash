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

import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface ProxySettingsData {
  default_host_behavior: string;
  default_redirect_url: string | null;
  custom_html: string | null;
  global_block_exploits: boolean;
}

const BEHAVIORS = [
  { value: '404', label: '404 Not Found', desc: 'Return a 404 error for unmatched domains (default)' },
  { value: 'congratulations', label: 'Congratulations Page', desc: 'Show a "Caddy is working" page' },
  { value: 'redirect', label: 'Redirect', desc: 'Redirect unmatched domains to a URL' },
  { value: 'custom_html', label: 'Custom HTML', desc: 'Show a custom HTML page' },
  { value: 'no_response', label: 'No Response', desc: 'Close the connection silently' },
];

export function ProxySettingsSection() {
  const [settings, setSettings] = useState<ProxySettingsData>({
    default_host_behavior: '404',
    default_redirect_url: null,
    custom_html: null,
    global_block_exploits: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get<{ data: ProxySettingsData }>('/hal/network/proxy/settings');
      setSettings(res.data);
    } catch { /* use defaults */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const update = (partial: Partial<ProxySettingsData>) => {
    setSettings(prev => ({ ...prev, ...partial }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/hal/network/proxy/settings', settings);
      toast.success('Settings saved');
      setDirty(false);
      // Sync to Caddy
      try {
        await api.post('/hal/network/proxy/sync');
        toast.success('Config synced to Caddy');
      } catch { /* non-critical */ }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading settings...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
          Proxy Settings
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn icon={RefreshCw} onClick={fetchSettings} title="Reload" />
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: dirty ? '#22c55e' : 'var(--surface)',
              color: dirty ? '#fff' : 'var(--text-muted)',
              border: dirty ? 'none' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: (!dirty || saving) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
              opacity: (!dirty || saving) ? 0.5 : 1,
            }}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save & Sync'}
          </button>
        </div>
      </div>

      {/* Default Host Behavior */}
      <SettingsCard title="Default Host Behavior" description="What happens when a request doesn't match any configured proxy host.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {BEHAVIORS.map(b => (
            <label
              key={b.value}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: settings.default_host_behavior === b.value ? '1px solid var(--amber)' : '1px solid var(--border)',
                background: settings.default_host_behavior === b.value ? 'rgba(212,160,23,0.06)' : 'var(--bg)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="behavior"
                checked={settings.default_host_behavior === b.value}
                onChange={() => update({ default_host_behavior: b.value })}
                style={{ accentColor: 'var(--amber)', marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{b.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{b.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {settings.default_host_behavior === 'redirect' && (
          <div style={{ marginTop: 12 }}>
            <Label>Redirect URL</Label>
            <input
              type="text"
              placeholder="https://example.com"
              value={settings.default_redirect_url ?? ''}
              onChange={(e) => update({ default_redirect_url: e.target.value || null })}
              style={inputStyle}
            />
          </div>
        )}

        {settings.default_host_behavior === 'custom_html' && (
          <div style={{ marginTop: 12 }}>
            <Label>Custom HTML</Label>
            <textarea
              placeholder="<html><body><h1>Hello</h1></body></html>"
              value={settings.custom_html ?? ''}
              onChange={(e) => update({ custom_html: e.target.value || null })}
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)' }}
            />
          </div>
        )}
      </SettingsCard>

      {/* Global Security */}
      <SettingsCard title="Global Security" description="Security settings applied across all proxy hosts.">
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: settings.global_block_exploits ? 'rgba(34,197,94,0.04)' : 'var(--bg)',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={settings.global_block_exploits}
            onChange={(e) => update({ global_block_exploits: e.target.checked })}
            style={{ accentColor: '#22c55e', marginTop: 2 }}
          />
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Block Common Exploits (Global)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
              Add security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection) to all responses by default.
              Individual hosts can override this setting.
            </div>
          </div>
        </label>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.4 }}>{description}</div>
      {children}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title }: { icon: React.ComponentType<{ size?: number }>; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-dim)' }}><Icon size={14} /></button>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none' };
