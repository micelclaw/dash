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
import { useAuthStore } from './auth.store';

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let current = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]!] === undefined) current[keys[i]!] = {};
    current = current[keys[i]!];
  }
  current[keys[keys.length - 1]!] = value;
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
      multimodal_model: '',
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
    full_duplex: false,
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
  serverSettings: Settings | null;
  remoteConflicts: Record<string, boolean>;
  ownerSession: string | null;

  fetchSettings: () => Promise<void>;
  updateSection: (section: string, data: Record<string, unknown>) => Promise<void>;
  patchSettings: (patch: Record<string, unknown>) => Promise<void>;
  setLocalValue: (path: string, value: unknown) => void;
  resetSection: (section: string) => void;
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const sessionKey = () => { const auth = useAuthStore.getState(); return `${auth.user?.id ?? ''}:${auth.sessionGeneration}`; };
let fetchSequence = 0;
function comparableSection(section: string, value: unknown) {
  const clean = clone(value) as Record<string, any> | undefined;
  if (section === 'ai' && clean?.local_models) { delete clean.local_models.ollama_status; delete clean.local_models.available_models; }
  const ordered = (input: any): any => Array.isArray(input) ? input.map(ordered) : input && typeof input === 'object' ? Object.fromEntries(Object.keys(input).sort().map(key => [key, ordered(input[key])])) : input;
  return JSON.stringify(ordered(clean));
}
function effectiveSettings(remote: Partial<Settings>): Settings {
  const merged = clone(DEFAULT_SETTINGS);
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) if (remote[key]) (merged as any)[key] = { ...(DEFAULT_SETTINGS as any)[key], ...(remote as any)[key] };
  return merged;
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  /** Dirty sections retain their draft and base; the latest server state stays separate until save/discard. */
  function reconcile(remote: Settings, acknowledged: Record<string, unknown> = {}) {
    const current = get(); const settings = clone(remote); const original = clone(remote);
    const dirty = { ...current.dirty }; const remoteConflicts: Record<string, boolean> = {};
    for (const [section, pending] of Object.entries(current.dirty)) {
      if (!pending || !current.settings) continue;
      const draft = (current.settings as any)[section];
      const acknowledgedSection = Object.prototype.hasOwnProperty.call(acknowledged, section);
      if (acknowledgedSection && comparableSection(section, draft) === comparableSection(section, acknowledged[section])) { dirty[section] = false; continue; }
      const base = acknowledgedSection ? (remote as any)[section] : (current.original as any)?.[section];
      if (acknowledgedSection && comparableSection(section, draft) === comparableSection(section, base)) { dirty[section] = false; continue; }
      (settings as any)[section] = clone(draft); (original as any)[section] = clone(base);
      if (!acknowledgedSection && comparableSection(section, base) !== comparableSection(section, (remote as any)[section])) remoteConflicts[section] = true;
    }
    set({ settings, original, serverSettings: clone(remote), dirty, remoteConflicts, loading: false, error: null });
  }
  return {
  settings: null,
  loading: false,
  error: null,
  dirty: {},
  original: null,
  serverSettings: null,
  remoteConflicts: {},
  ownerSession: null,

  fetchSettings: async () => {
    const owner = sessionKey(); const request = ++fetchSequence;
    if (get().ownerSession !== owner) set({ ownerSession: owner, settings: null, original: null, serverSettings: null, dirty: {}, remoteConflicts: {}, loading: true, error: null });
    else set({ loading: true, error: null });
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        reconcile(effectiveSettings(DEFAULT_SETTINGS));
        return;
      }
      const res = await api.get<{ data: Partial<Settings> }>('/settings');
      if (sessionKey() !== owner || request !== fetchSequence) return;
      reconcile(effectiveSettings(res.data));
    } catch {
      if (sessionKey() !== owner || request !== fetchSequence) return;
      if (get().settings) set({ loading: false, error: 'No se pudieron actualizar los ajustes. Se conserva tu borrador.' });
      else set({ settings: clone(DEFAULT_SETTINGS), original: clone(DEFAULT_SETTINGS), serverSettings: null, loading: false, error: 'Failed to load settings' });
    }
  },

  updateSection: async (section: string, data: Record<string, unknown>) => {
    const { settings } = get();
    if (!settings) return;
    const owner = sessionKey(); const submitted = clone((settings as any)[section]);
    if (get().ownerSession !== owner) throw new Error('La sesión cambió; vuelve a cargar los ajustes.');
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        const updated = { ...settings, [section]: { ...(settings as any)[section], ...data } };
        reconcile(effectiveSettings(updated), { [section]: submitted });
        return;
      }
      const res = await api.patch<{ data: Settings }>('/settings', { [section]: data });
      if (sessionKey() !== owner) return;
      reconcile(effectiveSettings(res.data), { [section]: submitted });
    } catch {
      throw new Error('Failed to save settings');
    }
  },

  patchSettings: async (patch: Record<string, unknown>) => {
    const { settings } = get();
    if (!settings) return;
    const owner = sessionKey(); const submitted = Object.fromEntries(Object.keys(patch).map(section => [section, clone((settings as any)[section])]));
    if (get().ownerSession !== owner) throw new Error('La sesión cambió; vuelve a cargar los ajustes.');
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        const updated = { ...settings };
        for (const [section, data] of Object.entries(patch)) {
          (updated as any)[section] = { ...(updated as any)[section], ...(data as Record<string, unknown>) };
        }
        reconcile(effectiveSettings(updated), submitted);
        return;
      }
      const res = await api.patch<{ data: Settings }>('/settings', patch);
      if (sessionKey() !== owner) return;
      reconcile(effectiveSettings(res.data), submitted);
    } catch {
      throw new Error('Failed to patch settings');
    }
  },

  setLocalValue: (path: string, value: unknown) => {
    const { settings, original } = get();
    if (!settings) return;
    const section = path.split('.')[0]!;
    const updated = setNestedValue(settings, path, value);
    const isDirty = JSON.stringify((updated as any)[section]) !== JSON.stringify((original as any)?.[section])
      || !!get().remoteConflicts[section] && comparableSection(section, (updated as any)[section]) !== comparableSection(section, (get().serverSettings as any)?.[section]);
    const remoteConflicts = { ...get().remoteConflicts };
    if (!isDirty) delete remoteConflicts[section];
    set({ settings: updated, dirty: { ...get().dirty, [section]: isDirty }, remoteConflicts });
  },

  resetSection: (section: string) => {
    const { settings, original, serverSettings } = get();
    if (!settings || !original) return;
    const server = clone((serverSettings as any)?.[section] ?? (original as any)[section]);
    const restored = { ...settings, [section]: server };
    const remoteConflicts = { ...get().remoteConflicts }; delete remoteConflicts[section];
    set({ settings: restored, original: { ...original, [section]: clone(server) }, dirty: { ...get().dirty, [section]: false }, remoteConflicts });
  },
  };
});
