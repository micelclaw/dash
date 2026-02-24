import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';
import { SaveBar } from '../SaveBar';

const MODULES_LIST = [
  { value: 'chat', label: 'AI Chat' },
  { value: 'notes', label: 'Notes' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'mail', label: 'Mail' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'drive', label: 'Drive' },
  { value: 'photos', label: 'Photos' },
  { value: 'diary', label: 'Diary' },
  { value: 'explorer', label: 'Explorer' },
  { value: 'agents', label: 'Agents' },
];

const ACCENT_PRESETS = [
  { color: '#d4a017', label: 'Amber' },
  { color: '#22c55e', label: 'Green' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#a855f7', label: 'Purple' },
  { color: '#ef4444', label: 'Red' },
];

export function DashSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const d = settings.dash;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('dash', settings.dash as unknown as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <>
      <SettingSection title="Dashboard" description="Appearance and layout preferences.">
        {/* Theme pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Theme</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['dark', 'light', 'system'] as const).map((t) => {
              const icons: Record<string, string> = { dark: '\u{1F319}', light: '\u{2600}\u{FE0F}', system: '\u{1F4BB}' };
              const isActive = d.theme === t;
              return (
                <button
                  key={t}
                  onClick={() => setLocalValue('dash.theme', t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 30,
                    padding: '0 12px',
                    background: isActive ? 'var(--amber)' : 'var(--surface)',
                    color: isActive ? '#06060a' : 'var(--text-dim)',
                    border: isActive ? 'none' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span style={{ fontSize: '0.75rem' }}>{icons[t]}</span>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Accent Color</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.color}
                title={p.label}
                onClick={() => setLocalValue('dash.accent_color', p.color)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: p.color,
                  border: d.accent_color === p.color ? '2px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={d.accent_color}
              onChange={(e) => setLocalValue('dash.accent_color', e.target.value)}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
              title="Custom color"
            />
          </div>
        </div>

        <SettingToggle
          label="Start with sidebar collapsed"
          checked={d.sidebar_collapsed}
          onChange={(v) => setLocalValue('dash.sidebar_collapsed', v)}
        />

        <SettingSelect
          label="Default Module"
          description="Module to show when you open Claw Dash"
          value={d.default_module}
          options={MODULES_LIST}
          onChange={(v) => setLocalValue('dash.default_module', v)}
        />
      </SettingSection>

      <SaveBar visible={!!dirty.dash} saving={saving} onSave={handleSave} onDiscard={() => resetSection('dash')} />
    </>
  );
}
