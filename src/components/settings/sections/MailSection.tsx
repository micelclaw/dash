import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SaveBar } from '../SaveBar';

const SIGNATURE_OPTIONS = [
  { value: 'below_reply', label: 'Below reply' },
  { value: 'bottom', label: 'At bottom of thread' },
];

const SNOOZE_RELATIVE_OPTIONS = [
  { value: 'tomorrow_9am', label: 'Tomorrow 9 AM' },
  { value: 'next_monday_9am', label: 'Next Monday 9 AM' },
  { value: '+1h', label: 'In 1 hour' },
  { value: '+3h', label: 'In 3 hours' },
  { value: '+1d', label: 'In 1 day' },
  { value: '+1w', label: 'In 1 week' },
  { value: 'custom', label: 'Custom' },
];

export function MailSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const m = settings.mail;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('mail', settings.mail as unknown as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const addSnoozeOption = () => {
    const updated = [...m.snooze_default_options, { label: '', relative: 'tomorrow_9am' }];
    setLocalValue('mail.snooze_default_options', updated);
  };

  const removeSnoozeOption = (index: number) => {
    const updated = m.snooze_default_options.filter((_, i) => i !== index);
    setLocalValue('mail.snooze_default_options', updated);
  };

  const updateSnoozeOption = (index: number, field: 'label' | 'relative', value: string) => {
    const updated = m.snooze_default_options.map((opt, i) =>
      i === index ? { ...opt, [field]: value } : opt,
    );
    setLocalValue('mail.snooze_default_options', updated);
  };

  return (
    <>
      <SettingSection title="Mail" description="Email client preferences.">
        <SettingToggle
          label="Require Send Confirmation"
          description="Ask for confirmation before sending emails"
          checked={m.require_send_confirmation}
          onChange={(v) => setLocalValue('mail.require_send_confirmation', v)}
        />

        <SettingSelect
          label="Signature Position"
          value={m.signature_position}
          options={SIGNATURE_OPTIONS}
          onChange={(v) => setLocalValue('mail.signature_position', v)}
        />

        <SettingInput
          label="Check Interval"
          description="How often to check for new emails (minutes)"
          type="number"
          value={String(m.check_interval_minutes)}
          onChange={(v) => setLocalValue('mail.check_interval_minutes', Math.max(1, Math.min(60, parseInt(v) || 1)))}
          min={1}
          max={60}
        />

        <SettingInput
          label="Max Initial Sync"
          description="Maximum emails to sync per folder on first setup"
          type="number"
          value={String(m.max_sync_emails_initial)}
          onChange={(v) => setLocalValue('mail.max_sync_emails_initial', Math.max(50, parseInt(v) || 500))}
          min={50}
        />
      </SettingSection>

      <SettingSection title="Snooze Options" description="Configure default snooze time options.">
        {m.snooze_default_options.map((opt, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <input
              value={opt.label}
              onChange={(e) => updateSnoozeOption(i, 'label', e.target.value)}
              placeholder="Label"
              style={{
                flex: 1,
                height: 30,
                padding: '0 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <select
              value={opt.relative}
              onChange={(e) => updateSnoozeOption(i, 'relative', e.target.value)}
              style={{
                height: 30,
                padding: '0 24px 0 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 6px center',
              }}
            >
              {SNOOZE_RELATIVE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              onClick={() => removeSnoozeOption(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={addSnoozeOption}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 8,
            padding: '6px 12px',
            background: 'transparent',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add option
        </button>
      </SettingSection>

      <SaveBar visible={!!dirty.mail} saving={saving} onSave={handleSave} onDiscard={() => resetSection('mail')} />
    </>
  );
}
