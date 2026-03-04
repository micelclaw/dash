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
];

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
      toast.success('Settings saved');
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
        <SettingSelect
          label="Default Reminder"
          description="Reminder added to new events by default."
          value={c.default_reminder_minutes != null ? String(c.default_reminder_minutes) : ''}
          options={REMINDER_OPTIONS}
          onChange={(v) => setLocalValue('calendar.default_reminder_minutes', v ? parseInt(v) : null)}
        />

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
