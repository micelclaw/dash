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
import { SettingToggle } from '../SettingToggle';
import { SaveBar } from '../SaveBar';

const POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
];

const DURATION_OPTIONS = [
  { value: '3000', label: '3 seconds' },
  { value: '5000', label: '5 seconds' },
  { value: '8000', label: '8 seconds' },
  { value: '10000', label: '10 seconds' },
];

export function NotificationsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings?.notifications) return null;
  const n = settings.notifications;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('notifications', settings.notifications as unknown as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <>
      <SettingSection title="Notifications" description="Configure how notifications and alerts appear.">
        <SettingSelect
          label="Toast Position"
          description="Where toast notifications appear on screen."
          value={n.toast_position}
          options={POSITION_OPTIONS}
          onChange={(v) => setLocalValue('notifications.toast_position', v)}
        />
        <SettingSelect
          label="Toast Duration"
          description="How long toast notifications stay visible."
          value={String(n.toast_duration_ms)}
          options={DURATION_OPTIONS}
          onChange={(v) => setLocalValue('notifications.toast_duration_ms', parseInt(v))}
        />
        <SettingToggle
          label="Notification Sound"
          description="Play a sound when notifications arrive."
          checked={n.sound_enabled}
          onChange={(v) => setLocalValue('notifications.sound_enabled', v)}
        />
        <SettingToggle
          label="Show Digest Alerts"
          description="Display toast notifications for digest summaries."
          checked={n.show_digest_toasts}
          onChange={(v) => setLocalValue('notifications.show_digest_toasts', v)}
        />
        <SettingToggle
          label="Show Sync Progress"
          description="Display toast notifications for sync events."
          checked={n.show_sync_toasts}
          onChange={(v) => setLocalValue('notifications.show_sync_toasts', v)}
        />
      </SettingSection>

      <SaveBar visible={!!dirty.notifications} saving={saving} onSave={handleSave} onDiscard={() => resetSection('notifications')} />
    </>
  );
}
