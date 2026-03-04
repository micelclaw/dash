import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { applyTheme, applyAccentColor } from '@/hooks/use-theme';
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
  { value: 'bookmarks', label: 'Bookmarks' },
];

const ACCENT_PRESETS = [
  { color: '#d4a017', label: 'Amber' },
  { color: '#22c55e', label: 'Green' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#a855f7', label: 'Purple' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f97316', label: 'Orange' },
  { color: '#14b8a6', label: 'Teal' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#06b6d4', label: 'Cyan' },
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
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {([
              { id: 'dark', label: 'Dark', dot: '#0c0c12' },
              { id: 'light', label: 'Light', dot: '#e0ded8' },
              { id: 'midnight', label: 'Midnight', dot: '#101828' },
              { id: 'ember', label: 'Ember', dot: '#1a1410' },
              { id: 'moss', label: 'Moss', dot: '#0e1410' },
              { id: 'lucid', label: 'Lucid', dot: '#12101a' },
            ] as const).map(({ id, label, dot }) => {
              const isActive = d.theme === id;
              return (
                <button
                  key={id}
                  onClick={() => setLocalValue('dash.theme', id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 30,
                    padding: '0 10px',
                    background: isActive ? 'var(--amber)' : 'var(--surface)',
                    color: isActive ? '#06060a' : 'var(--text-dim)',
                    border: isActive ? 'none' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, border: '1px solid rgba(128,128,128,0.3)', flexShrink: 0 }} />
                  {label}
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

      <SaveBar visible={!!dirty.dash} saving={saving} onSave={handleSave} onDiscard={() => {
        const original = useSettingsStore.getState().original;
        resetSection('dash');
        if (original?.dash) {
          applyTheme(original.dash.theme);
          applyAccentColor(original.dash.accent_color);
        }
      }} />
    </>
  );
}
