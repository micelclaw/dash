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
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';
import { SaveBar } from '../SaveBar';
import { SettingsBlock } from '../shared/SettingsBlock';

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

const DEFAULT_TYPES = {
  chat_replies: true,
  agent_done: true,
  approvals: true,
  errors: true,
  mail: false,
  calendar_reminders: true,
};

const DEFAULT_DND = { enabled: false, from: '22:00', to: '08:00' };

export function NotificationsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [dndOpen, setDndOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  if (!settings?.notifications) return null;
  const n = settings.notifications;
  const types = n.types ?? DEFAULT_TYPES;
  const dnd = n.dnd ?? DEFAULT_DND;
  const desktopEnabled = n.desktop_enabled ?? false;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('notifications', settings.notifications as unknown as Record<string, unknown>);
      toast.success('Notifications saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const requestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Browser notifications not supported');
      return;
    }
    if (Notification.permission === 'granted') {
      setBrowserPermission('granted');
      return;
    }
    if (Notification.permission === 'denied') {
      toast.error('Permission denied — change in your browser settings');
      return;
    }
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
    if (result === 'granted') {
      toast.success('Desktop notifications enabled');
      // Auto-flip the toggle when granted to avoid a confusing "permitido pero off" state
      setLocalValue('notifications.desktop_enabled', true);
    } else if (result === 'denied') {
      toast.error('Permission denied');
    }
  };

  const setType = (key: keyof typeof DEFAULT_TYPES, value: boolean) => {
    setLocalValue('notifications.types', { ...types, [key]: value });
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

        {/* Desktop notifications — Web Notifications API */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              Desktop Notifications
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
              Show OS-level notifications when the dash is in the background. Requires browser permission.
            </div>
            {browserPermission === 'denied' && (
              <div style={{ fontSize: '0.6875rem', color: '#ef4444', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                Browser permission denied. Re-enable in your browser settings (lock icon in the address bar).
              </div>
            )}
            {browserPermission === 'default' && desktopEnabled && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--amber)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                Permission needed. Click "Request" to ask the browser.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {browserPermission !== 'granted' && (
              <button
                onClick={requestBrowserPermission}
                style={{
                  padding: '4px 10px', background: 'var(--surface-hover)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Request
              </button>
            )}
            <SettingToggle
              label=""
              checked={desktopEnabled && browserPermission === 'granted'}
              onChange={(v) => {
                if (v && browserPermission !== 'granted') {
                  requestBrowserPermission();
                  return;
                }
                setLocalValue('notifications.desktop_enabled', v);
              }}
            />
          </div>
        </div>

        <SettingToggle
          label="Show Digest Alerts"
          description="Show a toast in the dash when a digest is generated. (Whether digests are generated at all is controlled in Apps → Digest → Digest Enabled.)"
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

      {/* Per-type notification settings */}
      <SettingsBlock
        title="Notification types"
        description="Choose which events trigger notifications"
        expanded={typesOpen}
        onToggle={() => setTypesOpen((v) => !v)}
      >
        <div style={{ marginTop: 4 }}>
          <SettingToggle
            label="Chat replies"
            description="When an agent sends you a chat message"
            checked={types.chat_replies ?? true}
            onChange={(v) => setType('chat_replies', v)}
          />
          <SettingToggle
            label="Agent task done"
            description="When a long-running agent task completes"
            checked={types.agent_done ?? true}
            onChange={(v) => setType('agent_done', v)}
          />
          <SettingToggle
            label="Approval requests"
            description="When an agent needs your approval to continue"
            checked={types.approvals ?? true}
            onChange={(v) => setType('approvals', v)}
          />
          <SettingToggle
            label="Errors and warnings"
            description="System errors that need your attention"
            checked={types.errors ?? true}
            onChange={(v) => setType('errors', v)}
          />
          <SettingToggle
            label="Mail arrived"
            description="New email in synced accounts (off by default to avoid noise)"
            checked={types.mail ?? false}
            onChange={(v) => setType('mail', v)}
          />
          <SettingToggle
            label="Calendar reminders"
            description="Upcoming events reaching their reminder time"
            checked={types.calendar_reminders ?? true}
            onChange={(v) => setType('calendar_reminders', v)}
          />
        </div>
      </SettingsBlock>

      {/* Do-Not-Disturb schedule */}
      <SettingsBlock
        title="Do not disturb"
        description={dnd.enabled ? `From ${dnd.from} to ${dnd.to}` : 'Off'}
        expanded={dndOpen}
        onToggle={() => setDndOpen((v) => !v)}
      >
        <div style={{ marginTop: 4 }}>
          <SettingToggle
            label="Enable Do-Not-Disturb"
            description="Suppress notifications during the configured hours. Errors and approvals always pass through."
            checked={dnd.enabled}
            onChange={(v) => setLocalValue('notifications.dnd', { ...dnd, enabled: v })}
          />
          {dnd.enabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '8px 0' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>From</div>
                <input
                  type="time"
                  value={dnd.from}
                  onChange={(e) => setLocalValue('notifications.dnd', { ...dnd, from: e.target.value })}
                  style={{
                    width: '100%', padding: '6px 10px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>To</div>
                <input
                  type="time"
                  value={dnd.to}
                  onChange={(e) => setLocalValue('notifications.dnd', { ...dnd, to: e.target.value })}
                  style={{
                    width: '100%', padding: '6px 10px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
                  }}
                />
              </div>
            </div>
          )}
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            {dnd.enabled ? <BellOff size={12} /> : <Bell size={12} />}
            Spans midnight automatically (e.g. 22:00 → 08:00 covers the night).
          </p>
        </div>
      </SettingsBlock>

      <SaveBar visible={!!dirty.notifications} saving={saving} onSave={handleSave} onDiscard={() => resetSection('notifications')} />
    </>
  );
}
