/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * ─── Idempotency contract (B7) ─────────────────────────────────────
 * May be mounted twice simultaneously: standalone at
 * `/settings/approvals-forwarding` and as a `<SettingsBlock>` inside
 * Security (`/settings/security`). Each instance fetches and saves
 * independently — no module-level state, no shared refs. Lift to a
 * store only if cross-instance sync becomes a real requirement.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

const FORWARD_MODES = [
  { value: 'session', label: 'Session channel', desc: 'Forward to the channel where the session originated' },
  { value: 'targets', label: 'Specific targets', desc: 'Forward to configured channel targets below' },
  { value: 'both', label: 'Both', desc: 'Forward to session channel AND configured targets' },
];

const CHANNEL_OPTIONS = ['telegram', 'discord', 'slack', 'whatsapp', 'signal'];

export function ApprovalsForwardingSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState('session');
  const [targets, setTargets] = useState<Array<{ channel: string; to: string }>>([]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getApprovalsConfig();
      setEnabled(data.enabled ?? false);
      setMode(data.mode ?? 'session');
      setTargets((data.targets ?? []).map(t => ({ channel: t.channel, to: t.to })));
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load approvals config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateApprovalsConfig({
        enabled,
        mode,
        targets: targets.filter(t => t.channel && t.to),
      });
      toast.success('Approvals Forwarding saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update approvals config'));
    } finally {
      setSaving(false);
    }
  };

  const addTarget = () => {
    setTargets([...targets, { channel: 'telegram', to: '' }]);
    setDirty(true);
  };

  const removeTarget = (idx: number) => {
    setTargets(targets.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const updateTarget = (idx: number, field: 'channel' | 'to', value: string) => {
    const updated = [...targets];
    updated[idx] = { ...updated[idx], [field]: value };
    setTargets(updated);
    setDirty(true);
  };

  return (
    <SectionShell
      title="Approvals Forwarding"
      description="Forward exec approval requests to messaging channels so you can approve from your phone."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    >
      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Enable forwarding</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Send exec approval requests to external channels</div>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={(v) => { setEnabled(v); setDirty(true); }}
          ariaLabel="Enable forwarding"
        />
      </div>

      {enabled && (
        <>
          {/* Mode */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Forwarding Mode
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FORWARD_MODES.map(m => (
                <label key={m.value} onClick={() => { setMode(m.value); setDirty(true); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                  background: mode === m.value ? 'var(--surface-hover)' : 'var(--surface)',
                  border: mode === m.value ? '1px solid var(--amber-dim)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: mode === m.value ? '4px solid var(--amber)' : '2px solid var(--text-muted)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{m.label}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Targets (when mode includes targets) */}
          {(mode === 'targets' || mode === 'both') && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Targets
                </span>
                <button onClick={addTarget} style={{
                  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)',
                  fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
                }}>
                  <Plus size={10} /> Add target
                </button>
              </div>
              {targets.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  No targets configured. Add a channel target to receive approval requests.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {targets.map((target, idx) => (
                    <div key={idx} style={{
                      display: 'flex', gap: 8, alignItems: 'center',
                      padding: '8px 10px', background: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    }}>
                      <select value={target.channel} onChange={e => updateTarget(idx, 'channel', e.target.value)} style={{
                        padding: '4px 8px', fontSize: '0.75rem',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)',
                      }}>
                        {CHANNEL_OPTIONS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                      </select>
                      <input
                        type="text"
                        value={target.to}
                        onChange={e => updateTarget(idx, 'to', e.target.value)}
                        placeholder="Chat/user ID (e.g., 123456789)"
                        style={{
                          flex: 1, padding: '4px 8px', fontSize: '0.75rem',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                          fontFamily: 'var(--font-mono, var(--font-sans))',
                        }}
                      />
                      <button onClick={() => removeTarget(idx)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 4, display: 'flex',
                      }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </SectionShell>
  );
}
