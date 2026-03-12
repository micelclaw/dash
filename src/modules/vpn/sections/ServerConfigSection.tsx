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
import { AlertTriangle, RotateCcw, KeyRound } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { VpnServerConfig } from '../hooks/use-vpn';

interface ServerConfigSectionProps {
  config: VpnServerConfig | null;
  loading: boolean;
  onUpdate: (config: Partial<VpnServerConfig>) => Promise<VpnServerConfig | null>;
  onRestart: () => Promise<void>;
  onRegenerateKeys: () => Promise<void>;
}

export function ServerConfigSection({ config, loading, onUpdate, onRestart, onRegenerateKeys }: ServerConfigSectionProps) {
  const [form, setForm] = useState<VpnServerConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [dnsInput, setDnsInput] = useState('');

  useEffect(() => {
    if (config) {
      setForm({ ...config });
      setDnsInput(config.dns.join(', '));
      setDirty(false);
    }
  }, [config]);

  if (loading || !form) {
    return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading server config...</div>;
  }

  const update = <K extends keyof VpnServerConfig>(key: K, value: VpnServerConfig[K]) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const dnsArray = dnsInput.split(',').map(s => s.trim()).filter(Boolean);
    await onUpdate({ ...form, dns: dnsArray });
    setSaving(false);
    setDirty(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>
        Server Configuration
      </h2>

      {/* Network Settings */}
      <ConfigSection title="Network Settings">
        <ConfigRow label="Listen Port">
          <input
            type="number"
            value={form.listen_port}
            onChange={(e) => update('listen_port', parseInt(e.target.value) || 51820)}
            style={{ ...inputStyle, width: 100, fontFamily: 'var(--font-mono, monospace)' }}
          />
        </ConfigRow>
        <ConfigRow label="Server Address">
          <input
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder="10.13.13.1/24"
            style={{ ...inputStyle, width: 180, fontFamily: 'var(--font-mono, monospace)' }}
          />
        </ConfigRow>
        <ConfigRow label="DNS Servers">
          <input
            value={dnsInput}
            onChange={(e) => { setDnsInput(e.target.value); setDirty(true); }}
            placeholder="10.13.13.1, 1.1.1.1"
            style={{ ...inputStyle, width: 240, fontFamily: 'var(--font-mono, monospace)' }}
          />
        </ConfigRow>
        <ConfigRow label="MTU">
          <input
            type="number"
            value={form.mtu ?? ''}
            onChange={(e) => update('mtu', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Auto"
            style={{ ...inputStyle, width: 100, fontFamily: 'var(--font-mono, monospace)' }}
          />
        </ConfigRow>
      </ConfigSection>

      {/* Routing */}
      <ConfigSection title="Routing">
        <ConfigRow label="Routing Table">
          <select
            value={form.table ?? 'auto'}
            onChange={(e) => update('table', e.target.value === 'auto' ? null : e.target.value)}
            style={{ ...inputStyle, width: 140 }}
          >
            <option value="auto">Auto</option>
            <option value="off">Off</option>
          </select>
        </ConfigRow>
        <ConfigRow label="Firewall Mark">
          <input
            type="number"
            value={form.fw_mark ?? ''}
            onChange={(e) => update('fw_mark', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="None"
            style={{ ...inputStyle, width: 100, fontFamily: 'var(--font-mono, monospace)' }}
          />
        </ConfigRow>
        <ConfigRow label="SaveConfig">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.save_config}
              onChange={(e) => update('save_config', e.target.checked)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Auto-save runtime changes
            </span>
          </label>
        </ConfigRow>
      </ConfigSection>

      {/* Interface Scripts */}
      <ConfigSection title="Interface Scripts">
        <ScriptField label="PostUp" value={form.post_up} onChange={(v) => update('post_up', v)} />
        <ScriptField label="PostDown" value={form.post_down} onChange={(v) => update('post_down', v)} />
        <ScriptField label="PreUp" value={form.pre_up} onChange={(v) => update('pre_up', v)} />
        <ScriptField label="PreDown" value={form.pre_down} onChange={(v) => update('pre_down', v)} />
      </ConfigSection>

      {/* Save Button */}
      {dirty && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 36, padding: '0 24px',
              background: 'var(--amber)', color: '#06060a',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: 16, marginTop: 8,
      }}>
        <h3 style={{
          fontSize: '0.875rem', fontWeight: 600, color: '#ef4444',
          margin: '0 0 12px', fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertTriangle size={14} /> Danger Zone
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DangerAction
            icon={RotateCcw}
            label="Restart Interface"
            description="Briefly disconnect all peers. They will auto-reconnect."
            onClick={() => setConfirmRestart(true)}
          />
          <DangerAction
            icon={KeyRound}
            label="Regenerate Server Keys"
            description="This will invalidate ALL existing peer configurations. Peers must be re-provisioned."
            onClick={() => setConfirmRegen(true)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onConfirm={async () => { setConfirmRestart(false); await onRestart(); }}
        title="Restart VPN Interface?"
        description="All connected peers will be temporarily disconnected."
        confirmLabel="Restart"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        onConfirm={async () => { setConfirmRegen(false); await onRegenerateKeys(); }}
        title="Regenerate Server Keys?"
        description="This will generate a new server keypair. ALL existing peer configurations will become invalid and must be re-created. This action cannot be undone."
        confirmLabel="Regenerate Keys"
        variant="danger"
      />
    </div>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface)',
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.8125rem', fontWeight: 600,
        color: 'var(--text)', fontFamily: 'var(--font-sans)',
      }}>
        {title}
      </div>
      <div style={{ padding: '8px 14px' }}>
        {children}
      </div>
    </div>
  );
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function ScriptField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{
          width: '100%', padding: 8,
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          fontSize: '0.6875rem', fontFamily: 'var(--font-mono, monospace)',
          outline: 'none', resize: 'vertical', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function DangerAction({ icon: Icon, label, description, onClick }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string; description: string; onClick: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{description}</div>
      </div>
      <button
        onClick={onClick}
        style={{
          height: 28, padding: '0 12px',
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'transparent',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          fontSize: '0.75rem', fontWeight: 500,
          color: '#ef4444', fontFamily: 'var(--font-sans)',
          flexShrink: 0,
        }}
      >
        <Icon size={12} />
        {label}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 30, padding: '0 8px',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
};
