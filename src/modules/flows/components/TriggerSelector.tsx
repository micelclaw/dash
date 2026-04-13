/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { Zap } from 'lucide-react';
import { TRIGGER_TYPES } from '../types';

interface TriggerSelectorProps {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}

export function TriggerSelector({ triggerType, triggerConfig, onChange }: TriggerSelectorProps) {
  return (
    <div style={{
      width: '100%', maxWidth: 520, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 8, padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Zap size={14} style={{ color: 'var(--mod-flows)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Trigger</span>
      </div>

      {/* Trigger type selection */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {TRIGGER_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value, {})}
            style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)',
              background: triggerType === t.value ? 'var(--mod-flows-dim)' : 'var(--card)',
              color: triggerType === t.value ? 'var(--mod-flows)' : 'var(--text-dim)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              fontWeight: triggerType === t.value ? 500 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Trigger-specific config */}
      {triggerType === 'cron' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Schedule</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { value: '0 9 * * 1-5', label: 'Weekdays 9 AM' },
              { value: '0 9 * * *', label: 'Daily 9 AM' },
              { value: '0 22 * * *', label: 'Daily 10 PM' },
              { value: '0 10 * * 0', label: 'Sundays 10 AM' },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => onChange('cron', { expression: preset.value })}
                style={{
                  padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)',
                  background: (triggerConfig.expression === preset.value) ? 'var(--mod-flows-dim)' : 'var(--card)',
                  color: (triggerConfig.expression === preset.value) ? 'var(--mod-flows)' : 'var(--text-dim)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            value={(triggerConfig.expression as string) ?? ''}
            onChange={(e) => onChange('cron', { expression: e.target.value })}
            placeholder="Custom cron: 0 9 * * 1-5"
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '5px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </div>
      )}

      {triggerType === 'event' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>When this happens</label>
          <select
            value={(triggerConfig.event as string) ?? ''}
            onChange={(e) => onChange('event', { event: e.target.value })}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '4px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          >
            <option value="">Select event...</option>
            <option value="emails.create">Email received</option>
            <option value="notes.create">Note created</option>
            <option value="notes.update">Note updated</option>
            <option value="contacts.create">Contact created</option>
            <option value="events.create">Calendar event created</option>
            <option value="kanban.card.moved">Card moved</option>
            <option value="kanban.card.created">Card created</option>
            <option value="photos.create">Photo uploaded</option>
          </select>
        </div>
      )}

      {triggerType === 'manual' && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          This flow runs only when you click Execute or when an agent triggers it.
        </div>
      )}

      {triggerType === 'sensor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Home Assistant entity</label>
          <input
            value={(triggerConfig.entity_id as string) ?? ''}
            onChange={(e) => onChange('sensor', { entity_id: e.target.value, state: triggerConfig.state })}
            placeholder="binary_sensor.office_presence"
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '5px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>When state is</label>
          <input
            value={(triggerConfig.state as string) ?? ''}
            onChange={(e) => onChange('sensor', { entity_id: triggerConfig.entity_id, state: e.target.value })}
            placeholder="on"
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '5px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
        </div>
      )}

      {triggerType === 'webhook' && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          A unique URL will be generated after saving. External services can call it to trigger this flow.
        </div>
      )}

      {triggerType === 'context' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>When context changes</label>
          <select
            value={(triggerConfig.signal as string) ?? ''}
            onChange={(e) => onChange('context', { signal: e.target.value })}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '4px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          >
            <option value="">Select signal...</option>
            <option value="activity.became_idle">User became idle</option>
            <option value="activity.became_active">User became active</option>
            <option value="temporal.event_starting">Calendar event starting soon</option>
            <option value="temporal.morning">Morning (first activity)</option>
            <option value="communication.unread_spike">Unread email spike</option>
            <option value="home.arrived">Arrived home</option>
            <option value="home.left">Left home</option>
            <option value="system.ram_pressure">RAM pressure</option>
          </select>
        </div>
      )}
    </div>
  );
}
