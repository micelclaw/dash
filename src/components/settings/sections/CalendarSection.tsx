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

import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';

const FIRST_DAY_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '0', label: 'Sunday' },
];

const VIEW_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
];

const REMINDER_OPTIONS = [
  { value: '', label: 'None' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: 'custom', label: 'Custom…' },
];

// Treat any non-preset numeric value as "custom" so the input shows up
// when re-opening the page with an unusual reminder (e.g. 720 = 12h).
const PRESET_REMINDER_VALUES = new Set(['', '5', '10', '15', '30', '60']);

export function CalendarSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings?.calendar) return null;
  const c = settings.calendar;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('calendar', settings.calendar as unknown as Record<string, unknown>);
      toast.success('Calendar saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    height: 30, padding: '0 8px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
  };

  return (
    <>
      <SettingSection title="Calendar" description="Display and behavior preferences for the calendar.">
        <SettingSelect
          label="First Day of Week"
          description="Synced with General Settings — changing it here updates there too."
          value={String(c.first_day_of_week)}
          options={FIRST_DAY_OPTIONS}
          onChange={(v) => setLocalValue('calendar.first_day_of_week', parseInt(v))}
        />
        <SettingSelect
          label="Default View"
          description="View shown when opening the calendar."
          value={c.default_view}
          options={VIEW_OPTIONS}
          onChange={(v) => setLocalValue('calendar.default_view', v)}
        />
        {/* Reminder selector: presets + Custom… input. The "custom" option
            shows a numeric input below; any value not in the preset list is
            considered custom on re-open. */}
        {(() => {
          const currentMinutes = c.default_reminder_minutes;
          const currentStr = currentMinutes != null ? String(currentMinutes) : '';
          const isCustom = currentMinutes != null && !PRESET_REMINDER_VALUES.has(currentStr);
          const selectValue = isCustom ? 'custom' : currentStr;
          return (
            <>
              <SettingSelect
                label="Default Reminder"
                description="Reminder added to new events by default."
                value={selectValue}
                options={REMINDER_OPTIONS}
                onChange={(v) => {
                  if (v === 'custom') {
                    // Switch to custom mode — pre-fill with current value
                    // if numeric, otherwise default to 120 (2h).
                    setLocalValue('calendar.default_reminder_minutes', currentMinutes ?? 120);
                  } else {
                    setLocalValue('calendar.default_reminder_minutes', v ? parseInt(v) : null);
                  }
                }}
              />
              {(isCustom || selectValue === 'custom') && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 12px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Custom value (minutes)</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Examples: 720 = 12h, 4320 = 3 days, 10080 = 1 week.
                    </div>
                  </div>
                  <input
                    type="number"
                    value={currentMinutes ?? 120}
                    min={1}
                    max={43200}
                    onChange={(e) => setLocalValue('calendar.default_reminder_minutes', parseInt(e.target.value, 10) || 120)}
                    style={{ ...inputStyle, width: 90, textAlign: 'right' }}
                  />
                </div>
              )}
            </>
          );
        })()}

        {/* Working hours */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              Working Hours
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
              Highlighted range in week/day views.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="time"
              value={c.working_hours_start}
              onChange={(e) => setLocalValue('calendar.working_hours_start', e.target.value)}
              style={inputStyle}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="time"
              value={c.working_hours_end}
              onChange={(e) => setLocalValue('calendar.working_hours_end', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </SettingSection>

      <SaveBar visible={!!dirty.calendar} saving={saving} onSave={handleSave} onDiscard={() => resetSection('calendar')} />
    </>
  );
}
