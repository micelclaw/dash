/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

const BUNDLED_HOOKS = [
  { id: 'session-memory', name: 'Session Memory', desc: 'Save conversation snapshots to memory when you /new (reset session)' },
  { id: 'boot-md', name: 'Boot Script', desc: 'Run BOOT.md instructions when the Gateway starts' },
  { id: 'command-logger', name: 'Command Logger', desc: 'Audit log of all commands to ~/.openclaw/logs/commands.log' },
  { id: 'bootstrap-extra-files', name: 'Bootstrap Extra Files', desc: 'Inject extra workspace files into agent bootstrap' },
];

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

function Section({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12 }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 14px', background: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{title}
      </button>
      {expanded && <div style={{ padding: '8px 16px 16px', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (<div onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', background: value ? 'var(--success, #22c55e)' : 'var(--text-muted)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}><div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left 0.2s' }} /></div>);
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

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getHooksConfig();
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
    } catch { toast.error('Failed to load hooks config'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

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
    (updated[idx] as Record<string, unknown>)[field] = value;
    setMappings(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateHooksConfig({
        enabled: hooksEnabled,
        ...(hookToken && hookToken !== '••••••••' ? { token: hookToken } : {}),
        internal: {
          enabled: internalEnabled,
          entries: hookEntries,
        },
        mappings: mappings.filter(m => m.path).map(m => ({
          match: { path: m.path },
          action: m.action,
          messageTemplate: m.messageTemplate,
          deliver: m.deliver,
          ...(m.channel ? { channel: m.channel } : {}),
          ...(m.to ? { to: m.to } : {}),
        })),
      });
      toast.success('Hooks config updated');
      setDirty(false);
    } catch { toast.error('Failed to update hooks config'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Hooks & Webhooks</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Event-driven automation: internal hooks (session save, boot scripts) and external webhooks (GitHub, Gmail, custom).
          </p>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600, background: dirty ? 'var(--amber)' : 'var(--surface)', border: dirty ? 'none' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: dirty ? '#000' : 'var(--text-muted)', cursor: dirty ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, fontFamily: 'var(--font-sans)' }}>
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

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
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Shared secret for authenticating incoming webhooks (Bearer header)</div>
          </div>
          <input type="text" value={hookToken} onChange={e => { setHookToken(e.target.value); setDirty(true); }} placeholder="secret-token" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
        </div>
      )}

      {/* Internal hooks */}
      <Section title="Internal Hooks" expanded={sections.internal!} onToggle={() => setSections(p => ({ ...p, internal: !p.internal }))}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Internal hooks enabled</span>
          <Toggle value={internalEnabled} onChange={v => { setInternalEnabled(v); setDirty(true); }} />
        </div>
        {BUNDLED_HOOKS.map(hook => (
          <div key={hook.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>{hook.name}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{hook.desc}</div>
            </div>
            <Toggle value={hookEntries[hook.id]?.enabled ?? true} onChange={() => toggleHookEntry(hook.id)} />
          </div>
        ))}
      </Section>

      {/* Webhook mappings */}
      <Section title={`Webhook Mappings (${mappings.length})`} expanded={sections.webhooks!} onToggle={() => setSections(p => ({ ...p, webhooks: !p.webhooks }))}>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
          Map incoming HTTP requests to agent actions. POST /hooks/&lt;path&gt; → agent processes the payload.
        </p>
        {mappings.map((m, idx) => (
          <div key={m.id} style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Path</label>
                <input type="text" value={m.path} onChange={e => updateMapping(idx, 'path', e.target.value)} placeholder="github" style={{ width: '100%', padding: '3px 6px', fontSize: '0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
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
        ))}
        <button onClick={addMapping} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
          <Plus size={12} /> Add webhook mapping
        </button>
      </Section>
    </div>
  );
}
