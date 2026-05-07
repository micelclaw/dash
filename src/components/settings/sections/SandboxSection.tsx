/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { NumericRow } from '../shared/NumericRow';

const SANDBOX_MODES = [
  { value: 'off', label: 'Off', desc: 'All tools run on host (no isolation)' },
  { value: 'non-main', label: 'Non-main sessions', desc: 'Sandbox only group/channel sessions, main DM runs on host' },
  { value: 'all', label: 'All sessions', desc: 'Every session runs in a Docker container' },
];

const SCOPE_OPTIONS = [
  { value: 'session', label: 'Per session', desc: 'One container per chat session' },
  { value: 'agent', label: 'Per agent', desc: 'One container shared across agent sessions' },
  { value: 'shared', label: 'Shared', desc: 'One container for all sandboxed sessions' },
];

const WORKSPACE_OPTIONS = [
  { value: 'none', label: 'None', desc: 'Sandbox has its own isolated workspace' },
  { value: 'ro', label: 'Read-only', desc: 'Agent workspace mounted read-only at /agent' },
  { value: 'rw', label: 'Read-write', desc: 'Agent workspace mounted read-write at /workspace' },
];

export function SandboxSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [mode, setMode] = useState('off');
  const [scope, setScope] = useState('session');
  const [workspaceAccess, setWorkspaceAccess] = useState('none');
  const [idleHours, setIdleHours] = useState(24);
  const [maxAgeDays, setMaxAgeDays] = useState(7);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getSandboxConfig();
      setMode(data.mode ?? 'off');
      setScope(data.scope ?? 'session');
      setWorkspaceAccess(data.workspace_access ?? 'none');
      setIdleHours(data.prune?.idle_hours ?? 24);
      setMaxAgeDays(data.prune?.max_age_days ?? 7);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load sandbox config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateSandboxConfig({
        mode, scope, workspaceAccess,
        prune: { idleHours, maxAgeDays },
      });
      toast.success('Sandbox saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update sandbox config'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="Sandbox"
      description="Run agent tools in isolated Docker containers. Per-agent overrides in Agent → Advanced."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      appliesAt="gateway-restart"
    >
      {/* Mode */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sandbox Mode</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SANDBOX_MODES.map(m => (
            <label key={m.value} onClick={() => markDirty(setMode)(m.value)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: mode === m.value ? 'var(--surface-hover)' : 'var(--surface)',
              border: mode === m.value ? '1px solid var(--amber-dim)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: mode === m.value ? '5px solid var(--amber)' : '2px solid var(--text-muted)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{m.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {mode !== 'off' && (
        <>
          {/* Scope */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Container scope</span>
              <select value={scope} onChange={e => markDirty(setScope)(e.target.value)} style={{
                padding: '4px 8px', fontSize: '0.75rem', minWidth: 160,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>)}
              </select>
            </div>
          </div>

          {/* Workspace */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Workspace access</span>
              <select value={workspaceAccess} onChange={e => markDirty(setWorkspaceAccess)(e.target.value)} style={{
                padding: '4px 8px', fontSize: '0.75rem', minWidth: 160,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                {WORKSPACE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>)}
              </select>
            </div>
          </div>

          {/* Pruning */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
            <NumericRow
              label="Idle prune (hours)"
              value={idleHours}
              min={1} max={168}
              onChange={markDirty(setIdleHours)}
            />
            <NumericRow
              label="Max age (days)"
              value={maxAgeDays}
              min={1} max={30}
              onChange={markDirty(setMaxAgeDays)}
            />
          </div>
        </>
      )}
    </SectionShell>
  );
}
