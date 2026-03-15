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

// ─── Sensor Fusion Settings Section ─────────────────────────────────
// Settings → Sensor Fusion: HA connection, zone mapping, rules management.

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, CheckCircle, XCircle, Trash2, Plus, ChevronDown, ChevronUp,
  Power, Clock, AlertTriangle, Pencil, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingInput } from '../SettingInput';

// ─── Types ──────────────────────────────────────────────

interface SensorRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  cooldownMinutes: number;
  lastTriggered: string | null;
  source: string;
  createdAt: string;
}

interface RuleCondition {
  type: string;
  [key: string]: unknown;
}

interface RuleAction {
  type: string;
  [key: string]: unknown;
}

interface SensorZone {
  id: string;
  name: string;
  haEntity: string;
}

interface FusionStatus {
  haConnected: boolean;
  rulesActive: number;
  lastEvent: string | null;
}

const CONDITION_TYPE_LABELS: Record<string, string> = {
  sensor_state: 'Sensor State',
  context_temporal: 'Time Context',
  context_activity: 'Activity',
  context_home: 'Home Zone',
  calendar: 'Calendar',
  time_window: 'Time Window',
  weather: 'Weather',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  ha_service: 'HA Service',
  notify: 'Notification',
  voice_tts: 'Voice TTS',
  agent_trigger: 'Agent Trigger',
  context_update: 'Context Update',
};

const CONDITION_TYPE_OPTIONS = Object.entries(CONDITION_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const ACTION_TYPE_OPTIONS = Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const OPERATOR_OPTIONS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
];

const ZONE_STATE_OPTIONS = [
  { value: 'present', label: 'Is present' },
  { value: 'clear', label: 'Is clear' },
  { value: 'first_time_today', label: 'First time today' },
];

const WEATHER_FIELD_OPTIONS = [
  { value: 'rain_forecast', label: 'Rain forecast' },
  { value: 'temp_below', label: 'Temp below' },
  { value: 'temp_above', label: 'Temp above' },
];

const DAY_OPTIONS = [
  { value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' }, { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' }, { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

// ─── Shared Styles ──────────────────────────────────────

const smallInput: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
};

const smallSelect: React.CSSProperties = {
  ...smallInput,
  padding: '0 24px 0 8px',
  appearance: 'none',
  cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
};

// ─── Status Dot ─────────────────────────────────────────

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.75rem',
        color: connected ? 'var(--success)' : 'var(--error)',
      }}
    >
      {connected ? <CheckCircle size={14} /> : <XCircle size={14} />}
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  );
}

// ─── Condition Editor Row ───────────────────────────────

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...condition, ...patch });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <select value={condition.type} onChange={(e) => onChange({ type: e.target.value })} style={{ ...smallSelect, width: 130 }}>
        {CONDITION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {condition.type === 'sensor_state' && (
        <>
          <input value={(condition.entity_id as string) || ''} onChange={(e) => set({ entity_id: e.target.value })} placeholder="entity_id" style={{ ...smallInput, flex: 1, minWidth: 140, fontFamily: 'var(--font-mono)' }} />
          <select value={(condition.operator as string) || 'eq'} onChange={(e) => set({ operator: e.target.value })} style={{ ...smallSelect, width: 52 }}>
            {OPERATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input value={(condition.state as string) || ''} onChange={(e) => set({ state: e.target.value })} placeholder="state" style={{ ...smallInput, width: 80 }} />
        </>
      )}

      {condition.type === 'context_home' && (
        <>
          <input value={(condition.zone as string) || ''} onChange={(e) => set({ zone: e.target.value })} placeholder="zone name" style={{ ...smallInput, width: 120 }} />
          <select value={(condition.state as string) || 'present'} onChange={(e) => set({ state: e.target.value })} style={{ ...smallSelect, width: 140 }}>
            {ZONE_STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </>
      )}

      {condition.type === 'time_window' && (
        <>
          <input type="time" value={(condition.start as string) || ''} onChange={(e) => set({ start: e.target.value })} style={{ ...smallInput, width: 100 }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
          <input type="time" value={(condition.end as string) || ''} onChange={(e) => set({ end: e.target.value })} style={{ ...smallInput, width: 100 }} />
          <div style={{ display: 'flex', gap: 2 }}>
            {DAY_OPTIONS.map((d) => {
              const days = (condition.days as string[]) || [];
              const active = days.includes(d.value);
              return (
                <button
                  key={d.value}
                  onClick={() => set({ days: active ? days.filter((x) => x !== d.value) : [...days, d.value] })}
                  style={{
                    ...smallInput,
                    width: 28,
                    height: 24,
                    padding: 0,
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: active ? 'var(--amber)' : 'var(--surface)',
                    color: active ? '#06060a' : 'var(--text-dim)',
                    fontWeight: active ? 600 : 400,
                    fontSize: '0.625rem',
                    border: active ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {(condition.type === 'context_temporal' || condition.type === 'context_activity' || condition.type === 'calendar') && (
        <>
          <input value={(condition.field as string) || ''} onChange={(e) => set({ field: e.target.value })} placeholder="field" style={{ ...smallInput, width: 140 }} />
          <select value={(condition.operator as string) || 'eq'} onChange={(e) => set({ operator: e.target.value })} style={{ ...smallSelect, width: 52 }}>
            {OPERATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input value={String((condition.value as string | number) ?? '')} onChange={(e) => set({ value: e.target.value })} placeholder="value" style={{ ...smallInput, width: 100 }} />
        </>
      )}

      {condition.type === 'weather' && (
        <>
          <select value={(condition.field as string) || 'rain_forecast'} onChange={(e) => set({ field: e.target.value })} style={{ ...smallSelect, width: 130 }}>
            {WEATHER_FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {((condition.field as string) === 'temp_below' || (condition.field as string) === 'temp_above') && (
            <input type="number" value={String((condition.value as number) ?? '')} onChange={(e) => set({ value: Number(e.target.value) })} placeholder="°C" style={{ ...smallInput, width: 70 }} />
          )}
        </>
      )}

      <button onClick={onRemove} style={{ ...iconBtn, color: 'var(--error)', marginLeft: 'auto' }}><Trash2 size={14} /></button>
    </div>
  );
}

// ─── Action Editor Row ──────────────────────────────────

function ActionRow({
  action,
  onChange,
  onRemove,
}: {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
  onRemove: () => void;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...action, ...patch });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <select value={action.type} onChange={(e) => onChange({ type: e.target.value })} style={{ ...smallSelect, width: 130 }}>
        {ACTION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {action.type === 'ha_service' && (
        <>
          <input value={(action.domain as string) || ''} onChange={(e) => set({ domain: e.target.value })} placeholder="light" style={{ ...smallInput, width: 80 }} />
          <input value={(action.service as string) || ''} onChange={(e) => set({ service: e.target.value })} placeholder="turn_on" style={{ ...smallInput, width: 100 }} />
          <input value={(action.entity_id as string) || ''} onChange={(e) => set({ entity_id: e.target.value })} placeholder="entity_id" style={{ ...smallInput, flex: 1, minWidth: 140, fontFamily: 'var(--font-mono)' }} />
        </>
      )}

      {action.type === 'notify' && (
        <input value={(action.message as string) || ''} onChange={(e) => set({ message: e.target.value })} placeholder="Notification message" style={{ ...smallInput, flex: 1, minWidth: 200 }} />
      )}

      {action.type === 'voice_tts' && (
        <>
          <input value={(action.message as string) || ''} onChange={(e) => set({ message: e.target.value })} placeholder="Text to speak" style={{ ...smallInput, flex: 1, minWidth: 200 }} />
          <input value={(action.voice as string) || ''} onChange={(e) => set({ voice: e.target.value })} placeholder="voice (optional)" style={{ ...smallInput, width: 120 }} />
        </>
      )}

      {action.type === 'agent_trigger' && (
        <>
          <input value={(action.prompt as string) || ''} onChange={(e) => set({ prompt: e.target.value })} placeholder="Agent prompt" style={{ ...smallInput, flex: 1, minWidth: 200 }} />
          <input value={(action.agent as string) || ''} onChange={(e) => set({ agent: e.target.value })} placeholder="agent (optional)" style={{ ...smallInput, width: 120 }} />
        </>
      )}

      {action.type === 'context_update' && (
        <input value={(action.signal as string) || ''} onChange={(e) => set({ signal: e.target.value })} placeholder="signal name" style={{ ...smallInput, width: 120 }} />
      )}

      <button onClick={onRemove} style={{ ...iconBtn, color: 'var(--error)', marginLeft: 'auto' }}><Trash2 size={14} /></button>
    </div>
  );
}

// ─── Rule Editor Dialog ─────────────────────────────────

function RuleEditorDialog({
  rule,
  onSave,
  onClose,
}: {
  rule: Partial<SensorRule> | null;
  onSave: (data: { name: string; description: string; conditions: RuleCondition[]; actions: RuleAction[]; cooldownMinutes: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [conditions, setConditions] = useState<RuleCondition[]>(rule?.conditions || []);
  const [actions, setActions] = useState<RuleAction[]>(rule?.actions || []);
  const [cooldownMinutes, setCooldownMinutes] = useState(rule?.cooldownMinutes ?? 15);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { toast.error('Rule name is required'); return; }
    if (conditions.length === 0) { toast.error('Add at least one condition'); return; }
    if (actions.length === 0) { toast.error('Add at least one action'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), conditions, actions, cooldownMinutes });
      onClose();
    } catch {
      toast.error('Failed to save rule');
    }
    setSaving(false);
  }, [name, description, conditions, actions, cooldownMinutes, onSave, onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 600, maxHeight: '85vh', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            {rule?.id ? 'Edit Rule' : 'New Rule'}
          </div>
          <button onClick={onClose} style={{ ...iconBtn, color: 'var(--text-dim)' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Rule name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meeting Mode" style={{ ...smallInput, width: '100%' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Description</div>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" style={{ ...smallInput, width: '100%' }} />
          </div>

          {/* Conditions */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)' }}>Conditions (ALL must match)</div>
              <button
                onClick={() => setConditions((prev) => [...prev, { type: 'sensor_state' }])}
                style={{ display: 'flex', alignItems: 'center', gap: 3, ...smallInput, cursor: 'pointer', padding: '0 8px', height: 24, fontSize: '0.625rem' }}
              >
                <Plus size={10} /> Add
              </button>
            </div>
            {conditions.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>No conditions added.</div>
            )}
            {conditions.map((c, i) => (
              <ConditionRow
                key={i}
                condition={c}
                onChange={(updated) => setConditions((prev) => prev.map((x, j) => (j === i ? updated : x)))}
                onRemove={() => setConditions((prev) => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)' }}>Actions (execute in order)</div>
              <button
                onClick={() => setActions((prev) => [...prev, { type: 'notify' }])}
                style={{ display: 'flex', alignItems: 'center', gap: 3, ...smallInput, cursor: 'pointer', padding: '0 8px', height: 24, fontSize: '0.625rem' }}
              >
                <Plus size={10} /> Add
              </button>
            </div>
            {actions.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>No actions added.</div>
            )}
            {actions.map((a, i) => (
              <ActionRow
                key={i}
                action={a}
                onChange={(updated) => setActions((prev) => prev.map((x, j) => (j === i ? updated : x)))}
                onRemove={() => setActions((prev) => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>

          {/* Cooldown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Cooldown</span>
            <input type="number" value={cooldownMinutes} onChange={(e) => setCooldownMinutes(Number(e.target.value))} min={0} style={{ ...smallInput, width: 60, textAlign: 'center' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>minutes</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '6px 16px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md)', color: '#06060a', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : rule?.id ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Card ──────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onDelete,
  onEdit,
}: {
  rule: SensorRule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (rule: SensorRule) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', opacity: rule.enabled ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => onToggle(rule.id, !rule.enabled)} style={{ ...iconBtn, color: rule.enabled ? 'var(--success)' : 'var(--text-muted)' }} title={rule.enabled ? 'Disable' : 'Enable'}>
          <Power size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
            {rule.name}
            {rule.source === 'built-in' && (
              <span style={{ fontSize: '0.625rem', marginLeft: 6, padding: '1px 5px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-muted)' }}>built-in</span>
            )}
          </div>
          {rule.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{rule.description}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {rule.lastTriggered && (
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} />{new Date(rule.lastTriggered).toLocaleDateString()}
            </span>
          )}
          <button onClick={() => onEdit(rule)} style={{ ...iconBtn, color: 'var(--text-dim)' }} title="Edit"><Pencil size={14} /></button>
          <button onClick={() => setExpanded(!expanded)} style={{ ...iconBtn, color: 'var(--text-dim)' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => onDelete(rule.id)} style={{ ...iconBtn, color: 'var(--error)' }}><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, paddingLeft: 22, fontSize: '0.75rem' }}>
          <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>Conditions ({rule.conditions.length}):</div>
          {rule.conditions.map((c, i) => (
            <div key={i} style={{ color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 2 }}>
              {CONDITION_TYPE_LABELS[c.type] || c.type}
              {c.type === 'sensor_state' && ` → ${(c as Record<string, unknown>).entity_id}`}
              {c.type === 'time_window' && ` → ${(c as Record<string, unknown>).start}–${(c as Record<string, unknown>).end}`}
              {c.type === 'context_home' && ` → ${(c as Record<string, unknown>).zone} (${(c as Record<string, unknown>).state})`}
              {c.type === 'weather' && ` → ${(c as Record<string, unknown>).field}`}
            </div>
          ))}
          <div style={{ color: 'var(--text-dim)', marginTop: 6, marginBottom: 4 }}>Actions ({rule.actions.length}):</div>
          {rule.actions.map((a, i) => (
            <div key={i} style={{ color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 2 }}>
              {ACTION_TYPE_LABELS[a.type] || a.type}
              {a.type === 'ha_service' && ` → ${(a as Record<string, unknown>).domain}.${(a as Record<string, unknown>).service}`}
              {a.type === 'notify' && ` → "${(a as Record<string, unknown>).message}"`}
              {a.type === 'voice_tts' && ` → "${(a as Record<string, unknown>).message}"`}
              {a.type === 'agent_trigger' && ` → "${((a as Record<string, unknown>).prompt as string)?.slice(0, 40)}..."`}
            </div>
          ))}
          <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>Cooldown: {rule.cooldownMinutes} min</div>
        </div>
      )}
    </div>
  );
}

// ─── Zone Row ───────────────────────────────────────────

function ZoneRow({
  zone,
  onChange,
  onRemove,
}: {
  zone: { name: string; haEntity: string };
  onChange: (field: 'name' | 'haEntity', value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <input value={zone.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Zone name" style={{ ...smallInput, flex: 1 }} />
      <input value={zone.haEntity} onChange={(e) => onChange('haEntity', e.target.value)} placeholder="binary_sensor.office_presence" style={{ ...smallInput, flex: 2, fontFamily: 'var(--font-mono)' }} />
      <button onClick={onRemove} style={{ ...iconBtn, color: 'var(--error)' }}><Trash2 size={14} /></button>
    </div>
  );
}

// ─── Main Section ───────────────────────────────────────

export function SensorFusionSection() {
  const [status, setStatus] = useState<FusionStatus | null>(null);
  const [rules, setRules] = useState<SensorRule[]>([]);
  const [zones, setZones] = useState<Array<{ name: string; haEntity: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingZones, setSavingZones] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<SensorRule> | null | undefined>(undefined);
  // undefined = closed, null = new, object = editing

  const settings = useSettingsStore((s) => s.settings);
  const patchSettings = useSettingsStore((s) => s.patchSettings) as ((patch: Record<string, unknown>) => Promise<void>) | undefined;

  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');

  useEffect(() => {
    if (settings) {
      const sf = (settings as Record<string, unknown>).sensorFusion as Record<string, string> | undefined;
      if (sf) {
        setHaUrl(sf.haUrl || '');
        setHaToken(sf.haToken || '');
      }
    }
  }, [settings]);

  useEffect(() => {
    Promise.all([
      api.get<{ data: FusionStatus }>('/sensor-fusion/status').catch(() => ({ data: { haConnected: false, rulesActive: 0, lastEvent: null } })),
      api.get<{ data: SensorRule[] }>('/sensor-fusion/rules').catch(() => ({ data: [] })),
      api.get<{ data: SensorZone[] }>('/sensor-fusion/zones').catch(() => ({ data: [] })),
    ])
      .then(([statusRes, rulesRes, zonesRes]) => {
        setStatus(statusRes.data);
        setRules(rulesRes.data);
        setZones(zonesRes.data.map((z) => ({ name: z.name, haEntity: z.haEntity })));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggleRule = useCallback(async (id: string, enabled: boolean) => {
    try {
      await api.put(`/sensor-fusion/rules/${id}`, { enabled });
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
      toast.success(enabled ? 'Rule enabled' : 'Rule disabled');
    } catch {
      toast.error('Failed to update rule');
    }
  }, []);

  const handleDeleteRule = useCallback(async (id: string) => {
    try {
      await api.delete(`/sensor-fusion/rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  }, []);

  const handleSaveRule = useCallback(async (data: { name: string; description: string; conditions: RuleCondition[]; actions: RuleAction[]; cooldownMinutes: number }) => {
    const ruleId = (editingRule as SensorRule)?.id;
    const payload = {
      name: data.name,
      description: data.description,
      conditions: data.conditions,
      actions: data.actions,
      cooldown_minutes: data.cooldownMinutes,
    };

    if (ruleId) {
      const res = await api.put<{ data: SensorRule }>(`/sensor-fusion/rules/${ruleId}`, payload);
      setRules((prev) => prev.map((r) => (r.id === ruleId ? res.data : r)));
      toast.success('Rule updated');
    } else {
      const res = await api.post<{ data: SensorRule }>('/sensor-fusion/rules', payload);
      setRules((prev) => [...prev, res.data]);
      toast.success('Rule created');
    }
  }, [editingRule]);

  const handleImportBuiltIn = useCallback(async () => {
    setImporting(true);
    try {
      const res = await api.post<{ data: SensorRule[] }>('/sensor-fusion/rules/import-built-in');
      setRules((prev) => [...prev, ...res.data]);
      toast.success(`Imported ${res.data.length} built-in rules`);
    } catch {
      toast.error('Failed to import rules');
    }
    setImporting(false);
  }, []);

  const handleSaveZones = useCallback(async () => {
    setSavingZones(true);
    try {
      const payload = zones
        .filter((z) => z.name.trim() && z.haEntity.trim())
        .map((z) => ({ name: z.name.trim(), ha_entity: z.haEntity.trim() }));
      await api.put('/sensor-fusion/zones', { zones: payload });
      toast.success('Zones saved');
    } catch {
      toast.error('Failed to save zones');
    }
    setSavingZones(false);
  }, [zones]);

  const handleSaveHaConfig = useCallback(async () => {
    if (!patchSettings) return;
    try {
      await patchSettings({ sensorFusion: { haUrl, haToken } });
      toast.success('HA configuration saved');
    } catch {
      toast.error('Failed to save HA config');
    }
  }, [haUrl, haToken, patchSettings]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', padding: 24 }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Loading sensor fusion settings...
      </div>
    );
  }

  return (
    <>
      {/* HA Connection */}
      <SettingSection
        title="Home Assistant Connection"
        description="Connect to your Home Assistant instance for sensor data and service calls."
        action={
          <button onClick={handleSaveHaConfig} style={{ padding: '4px 12px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            Save
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Status</span>
          {status && <StatusDot connected={status.haConnected} />}
        </div>
        <SettingInput label="HA URL" value={haUrl} onChange={setHaUrl} type="url" placeholder="http://homeassistant.local:8123" />
        <SettingInput label="Access Token" value={haToken} onChange={setHaToken} placeholder="Long-lived access token" />
        {status && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Active rules</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{status.rulesActive}</span>
          </div>
        )}
      </SettingSection>

      {/* Zone Mapping */}
      <SettingSection
        title="Zone Mapping"
        description="Map Home Assistant presence entities to logical zones."
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setZones((prev) => [...prev, { name: '', haEntity: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
              <Plus size={12} /> Add
            </button>
            <button onClick={handleSaveZones} disabled={savingZones} style={{ padding: '4px 12px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: savingZones ? 'not-allowed' : 'pointer', opacity: savingZones ? 0.5 : 1 }}>
              {savingZones ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        {zones.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '12px 0' }}>
            No zones configured. Add zones to map HA entities to logical locations.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zone</span>
              <span style={{ flex: 2, fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HA Entity</span>
              <span style={{ width: 14 }} />
            </div>
            {zones.map((zone, i) => (
              <ZoneRow key={i} zone={zone} onChange={(field, value) => setZones((prev) => prev.map((z, j) => (j === i ? { ...z, [field]: value } : z)))} onRemove={() => setZones((prev) => prev.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
      </SettingSection>

      {/* Rules */}
      <SettingSection
        title="Automation Rules"
        description="Sensor-driven rules that trigger actions based on home state and context."
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditingRule(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
              <Plus size={12} /> Add Rule
            </button>
            <button onClick={handleImportBuiltIn} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.5 : 1 }}>
              {importing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
              Import Built-in
            </button>
          </div>
        }
      >
        {rules.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <AlertTriangle size={20} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No rules configured</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Add a rule or import built-in rules to get started.</div>
          </div>
        ) : (
          rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onToggle={handleToggleRule} onDelete={handleDeleteRule} onEdit={(r) => setEditingRule(r)} />
          ))
        )}
      </SettingSection>

      {/* Rule Editor Dialog */}
      {editingRule !== undefined && (
        <RuleEditorDialog rule={editingRule} onSave={handleSaveRule} onClose={() => setEditingRule(undefined)} />
      )}
    </>
  );
}
