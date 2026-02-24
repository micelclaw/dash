import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';

const LANGUAGES = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'pt', label: '🇧🇷 Português' },
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'zh', label: '🇨🇳 中文' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const TIME_FORMATS = [
  { value: '24h', label: '24-hour' },
  { value: '12h', label: '12-hour' },
];

const SEARCH_MODES = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'fulltext', label: 'Always Keywords' },
  { value: 'semantic', label: 'Always Semantic (Pro)' },
];

function getTimezoneOptions(): Array<{ value: string; label: string }> {
  try {
    const zones = Intl.supportedValuesOf('timeZone');
    return zones.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }));
  } catch {
    return [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'America/New York' },
      { value: 'Europe/London', label: 'Europe/London' },
      { value: 'Europe/Madrid', label: 'Europe/Madrid' },
      { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
    ];
  }
}

function formatPreview(dateFormat: string, timeFormat: string): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  let datePart = '';
  if (dateFormat === 'DD/MM/YYYY') datePart = `${day}/${month}/${year}`;
  else if (dateFormat === 'MM/DD/YYYY') datePart = `${month}/${day}/${year}`;
  else datePart = `${year}-${month}-${day}`;

  const hours = timeFormat === '12h'
    ? ((now.getHours() % 12) || 12)
    : now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const suffix = timeFormat === '12h' ? (now.getHours() >= 12 ? ' PM' : ' AM') : '';
  const timePart = `${String(hours).padStart(2, '0')}:${mins}${suffix}`;

  return `Today: ${datePart} ${timePart}`;
}

export function GeneralSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const g = settings.general;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('general', settings.general as unknown as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <>
      <SettingSection title="General" description="Language, timezone, and display preferences.">
        <SettingSelect
          label="Language"
          value={g.language}
          options={LANGUAGES}
          onChange={(v) => setLocalValue('general.language', v)}
        />
        <SettingSelect
          label="Timezone"
          value={g.timezone}
          options={getTimezoneOptions()}
          onChange={(v) => setLocalValue('general.timezone', v)}
        />
        <SettingSelect
          label="Date Format"
          value={g.date_format}
          options={DATE_FORMATS}
          onChange={(v) => setLocalValue('general.date_format', v)}
        />
        <SettingSelect
          label="Time Format"
          value={g.time_format}
          options={TIME_FORMATS}
          onChange={(v) => setLocalValue('general.time_format', v)}
        />

        <div style={{ padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          {formatPreview(g.date_format, g.time_format)}
        </div>

        <SettingSelect
          label="Default Search Mode"
          description="Auto: Keywords for Free, Semantic for Pro"
          value={g.default_search_mode}
          options={SEARCH_MODES}
          onChange={(v) => setLocalValue('general.default_search_mode', v)}
        />
      </SettingSection>

      <SaveBar visible={!!dirty.general} saving={saving} onSave={handleSave} onDiscard={() => resetSection('general')} />
    </>
  );
}
