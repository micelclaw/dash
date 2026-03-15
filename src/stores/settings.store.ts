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

import { create } from 'zustand';
import { api } from '@/services/api';
import type { Settings } from '@/types/settings';

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let current = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return clone;
}

const DEFAULT_SETTINGS: Settings = {
  general: {
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    date_format: 'YYYY-MM-DD',
    time_format: '24h',
    default_search_mode: 'auto',
  },
  ai: {
    default_model: 'claude-sonnet-4-5',
    payment_method: 'byok',
    auto_routing: false,
    api_keys: {},
    local_models: {
      ollama_url: 'http://127.0.0.1:11434',
      ollama_status: 'disconnected',
      available_models: [],
      embedding_model: 'qwen3-embedding:0.6b',
      multimodal_model: 'qwen3-vl:2b',
    },
  },
  sync: {
    enabled_connectors: [],
    default_interval_minutes: 60,
  },
  storage: {
    data_path: '/data',
    files_path: '/data/files',
    backup_path: '/data/backups',
    hal_enabled: false,
    claw_domain: 'localhost:7200',
    snapshots: {
      enabled: false,
      max_versions_per_file: 32,
      rotation_policy: 'smart',
      excluded_patterns: ['*.tmp', '*.log', '*.swp', 'thumbs.db', '.DS_Store'],
      excluded_folders: [],
    },
  },
  photos: {
    include_attachments_in_timeline: false,
    max_guest_uploads_per_ip_day: 50,
    ai_worker: {
      enabled: false,
      paused: false,
      rate_limit: 5,
      face_recognition: false,
      face_threshold: 0.6,
    },
    similar_visual_threshold: 0.2,
    similar_concept_threshold: 0.2,
  },
  mail: {
    default_account_id: null,
    require_send_confirmation: true,
    signature_position: 'below_reply',
    check_interval_minutes: 15,
    max_sync_emails_initial: 500,
    snooze_default_options: [
      { label: 'Tomorrow 9 AM', relative: 'tomorrow_9am' },
      { label: 'Next Monday 9 AM', relative: 'next_monday_9am' },
      { label: 'In 1 hour', relative: '+1h' },
      { label: 'In 3 hours', relative: '+3h' },
    ],
  },
  dash: {
    theme: 'dark',
    accent_color: '#d4a017',
    sidebar_collapsed: false,
    default_module: 'chat',
  },
  notifications: {
    toast_position: 'bottom-right',
    toast_duration_ms: 5000,
    sound_enabled: false,
    show_digest_toasts: true,
    show_sync_toasts: true,
  },
  calendar: {
    first_day_of_week: 1,
    default_view: 'week',
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    default_reminder_minutes: null,
  },
  voice: {
    input_mode: 'hold',
    autoplay_responses: false,
    shortcut_key: 'Space',
  },
};

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  dirty: Record<string, boolean>;
  original: Settings | null;

  fetchSettings: () => Promise<void>;
  updateSection: (section: string, data: Record<string, unknown>) => Promise<void>;
  setLocalValue: (path: string, value: unknown) => void;
  resetSection: (section: string) => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: null,
  loading: false,
  error: null,
  dirty: {},
  original: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        set({ settings: DEFAULT_SETTINGS, original: DEFAULT_SETTINGS, loading: false, dirty: {} });
        return;
      }
      const res = await api.get<{ data: Partial<Settings> }>('/settings');
      // Merge with defaults so new sections always have values
      const merged: Settings = { ...DEFAULT_SETTINGS };
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
        if (res.data[key]) {
          (merged as any)[key] = { ...(DEFAULT_SETTINGS as any)[key], ...(res.data as any)[key] };
        }
      }
      set({ settings: merged, original: JSON.parse(JSON.stringify(merged)), loading: false, dirty: {} });
    } catch {
      set({ settings: DEFAULT_SETTINGS, original: DEFAULT_SETTINGS, loading: false, error: 'Failed to load settings' });
    }
  },

  updateSection: async (section: string, data: Record<string, unknown>) => {
    const { settings } = get();
    if (!settings) return;
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        const updated = { ...settings, [section]: { ...(settings as any)[section], ...data } };
        set({ settings: updated, original: JSON.parse(JSON.stringify(updated)), dirty: { ...get().dirty, [section]: false } });
        return;
      }
      const res = await api.patch<{ data: Settings }>('/settings', { [section]: data });
      set({ settings: res.data, original: JSON.parse(JSON.stringify(res.data)), dirty: { ...get().dirty, [section]: false } });
    } catch {
      throw new Error('Failed to save settings');
    }
  },

  setLocalValue: (path: string, value: unknown) => {
    const { settings, original } = get();
    if (!settings) return;
    const section = path.split('.')[0];
    const updated = setNestedValue(settings, path, value);
    const isDirty = JSON.stringify((updated as any)[section]) !== JSON.stringify((original as any)?.[section]);
    set({ settings: updated, dirty: { ...get().dirty, [section]: isDirty } });
  },

  resetSection: (section: string) => {
    const { settings, original } = get();
    if (!settings || !original) return;
    const restored = { ...settings, [section]: JSON.parse(JSON.stringify((original as any)[section])) };
    set({ settings: restored, dirty: { ...get().dirty, [section]: false } });
  },
}));
