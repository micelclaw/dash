/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

// Profile keys that we know how to label. Anything else is rendered
// with the raw key (so user-defined profiles in openclaw.json show up).
const KNOWN_PROFILE_LABELS: Record<string, string> = {
  openclaw: 'OpenClaw (isolated)',
  user: 'User (signed-in Chrome)',
  'chrome-relay': 'Chrome Relay (extension)',
};

interface ProfileOption {
  value: string;
  label: string;
}

function buildProfileOptions(profiles: Record<string, unknown> | undefined, currentDefault: string): ProfileOption[] {
  const keys = new Set<string>(Object.keys(KNOWN_PROFILE_LABELS));
  if (profiles) for (const k of Object.keys(profiles)) keys.add(k);
  // Make sure the currently-selected default appears in the dropdown
  // even if the user typed it manually in openclaw.json and the GET
  // didn't echo it as a profile entry.
  if (currentDefault) keys.add(currentDefault);
  return [...keys].map((k) => ({
    value: k,
    label: KNOWN_PROFILE_LABELS[k] ?? k,
  }));
}

export function BrowserConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [headless, setHeadless] = useState(false);
  const [evaluateEnabled, setEvaluateEnabled] = useState(true);
  const [defaultProfile, setDefaultProfile] = useState('openclaw');
  const [allowPrivateNetwork, setAllowPrivateNetwork] = useState(true);
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>(
    buildProfileOptions(undefined, 'openclaw'),
  );

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getBrowserConfig();
      setEnabled(data.enabled ?? true);
      setHeadless(data.headless ?? false);
      setEvaluateEnabled(data.evaluate_enabled ?? true);
      const profile = data.default_profile ?? 'openclaw';
      setDefaultProfile(profile);
      setProfileOptions(buildProfileOptions(data.profiles, profile));
      const ssrf = (data.ssrf_policy ?? {}) as Record<string, unknown>;
      setAllowPrivateNetwork((ssrf.dangerously_allow_private_network ?? true) as boolean);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load browser config'));
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
      toast.success('Browser saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update browser config'));
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
      <div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <ToggleSwitch checked={value} onChange={onChange} ariaLabel={label} />
    </div>
  );

  return (
    <SectionShell
      title="Browser"
      description="Configure the headless browser agents use for web browsing."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    >
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
          {profileOptions.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
    </SectionShell>
  );
}
