/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

export function BrowserConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [headless, setHeadless] = useState(false);
  const [evaluateEnabled, setEvaluateEnabled] = useState(true);
  const [defaultProfile, setDefaultProfile] = useState('openclaw');
  const [allowPrivateNetwork, setAllowPrivateNetwork] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getBrowserConfig();
      setEnabled(data.enabled ?? true);
      setHeadless(data.headless ?? false);
      setEvaluateEnabled(data.evaluate_enabled ?? true);
      setDefaultProfile(data.default_profile ?? 'openclaw');
      const ssrf = (data.ssrf_policy ?? {}) as Record<string, unknown>;
      setAllowPrivateNetwork((ssrf.dangerously_allow_private_network ?? true) as boolean);
      setDirty(false);
    } catch {
      toast.error('Failed to load browser config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateBrowserConfig({
        enabled, headless, evaluateEnabled,
        defaultProfile,
        ssrfPolicy: { dangerouslyAllowPrivateNetwork: allowPrivateNetwork },
      });
      toast.success('Browser config updated');
      setDirty(false);
    } catch {
      toast.error('Failed to update browser config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;

  const Toggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
      <div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <div onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
        background: value ? 'var(--success, #22c55e)' : 'var(--text-muted)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left 0.2s' }} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Browser</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Configure the headless browser agents use for web browsing.
          </p>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600,
          background: dirty ? 'var(--amber)' : 'var(--surface)', border: dirty ? 'none' : '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: dirty ? '#000' : 'var(--text-muted)',
          cursor: dirty ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, fontFamily: 'var(--font-sans)',
        }}>
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      <Toggle label="Browser enabled" desc="Allow agents to control a web browser" value={enabled} onChange={markDirty(setEnabled)} />
      <Toggle label="Headless mode" desc="Run browser without visible window" value={headless} onChange={markDirty(setHeadless)} />
      <Toggle label="JavaScript evaluation" desc="Allow agents to run arbitrary JavaScript in pages" value={evaluateEnabled} onChange={markDirty(setEvaluateEnabled)} />
      <Toggle label="Allow private network access" desc="Let the browser access internal/private network addresses (localhost, 192.168.x.x, etc.)" value={allowPrivateNetwork} onChange={markDirty(setAllowPrivateNetwork)} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Default profile</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Browser profile to use by default</div>
        </div>
        <select value={defaultProfile} onChange={e => markDirty(setDefaultProfile)(e.target.value)} style={{
          padding: '4px 8px', fontSize: '0.75rem', minWidth: 160,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
        }}>
          <option value="openclaw">OpenClaw (isolated)</option>
          <option value="user">User (signed-in Chrome)</option>
          <option value="chrome-relay">Chrome Relay (extension)</option>
        </select>
      </div>
    </div>
  );
}
