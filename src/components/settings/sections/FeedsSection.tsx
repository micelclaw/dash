import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { useSettingsStore } from '@/stores/settings.store';

const RETENTION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
];

const VIEW_OPTIONS = [
  { value: 'three-column', label: 'Three columns (Feeds | List | Article)' },
  { value: 'two-column', label: 'Two columns (List | Article)' },
];

const SORT_OPTIONS = [
  { value: 'published_at_desc', label: 'Newest first' },
  { value: 'published_at_asc', label: 'Oldest first' },
  { value: 'fetched_at_desc', label: 'Recently fetched' },
];

export function FeedsSection() {
  const settings = useSettingsStore(s => s.settings);
  const patchSettings = useSettingsStore(s => s.patchSettings);

  const feedsSettings = (settings as any)?.feeds ?? {};
  const retentionDays = feedsSettings.retention_days ?? 30;
  const defaultView = feedsSettings.default_view ?? 'three-column';
  const defaultSort = feedsSettings.default_sort ?? 'published_at_desc';

  const update = async (key: string, value: unknown) => {
    try {
      await patchSettings({ feeds: { ...feedsSettings, [key]: value } });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="space-y-6">
      <SettingSection title="Article Retention" description="How long to keep read articles before automatic cleanup. Favorites are never deleted.">
        <SettingSelect
          label="Keep read articles for"
          value={String(retentionDays)}
          options={RETENTION_OPTIONS}
          onChange={(v) => update('retention_days', parseInt(v))}
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Unread articles are kept for {retentionDays * 2} days (2x retention period).
        </p>
      </SettingSection>

      <SettingSection title="Default View" description="Choose the default layout when opening the Feeds module.">
        <SettingSelect
          label="Layout"
          value={defaultView}
          options={VIEW_OPTIONS}
          onChange={(v) => update('default_view', v)}
        />
      </SettingSection>

      <SettingSection title="Default Sort" description="How articles are sorted by default.">
        <SettingSelect
          label="Sort order"
          value={defaultSort}
          options={SORT_OPTIONS}
          onChange={(v) => update('default_sort', v)}
        />
      </SettingSection>
    </div>
  );
}
