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

import { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Hand,
  Clock,
  Bell,
  Activity,
  Globe,
  Brain,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface TriggerSelectorProps {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  /** When editing an existing flow, the auto-generated webhook secret. */
  webhookSecret?: string;
  flowId?: string;
  onChange: (type: string, config: Record<string, unknown>) => void;
}

interface TriggerCard {
  value: string;
  label: string;
  icon: typeof Zap;
  description: string;
  example: string;
  color: string;
}

const TRIGGER_CARDS: TriggerCard[] = [
  {
    value: 'manual',
    label: 'Manual',
    icon: Hand,
    description: 'You (or an agent) starts it explicitly. No automatic firing.',
    example: 'Run this with the Play button when you want it.',
    color: '#6b7280',
  },
  {
    value: 'cron',
    label: 'Scheduled',
    icon: Clock,
    description: 'Runs on a recurring schedule. Uses standard cron syntax.',
    example: 'Every weekday at 9 AM, every Sunday morning…',
    color: '#3b82f6',
  },
  {
    value: 'event',
    label: 'On data change',
    icon: Bell,
    description: "Fires when something is created or modified in your data.",
    example: 'A new email arrives, a contact is added, a note is updated…',
    color: '#10b981',
  },
  {
    value: 'sensor',
    label: 'Home Assistant',
    icon: Activity,
    description: 'Reacts to a Home Assistant entity changing state.',
    example: 'binary_sensor.office_presence turns on, light.kitchen reaches 100%.',
    color: '#06b6d4',
  },
  {
    value: 'webhook',
    label: 'Webhook',
    icon: Globe,
    description: 'External services hit a unique URL. Useful for IFTTT, GitHub, Slack.',
    example: 'A Zap from another service POSTs to your URL.',
    color: '#f59e0b',
  },
  {
    value: 'context',
    label: 'Context signal',
    icon: Brain,
    description: 'Reacts to behavioral signals: idle, calendar event starting, unread spike.',
    example: 'When you become idle for 10 min, when a meeting is about to start.',
    color: '#a855f7',
  },
];

interface CronPreview {
  valid: boolean;
  error?: string;
  next_runs: string[];
}

interface EventKey {
  key: string;
  label: string;
  domain: string;
}

const CONTEXT_SIGNALS: Array<{ value: string; label: string }> = [
  { value: 'activity.became_idle', label: 'I became idle' },
  { value: 'activity.became_active', label: 'I became active' },
  { value: 'temporal.event_starting', label: 'A calendar event is starting soon' },
  { value: 'temporal.morning', label: 'Morning (first activity of the day)' },
  { value: 'communication.unread_spike', label: 'Unread email spike' },
  { value: 'home.arrived', label: 'I arrived home' },
  { value: 'home.left', label: 'I left home' },
  { value: 'system.ram_pressure', label: 'RAM pressure' },
];

const CRON_PRESETS: Array<{ value: string; label: string }> = [
  { value: '0 9 * * 1-5', label: 'Weekdays 9 AM' },
  { value: '0 9 * * *', label: 'Daily 9 AM' },
  { value: '0 22 * * *', label: 'Daily 10 PM' },
  { value: '0 10 * * 0', label: 'Sundays 10 AM' },
  { value: '*/30 * * * *', label: 'Every 30 min' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
];

export function TriggerSelector({ triggerType, triggerConfig, webhookSecret, flowId, onChange }: TriggerSelectorProps) {
  return (
    <div style={{
      width: '100%', maxWidth: 720, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 10, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Zap size={16} style={{ color: 'var(--mod-flows)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          When should this run?
        </span>
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 8, marginBottom: 14,
      }}>
        {TRIGGER_CARDS.map((card) => {
          const Icon = card.icon;
          const active = triggerType === card.value;
          return (
            <button
              key={card.value}
              onClick={() => onChange(card.value, {})}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                textAlign: 'left',
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${active ? card.color : 'var(--border)'}`,
                background: active ? `${card.color}10` : 'var(--card)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={14} style={{ color: card.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: active ? card.color : 'var(--text)' }}>
                  {card.label}
                </span>
              </div>
              <p style={{
                margin: 0, fontSize: 10.5, color: 'var(--text-dim)',
                lineHeight: 1.35,
              }}>
                {card.description}
              </p>
              <p style={{
                margin: 0, fontSize: 10, color: 'var(--text-muted)',
                fontStyle: 'italic', lineHeight: 1.3,
              }}>
                {card.example}
              </p>
            </button>
          );
        })}
      </div>

      {/* Per-trigger config form */}
      {triggerType === 'manual' && <ManualConfig />}
      {triggerType === 'cron' && <CronConfig triggerConfig={triggerConfig} onChange={onChange} />}
      {triggerType === 'event' && <EventConfig triggerConfig={triggerConfig} onChange={onChange} />}
      {triggerType === 'sensor' && <SensorConfig triggerConfig={triggerConfig} onChange={onChange} />}
      {triggerType === 'webhook' && <WebhookConfig flowId={flowId} secret={webhookSecret} />}
      {triggerType === 'context' && <ContextConfig triggerConfig={triggerConfig} onChange={onChange} />}
    </div>
  );
}

// ─── Per-trigger config blocks ──────────────────────────────────────

function ManualConfig() {
  return (
    <div style={hintBoxStyle}>
      Manual flows show a Play button on their card and can be triggered by an agent
      via the <code style={codeStyle}>claw-flows.run</code> skill.
    </div>
  );
}

function CronConfig({ triggerConfig, onChange }: {
  triggerConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}) {
  const expression = (triggerConfig.expression as string) ?? '';
  const [preview, setPreview] = useState<CronPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expression.trim()) { setPreview(null); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.post<{ data: CronPreview }>('/flows/cron-preview', { expression });
        if (!cancelled) setPreview(res.data);
      } catch {
        if (!cancelled) setPreview({ valid: false, error: 'Validation request failed', next_runs: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [expression]);

  return (
    <div style={configBlockStyle}>
      <label style={labelStyle}>Schedule</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {CRON_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onChange('cron', { expression: preset.value })}
            style={{
              ...chipBtnStyle,
              borderColor: expression === preset.value ? 'var(--mod-flows)' : 'var(--border)',
              color: expression === preset.value ? 'var(--mod-flows)' : 'var(--text-dim)',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <input
        value={expression}
        onChange={(e) => onChange('cron', { expression: e.target.value })}
        placeholder="0 9 * * 1-5"
        style={inputStyle}
      />

      {/* Inline preview */}
      <div style={{ marginTop: 8, minHeight: 36 }}>
        {loading && (
          <div style={previewMutedStyle}>
            <Loader2 size={11} className="animate-spin" /> Validating…
          </div>
        )}
        {!loading && preview?.valid && preview.next_runs.length > 0 && (
          <div style={{ ...previewMutedStyle, color: 'var(--success)' }}>
            <CheckCircle2 size={11} /> Next runs: {preview.next_runs.slice(0, 3).map((iso) =>
              new Date(iso).toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            ).join(' · ')}
          </div>
        )}
        {!loading && preview && !preview.valid && (
          <div style={{ ...previewMutedStyle, color: 'var(--error)' }}>
            <XCircle size={11} /> {preview.error ?? 'Invalid cron expression'}
          </div>
        )}
      </div>
    </div>
  );
}

function EventConfig({ triggerConfig, onChange }: {
  triggerConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}) {
  const event = (triggerConfig.event as string) ?? '';
  const [keys, setKeys] = useState<EventKey[]>([]);

  useEffect(() => {
    api.get<{ data: EventKey[] }>('/flows/event-keys')
      .then((res) => setKeys(res.data ?? []))
      .catch((err) => console.error('Failed to load event keys', err));
  }, []);

  // Group by domain for the picker.
  const grouped = useMemo(() => {
    const m = new Map<string, EventKey[]>();
    for (const k of keys) {
      const list = m.get(k.domain) ?? [];
      list.push(k);
      m.set(k.domain, list);
    }
    return m;
  }, [keys]);

  return (
    <div style={configBlockStyle}>
      <label style={labelStyle}>When this happens</label>
      <select
        value={event}
        onChange={(e) => onChange('event', { event: e.target.value })}
        style={inputStyle}
      >
        <option value="">Select an event…</option>
        {[...grouped.entries()].map(([domain, items]) => (
          <optgroup key={domain} label={domain}>
            {items.map((k) => (
              <option key={k.key} value={k.key}>{k.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {keys.length === 0 && (
        <p style={hintBoxStyle}>Loading available events…</p>
      )}
    </div>
  );
}

function SensorConfig({ triggerConfig, onChange }: {
  triggerConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}) {
  const entityId = (triggerConfig.entity_id as string) ?? '';
  const state = (triggerConfig.state as string) ?? '';
  return (
    <div style={configBlockStyle}>
      <label style={labelStyle}>Home Assistant entity ID</label>
      <input
        value={entityId}
        onChange={(e) => onChange('sensor', { entity_id: e.target.value, state })}
        placeholder="binary_sensor.office_presence"
        style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
      />
      <label style={{ ...labelStyle, marginTop: 8 }}>Trigger when state becomes</label>
      <input
        value={state}
        onChange={(e) => onChange('sensor', { entity_id: entityId, state: e.target.value })}
        placeholder="on"
        style={inputStyle}
      />
      <p style={hintBoxStyle}>
        Leave state empty to fire on <em>any</em> state change of the entity.
      </p>
    </div>
  );
}

function WebhookConfig({ flowId, secret }: { flowId?: string; secret?: string }) {
  const url = flowId ? `${window.location.origin}/api/v1/flows/${flowId}/webhook` : '';
  const curlExample = flowId && secret
    ? `curl -X POST -H "Authorization: Bearer ${secret}" \\\n  ${url} -d '{"hello":"world"}'`
    : '';

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Copy failed'),
    );
  };

  if (!flowId) {
    return (
      <div style={hintBoxStyle}>
        Save the flow first — a unique URL and secret will be generated automatically.
      </div>
    );
  }

  return (
    <div style={configBlockStyle}>
      <label style={labelStyle}>Webhook URL</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={url} readOnly style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
        <button onClick={() => copy(url, 'URL')} style={iconBtnStyle} title="Copy URL">
          <Copy size={12} />
        </button>
      </div>

      {secret && (
        <>
          <label style={{ ...labelStyle, marginTop: 8 }}>Authorization secret</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={secret} readOnly type="password" style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
            <button onClick={() => copy(secret, 'Secret')} style={iconBtnStyle} title="Copy secret">
              <Copy size={12} />
            </button>
          </div>
          <label style={{ ...labelStyle, marginTop: 8 }}>Example call</label>
          <pre style={{
            margin: 0, padding: 8, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>{curlExample}</pre>
          <button
            onClick={() => copy(curlExample, 'Example')}
            style={{ ...secondaryBtnStyle, marginTop: 6 }}
          >
            <Copy size={11} /> Copy example
          </button>
        </>
      )}

      <p style={hintBoxStyle}>
        External services POST to this URL with the secret as a Bearer token.
        Rate-limited to 6 calls per minute.
      </p>
    </div>
  );
}

function ContextConfig({ triggerConfig, onChange }: {
  triggerConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}) {
  const signal = (triggerConfig.signal as string) ?? '';
  return (
    <div style={configBlockStyle}>
      <label style={labelStyle}>Trigger on signal</label>
      <select
        value={signal}
        onChange={(e) => onChange('context', { signal: e.target.value })}
        style={inputStyle}
      >
        <option value="">Select a signal…</option>
        {CONTEXT_SIGNALS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--text-dim)',
  marginBottom: 4, fontWeight: 500, fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  flex: 1, width: '100%',
  background: 'var(--card)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 4,
  padding: '6px 10px', fontSize: 12,
  fontFamily: 'var(--font-sans)', outline: 'none',
};

const chipBtnStyle: React.CSSProperties = {
  padding: '3px 8px', borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontSize: 11, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, padding: 4,
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text-dim)',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', background: 'var(--card)',
  border: '1px solid var(--border)', borderRadius: 4,
  color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const configBlockStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 10,
};

const hintBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: 'var(--surface)',
  border: '1px dashed var(--border)',
  borderRadius: 4,
  fontSize: 11, color: 'var(--text-dim)',
  lineHeight: 1.5,
};

const previewMutedStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 11, color: 'var(--text-muted)',
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  background: 'var(--card)',
  padding: '0 4px', borderRadius: 3,
  fontSize: 10,
};
