/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * ─── Idempotency contract (B7) ─────────────────────────────────────
 * May be mounted twice simultaneously: standalone at `/settings/hooks`
 * and as a `<SettingsBlock>` inside Automation (`/settings/automation`).
 * Each instance fetches and saves independently — no module-level
 * state, no shared refs. Lift to a store only if cross-instance sync
 * becomes a real requirement.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SettingsBlock } from '../shared/SettingsBlock';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import type { AvailableHook } from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';

// Fallback only — the canonical list lives at
// GET /gateway/hooks-config/available-hooks. We keep a local copy so
// the section still renders if the discovery endpoint fails (offline,
// older Core).
const FALLBACK_BUNDLED_HOOKS: AvailableHook[] = [
  { id: 'session-memory', name: 'Session Memory', description: 'Save conversation snapshots to memory when you /new (reset session)' },
  { id: 'boot-md', name: 'Boot Script', description: 'Run BOOT.md instructions when the Gateway starts' },
  { id: 'command-logger', name: 'Command Logger', description: 'Audit log of all commands to ~/.openclaw/logs/commands.log' },
  { id: 'bootstrap-extra-files', name: 'Bootstrap Extra Files', description: 'Inject extra workspace files into agent bootstrap' },
];

// Backend masks the token as bullets in GET /gateway/hooks-config so
// it never reaches the dash in plain text. Detect any pure-bullet
// string and treat it as "user did not change the token" — saving it
// back would rewrite the real secret with bullets.
const TOKEN_MASK_REGEX = /^[•*]+$/;
function isMaskedToken(s: string): boolean {
  return s.length > 0 && TOKEN_MASK_REGEX.test(s);
}

const MAPPING_ACTIONS = [
  { value: 'wake', label: 'Wake (system event to main session)' },
  { value: 'agent', label: 'Agent (isolated agent turn)' },
];

const MAPPING_CHANNELS = [
  { value: '', label: 'None (no delivery)' },
  { value: 'last', label: 'Last used channel' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'slack', label: 'Slack' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'signal', label: 'Signal' },
];

interface WebhookMapping {
  id: string;
  path: string;
  action: string;
  messageTemplate: string;
  channel: string;
  to: string;
  deliver: boolean;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <ToggleSwitch checked={value} onChange={onChange} />;
}

export function HooksSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({ internal: true, webhooks: false });

  const [hooksEnabled, setHooksEnabled] = useState(true);
  const [hookToken, setHookToken] = useState('');
  const [internalEnabled, setInternalEnabled] = useState(true);
  const [hookEntries, setHookEntries] = useState<Record<string, { enabled: boolean }>>({});
  const [mappings, setMappings] = useState<WebhookMapping[]>([]);
  const [bundledHooks, setBundledHooks] = useState<AvailableHook[]>(FALLBACK_BUNDLED_HOOKS);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [data, available] = await Promise.all([
        gwService.getHooksConfig(),
        gwService.getAvailableHooks().catch(() => FALLBACK_BUNDLED_HOOKS),
      ]);
      setBundledHooks(available.length > 0 ? available : FALLBACK_BUNDLED_HOOKS);
      setHooksEnabled((data.enabled ?? true) as boolean);
      setHookToken((data.token ?? '') as string);
      const internal = (data.internal ?? {}) as Record<string, unknown>;
      setInternalEnabled((internal.enabled ?? true) as boolean);
      const entries = (internal.entries ?? {}) as Record<string, Record<string, unknown>>;
      const parsed: Record<string, { enabled: boolean }> = {};
      for (const [id, entry] of Object.entries(entries)) {
        parsed[id] = { enabled: (entry.enabled ?? true) as boolean };
      }
      setHookEntries(parsed);
      const rawMappings = (data.mappings ?? []) as Array<Record<string, unknown>>;
      setMappings(rawMappings.map((m, i) => ({
        id: (m.id ?? `mapping-${i}`) as string,
        path: ((m.match as Record<string, unknown>)?.path ?? '') as string,
        action: (m.action ?? 'agent') as string,
        messageTemplate: (m.message_template ?? '') as string,
        channel: (m.channel ?? '') as string,
        to: (m.to ?? '') as string,
        deliver: (m.deliver ?? true) as boolean,
      })));
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to load hooks config')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // Mappings without a `path` are silently dropped on save — surface
  // that count to the user via the Save button label and a hint at
  // the bottom of the mapping list.
  const droppedMappingsCount = useMemo(
    () => mappings.filter((m) => !m.path.trim()).length,
    [mappings],
  );

  const toggleHookEntry = (id: string) => {
    setHookEntries(prev => ({ ...prev, [id]: { enabled: !(prev[id]?.enabled ?? true) } }));
    setDirty(true);
  };

  const addMapping = () => {
    setMappings([...mappings, { id: `mapping-${Date.now()}`, path: '', action: 'agent', messageTemplate: '', channel: '', to: '', deliver: true }]);
    setDirty(true);
  };

  const removeMapping = (idx: number) => {
    setMappings(mappings.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const updateMapping = (idx: number, field: keyof WebhookMapping, value: unknown) => {
    const updated = [...mappings];
    const target = updated[idx];
    if (!target) return;
    (target as unknown as Record<string, unknown>)[field] = value;
    setMappings(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validMappings = mappings.filter((m) => m.path.trim());
      await gwService.updateHooksConfig({
        enabled: hooksEnabled,
        // Don't send the token back if it's still the masked placeholder
        // — that would overwrite the real secret in openclaw.json with bullets.
        ...(hookToken && !isMaskedToken(hookToken) ? { token: hookToken } : {}),
        internal: {
          enabled: internalEnabled,
          entries: hookEntries,
        },
        mappings: validMappings.map((m) => ({
          match: { path: m.path.trim() },
          action: m.action,
          messageTemplate: m.messageTemplate,
          deliver: m.deliver,
          ...(m.channel ? { channel: m.channel } : {}),
          ...(m.to ? { to: m.to } : {}),
        })),
      });
      if (droppedMappingsCount > 0) {
        toast.success(
          `Hooks saved · skipped ${droppedMappingsCount} mapping${droppedMappingsCount === 1 ? '' : 's'} without a path`,
        );
        // Trim the empty rows so the UI matches what was actually saved.
        setMappings(validMappings);
      } else {
        toast.success('Hooks saved');
      }
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to update hooks config')); }
    finally { setSaving(false); }
  };

  return (
    <SectionShell
      title="Hooks & Webhooks"
      description="Event-driven automation: internal hooks (session save, boot scripts) and external webhooks (GitHub, Gmail, custom)."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    >
      {/* Global enable */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Webhooks enabled</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Accept incoming HTTP webhooks at /hooks/*</div>
        </div>
        <Toggle value={hooksEnabled} onChange={v => { setHooksEnabled(v); setDirty(true); }} />
      </div>

      {hooksEnabled && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Webhook token</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {isMaskedToken(hookToken)
                ? 'Token is set. Type a new value to replace it; leave the dots alone to keep the current token.'
                : 'Shared secret for authenticating incoming webhooks (Bearer header)'}
            </div>
          </div>
          <input
            type="text"
            value={hookToken}
            onChange={e => { setHookToken(e.target.value); setDirty(true); }}
            onFocus={(e) => {
              // If the field still holds the masked placeholder, clear
              // it on focus so the user starts from an empty input
              // rather than appending to bullets.
              if (isMaskedToken(e.target.value)) {
                setHookToken('');
                setDirty(true);
              }
            }}
            placeholder="secret-token"
            style={{
              padding: '4px 8px', fontSize: '0.75rem', width: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          />
        </div>
      )}

      {/* Internal hooks */}
      <SettingsBlock title="Internal Hooks" expanded={sections.internal!} onToggle={() => setSections(p => ({ ...p, internal: !p.internal }))}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Internal hooks enabled</span>
          <Toggle value={internalEnabled} onChange={v => { setInternalEnabled(v); setDirty(true); }} />
        </div>
        {bundledHooks.map(hook => (
          <div key={hook.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>{hook.name}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{hook.description}</div>
            </div>
            <Toggle value={hookEntries[hook.id]?.enabled ?? true} onChange={() => toggleHookEntry(hook.id)} />
          </div>
        ))}
      </SettingsBlock>

      {/* Webhook mappings */}
      <SettingsBlock title={`Webhook Mappings (${mappings.length})`} expanded={sections.webhooks!} onToggle={() => setSections(p => ({ ...p, webhooks: !p.webhooks }))}>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
          Map incoming HTTP requests to agent actions. POST /hooks/&lt;path&gt; → agent processes the payload.
        </p>
        {mappings.map((m, idx) => {
          const pathEmpty = !m.path.trim();
          return (
          <div key={m.id} style={{
            padding: '10px 12px',
            background: 'var(--surface)',
            border: `1px solid ${pathEmpty ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Path
                  {pathEmpty && (
                    <span style={{ color: 'var(--amber)', textTransform: 'none', fontSize: '0.625rem' }}>
                      · required, will be skipped on save
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={m.path}
                  onChange={e => updateMapping(idx, 'path', e.target.value)}
                  placeholder="github"
                  style={{
                    width: '100%', padding: '3px 6px', fontSize: '0.75rem',
                    background: 'var(--bg)',
                    border: `1px solid ${pathEmpty ? 'var(--amber)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)',
                  }}
                />
              </div>
              <div style={{ width: 160 }}>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</label>
                <select value={m.action} onChange={e => updateMapping(idx, 'action', e.target.value)} style={{ width: '100%', padding: '3px 6px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                  {MAPPING_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <button onClick={() => removeMapping(idx)} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Trash2 size={12} /></button>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Message template</label>
              <input type="text" value={m.messageTemplate} onChange={e => updateMapping(idx, 'messageTemplate', e.target.value)} placeholder="Push to {{payload.repository.name}}: {{payload.commits[0].message}}" style={{ width: '100%', padding: '3px 6px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deliver to channel</label>
                <select value={m.channel} onChange={e => updateMapping(idx, 'channel', e.target.value)} style={{ width: '100%', padding: '3px 6px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                  {MAPPING_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target (chat/user ID)</label>
                <input type="text" value={m.to} onChange={e => updateMapping(idx, 'to', e.target.value)} placeholder="123456789" style={{ width: '100%', padding: '3px 6px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
              </div>
            </div>
          </div>
          );
        })}
        {droppedMappingsCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', marginBottom: 8,
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.6875rem', color: 'var(--text-dim)',
            fontFamily: 'var(--font-sans)',
          }}>
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>!</span>
            {droppedMappingsCount === 1
              ? '1 mapping has no path and will be skipped on save.'
              : `${droppedMappingsCount} mappings have no path and will be skipped on save.`}
          </div>
        )}
        <button onClick={addMapping} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
          <Plus size={12} /> Add webhook mapping
        </button>
      </SettingsBlock>
    </SectionShell>
  );
}
