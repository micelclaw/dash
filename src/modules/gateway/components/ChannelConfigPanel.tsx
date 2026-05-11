/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, X, RotateCcw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { useGatewayStore } from '@/stores/gateway.store';

interface ChannelConfigPanelProps {
  channelType: string;
  onClose: () => void;
}

const DM_POLICIES = [
  { value: 'pairing', label: 'Pairing', desc: 'Unknown senders must be approved' },
  { value: 'allowlist', label: 'Allowlist', desc: 'Only pre-approved IDs' },
  { value: 'open', label: 'Open', desc: 'Anyone can send DMs' },
  { value: 'disabled', label: 'Disabled', desc: 'No DMs accepted' },
];

const GROUP_POLICIES = [
  { value: 'allowlist', label: 'Allowlist', desc: 'Only approved groups' },
  { value: 'open', label: 'Open', desc: 'Any group the bot is in' },
  { value: 'disabled', label: 'Disabled', desc: 'No group messages' },
];

const STREAMING_MODES = [
  { value: 'off', label: 'Off', desc: 'Full message at once' },
  { value: 'partial', label: 'Partial', desc: 'Live editing (recommended)' },
  { value: 'block', label: 'Block', desc: 'Send text blocks as they complete' },
];

const REPLY_MODES = [
  { value: 'off', label: 'Off' },
  { value: 'first', label: 'First message only' },
  { value: 'all', label: 'All messages' },
];

// Actions available per channel type
const CHANNEL_ACTIONS: Record<string, string[]> = {
  telegram: ['reactions', 'sendMessage', 'deleteMessage', 'sticker'],
  discord: ['reactions', 'messages', 'threads', 'pins', 'search', 'memberInfo', 'roleInfo', 'channelInfo', 'moderation', 'voiceStatus', 'events', 'stickers', 'polls'],
  slack: ['reactions', 'messages', 'pins', 'memberInfo', 'emojiList'],
  whatsapp: ['reactions', 'polls'],
  signal: ['reactions'],
};

function SelectRow({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string; desc?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', flex: 1 }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '4px 8px', fontSize: '0.75rem', minWidth: 140,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}{o.desc ? ` — ${o.desc}` : ''}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
          background: value ? 'var(--success, #22c55e)' : 'var(--text-muted)',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left 0.2s',
        }} />
      </div>
    </div>
  );
}

function NumberRow({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', flex: 1 }}>{label}</span>
      <input
        type="number" value={value} min={min} max={max}
        onChange={e => onChange(parseInt(e.target.value, 10) || min)}
        style={{
          padding: '4px 8px', fontSize: '0.75rem', width: 70, textAlign: 'right',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          fontFamily: 'var(--font-mono, var(--font-sans))',
        }}
      />
    </div>
  );
}

function Section({ title, expanded, onToggle, children }: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '10px 0', background: 'transparent', border: 'none',
          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
          color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', textAlign: 'left',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {expanded && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  );
}

export function ChannelConfigPanel({ channelType, onClose }: ChannelConfigPanelProps) {
  const channels = useGatewayStore(s => s.channels);
  const channelRuntime = channels.find(c => c.type === channelType);
  const isConnected = channelRuntime?.status === 'connected';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown>>({});
  const [sections, setSections] = useState<Record<string, boolean>>({
    access: true, messaging: false, actions: false, advanced: false,
  });

  const toggleSection = (key: string) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getChannelConfig(channelType);
      setConfig(data);
      setOriginalConfig(data);
      setDirty(false);
    } catch {
      toast.error(`Failed to load ${channelType} config`);
    } finally {
      setLoading(false);
    }
  }, [channelType]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateField = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateNestedField = (parent: string, key: string, value: unknown) => {
    setConfig(prev => {
      const parentObj = (prev[parent] ?? {}) as Record<string, unknown>;
      return { ...prev, [parent]: { ...parentObj, [key]: value } };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send changed fields
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (JSON.stringify(value) !== JSON.stringify(originalConfig[key])) {
          patch[key] = value;
        }
      }
      if (Object.keys(patch).length === 0) {
        setDirty(false);
        return;
      }
      await gwService.updateChannelConfig(channelType, patch);
      setOriginalConfig({ ...config });
      setDirty(false);
      toast.success(`${channelType} config updated`);
    } catch {
      toast.error(`Failed to update ${channelType} config`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({ ...originalConfig });
    setDirty(false);
  };

  const channelLabel = channelType.charAt(0).toUpperCase() + channelType.slice(1);
  const availableActions = CHANNEL_ACTIONS[channelType] ?? [];

  if (loading) {
    return (
      <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
        Loading {channelLabel} config...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg)', borderLeft: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
          {channelLabel} Configuration
        </h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {dirty && (
            <>
              <span style={{ fontSize: '0.6875rem', color: 'var(--warning)', marginRight: 4 }}>unsaved</span>
              <button onClick={handleReset} title="Reset" style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '4px 6px', cursor: 'pointer',
                color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
              }}>
                <RotateCcw size={12} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
                  background: 'var(--error)', border: 'none',
                  borderRadius: 'var(--radius-sm)', color: '#fff',
                  cursor: 'pointer', opacity: saving ? 0.7 : 1,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Save size={12} /> Save
              </button>
            </>
          )}
          <button onClick={onClose} title="Close" style={{
            background: 'transparent', border: 'none', padding: 4,
            cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
          }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {/* Runtime mismatch banner: config says enabled but runtime shows
            login_required (bad token / offline). Changes still save but
            won't take effect until the channel reconnects. */}
        {channelRuntime && config.enabled !== false && !isConnected && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            margin: '12px 0 0',
            padding: '8px 12px',
            background: '#f9731620',
            border: '1px solid #f97316',
            borderRadius: 'var(--radius-sm)',
            color: '#f97316',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            fontFamily: 'var(--font-sans)',
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Channel is not connected at runtime (status: <strong>{channelRuntime.status}</strong>).
              Changes will save but won't apply until the channel reconnects (re-login or fix the token).
            </span>
          </div>
        )}
        {/* Enabled toggle */}
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <ToggleRow
            label="Channel enabled"
            value={config.enabled !== false}
            onChange={v => updateField('enabled', v)}
          />
        </div>

        {/* Access policies */}
        <Section title="Access Policies" expanded={sections.access!} onToggle={() => toggleSection('access')}>
          <SelectRow
            label="DM policy"
            value={(config.dm_policy ?? 'pairing') as string}
            options={DM_POLICIES}
            onChange={v => updateField('dmPolicy', v)}
          />
          <SelectRow
            label="Group policy"
            value={(config.group_policy ?? 'allowlist') as string}
            options={GROUP_POLICIES}
            onChange={v => updateField('groupPolicy', v)}
          />
          <ToggleRow
            label="Require mention in groups"
            value={(config.require_mention ?? true) as boolean}
            onChange={v => updateField('requireMention', v)}
          />
        </Section>

        {/* Messaging */}
        <Section title="Messaging" expanded={sections.messaging!} onToggle={() => toggleSection('messaging')}>
          <SelectRow
            label="Streaming"
            value={(config.streaming ?? 'off') as string}
            options={STREAMING_MODES}
            onChange={v => updateField('streaming', v)}
          />
          <SelectRow
            label="Reply threading"
            value={(config.reply_to_mode ?? 'off') as string}
            options={REPLY_MODES}
            onChange={v => updateField('replyToMode', v)}
          />
          <NumberRow
            label="History limit"
            value={(config.history_limit ?? 50) as number}
            min={0} max={200}
            onChange={v => updateField('historyLimit', v)}
          />
          <NumberRow
            label="Text chunk limit"
            value={(config.text_chunk_limit ?? 4000) as number}
            min={500} max={10000}
            onChange={v => updateField('textChunkLimit', v)}
          />
          <ToggleRow
            label="Link preview"
            value={(config.link_preview ?? true) as boolean}
            onChange={v => updateField('linkPreview', v)}
          />
          {(channelType === 'whatsapp' || channelType === 'signal') && (
            <ToggleRow
              label="Send read receipts"
              value={(config.send_read_receipts ?? true) as boolean}
              onChange={v => updateField('sendReadReceipts', v)}
            />
          )}
        </Section>

        {/* Actions */}
        {availableActions.length > 0 && (
          <Section title="Actions" expanded={sections.actions!} onToggle={() => toggleSection('actions')}>
            {availableActions.map(action => {
              const actions = (config.actions ?? {}) as Record<string, boolean>;
              const enabled = actions[action] !== false;
              return (
                <ToggleRow
                  key={action}
                  label={action.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  value={enabled}
                  onChange={v => updateNestedField('actions', action, v)}
                />
              );
            })}
          </Section>
        )}

        {/* Advanced (channel-specific) */}
        <Section title="Advanced" expanded={sections.advanced!} onToggle={() => toggleSection('advanced')}>
          {channelType === 'telegram' && (
            <>
              <SelectRow
                label="Reaction notifications"
                value={(config.reaction_notifications ?? 'own') as string}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'own', label: 'Own messages only' },
                  { value: 'all', label: 'All messages' },
                ]}
                onChange={v => updateField('reactionNotifications', v)}
              />
            </>
          )}
          {channelType === 'discord' && (
            <>
              <SelectRow
                label="Bot status"
                value={(config.status ?? 'online') as string}
                options={[
                  { value: 'online', label: 'Online' },
                  { value: 'idle', label: 'Idle' },
                  { value: 'dnd', label: 'Do Not Disturb' },
                  { value: 'invisible', label: 'Invisible' },
                ]}
                onChange={v => updateField('status', v)}
              />
              <ToggleRow
                label="Thread bindings"
                value={((config.thread_bindings) as Record<string, unknown>)?.enabled as boolean ?? false}
                onChange={v => updateNestedField('threadBindings', 'enabled', v)}
              />
            </>
          )}
          {channelType === 'slack' && (
            <>
              <SelectRow
                label="Mode"
                value={(config.mode ?? 'socket') as string}
                options={[
                  { value: 'socket', label: 'Socket Mode' },
                  { value: 'http', label: 'HTTP Events API' },
                ]}
                onChange={v => updateField('mode', v)}
              />
              <ToggleRow
                label="Native streaming"
                value={(config.native_streaming ?? true) as boolean}
                onChange={v => updateField('nativeStreaming', v)}
              />
            </>
          )}
          <NumberRow
            label="Media max (MB)"
            value={(config.media_max_mb ?? 50) as number}
            min={1} max={200}
            onChange={v => updateField('mediaMaxMb', v)}
          />
        </Section>

        {/* Bottom spacer */}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
