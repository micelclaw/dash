import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';

const ROTATION_OPTIONS = [
  { value: 'smart', label: 'Smart' },
  { value: 'fifo', label: 'FIFO (First In, First Out)' },
  { value: 'none', label: 'None (keep all)' },
];

export function StorageSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);
  const [editingPatterns, setEditingPatterns] = useState(false);
  const [editingFolders, setEditingFolders] = useState(false);
  const [patternsText, setPatternsText] = useState('');
  const [foldersText, setFoldersText] = useState('');

  if (!settings) return null;
  const s = settings.storage;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('storage', settings.storage as unknown as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const openPatternEditor = () => {
    setPatternsText(s.snapshots.excluded_patterns.join('\n'));
    setEditingPatterns(true);
  };
  const savePatterns = () => {
    setLocalValue('storage.snapshots.excluded_patterns', patternsText.split('\n').map((l) => l.trim()).filter(Boolean));
    setEditingPatterns(false);
  };

  const openFolderEditor = () => {
    setFoldersText(s.snapshots.excluded_folders.join('\n'));
    setEditingFolders(true);
  };
  const saveFolders = () => {
    setLocalValue('storage.snapshots.excluded_folders', foldersText.split('\n').map((l) => l.trim()).filter(Boolean));
    setEditingFolders(false);
  };

  return (
    <>
      <SettingSection title="Storage Paths" description="Read-only. Configured at install time.">
        {[
          { label: 'Data Path', value: s.data_path },
          { label: 'Files Path', value: s.files_path },
          { label: 'Backup Path', value: s.backup_path },
          { label: 'Domain', value: s.claw_domain },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{item.label}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{item.value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>HAL Status</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: s.hal_enabled ? '#22c55e' : '#6b7280' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.hal_enabled ? '#22c55e' : '#6b7280' }} />
            {s.hal_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </SettingSection>

      <SettingSection title="File Snapshots (Pro)" description="Version history for your files.">
        <SettingToggle
          label="Enabled"
          checked={s.snapshots.enabled}
          onChange={(v) => setLocalValue('storage.snapshots.enabled', v)}
        />
        <SettingInput
          label="Max Versions per File"
          type="number"
          value={String(s.snapshots.max_versions_per_file)}
          onChange={(v) => setLocalValue('storage.snapshots.max_versions_per_file', Math.max(1, parseInt(v) || 32))}
          min={1}
        />
        <SettingSelect
          label="Rotation Policy"
          value={s.snapshots.rotation_policy}
          options={ROTATION_OPTIONS}
          onChange={(v) => setLocalValue('storage.snapshots.rotation_policy', v)}
        />

        {/* Excluded patterns */}
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Excluded Patterns</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {s.snapshots.excluded_patterns.join(', ') || 'None'}
              </div>
            </div>
            {!editingPatterns && (
              <button
                onClick={openPatternEditor}
                style={{ height: 26, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                Edit list...
              </button>
            )}
          </div>
          {editingPatterns && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={patternsText}
                onChange={(e) => setPatternsText(e.target.value)}
                rows={5}
                style={{
                  width: '100%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono, monospace)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingPatterns(false)} style={{ height: 26, padding: '0 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={savePatterns} style={{ height: 26, padding: '0 10px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          )}
        </div>

        {/* Excluded folders */}
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Excluded Folders</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {s.snapshots.excluded_folders.join(', ') || 'None'}
              </div>
            </div>
            {!editingFolders && (
              <button
                onClick={openFolderEditor}
                style={{ height: 26, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                Edit list...
              </button>
            )}
          </div>
          {editingFolders && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={foldersText}
                onChange={(e) => setFoldersText(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono, monospace)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingFolders(false)} style={{ height: 26, padding: '0 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveFolders} style={{ height: 26, padding: '0 10px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          )}
        </div>
      </SettingSection>

      <SaveBar visible={!!dirty.storage} saving={saving} onSave={handleSave} onDiscard={() => resetSection('storage')} />
    </>
  );
}
