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

import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_VISIBILITY, type ToolVisibility, type Preset } from '@/config/tool-rendering';

const LS_KEY = 'claw-tool-visibility';

export type VisibilityProfile = {
  id: string;
  name: string;
  visibility: ToolVisibility;
};

type VisibilityStorage = {
  visibility: ToolVisibility;
  activeProfileId: string | null;
  profiles: VisibilityProfile[];
};

const DEFAULT_STORAGE: VisibilityStorage = {
  visibility: DEFAULT_VISIBILITY,
  activeProfileId: null,
  profiles: [],
};

function isVisibility(value: unknown): value is ToolVisibility {
  if (!value || typeof value !== 'object') return false;
  const preset = (value as { preset?: unknown }).preset;
  return preset === 'minimal' || preset === 'default' || preset === 'verbose' || preset === 'custom';
}

function readFromStorage(): VisibilityStorage {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STORAGE;
    const parsed = JSON.parse(raw) as ToolVisibility | Partial<VisibilityStorage>;
    if (isVisibility(parsed)) return { ...DEFAULT_STORAGE, visibility: parsed };
    if (!parsed || typeof parsed !== 'object' || !isVisibility(parsed.visibility)) return DEFAULT_STORAGE;
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.filter((profile): profile is VisibilityProfile => Boolean(
        profile && typeof profile === 'object'
        && typeof (profile as VisibilityProfile).id === 'string'
        && typeof (profile as VisibilityProfile).name === 'string'
        && isVisibility((profile as VisibilityProfile).visibility),
      ))
      : [];
    const activeProfileId = typeof parsed.activeProfileId === 'string' && profiles.some((profile) => profile.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : null;
    return { visibility: parsed.visibility, profiles, activeProfileId };
  } catch {
    return DEFAULT_STORAGE;
  }
}

function writeToStorage(value: VisibilityStorage): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(value)); } catch { /* ignore */ }
}

const listeners = new Set<(value: VisibilityStorage) => void>();
function notify(value: VisibilityStorage) {
  for (const listener of listeners) listener(value);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LS_KEY) notify(readFromStorage());
  });
}

function createProfileId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `visibility-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Display profiles are local: they only decide how this user sees tool cards. */
export function useToolVisibility(): {
  visibility: ToolVisibility;
  visibilityProfiles: VisibilityProfile[];
  activeVisibilityProfileId: string | null;
  setPreset: (preset: Preset) => void;
  selectVisibilityProfile: (id: string) => void;
  createVisibilityProfile: (name: string) => VisibilityProfile | null;
  toggleTool: (name: string, enabled: boolean) => void;
  clearToolOverride: (name: string) => void;
  reset: () => void;
} {
  const [storage, setStorage] = useState<VisibilityStorage>(() => readFromStorage());

  useEffect(() => {
    const listener = (value: VisibilityStorage) => setStorage(value);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const persist = useCallback((next: VisibilityStorage) => {
    writeToStorage(next);
    setStorage(next);
    notify(next);
  }, []);

  const updateVisibility = useCallback((visibility: ToolVisibility, detachProfile = false) => {
    const activeProfileId = detachProfile ? null : storage.activeProfileId;
    const profiles = storage.profiles.map((profile) => profile.id === activeProfileId ? { ...profile, visibility } : profile);
    persist({ visibility, profiles, activeProfileId });
  }, [persist, storage]);

  const setPreset = useCallback((preset: Preset) => {
    updateVisibility({ ...storage.visibility, preset }, true);
  }, [storage.visibility, updateVisibility]);

  const selectVisibilityProfile = useCallback((id: string) => {
    const profile = storage.profiles.find((item) => item.id === id);
    if (!profile) return;
    persist({ ...storage, visibility: profile.visibility, activeProfileId: profile.id });
  }, [persist, storage]);

  const createVisibilityProfile = useCallback((name: string): VisibilityProfile | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const profile: VisibilityProfile = { id: createProfileId(), name: trimmed, visibility: storage.visibility };
    persist({ ...storage, activeProfileId: profile.id, profiles: [...storage.profiles, profile] });
    return profile;
  }, [persist, storage]);

  const toggleTool = useCallback((name: string, enabled: boolean) => {
    const lower = name.toLowerCase();
    const enabledOverrides = new Set(storage.visibility.enabledOverrides ?? []);
    const disabledOverrides = new Set(storage.visibility.disabledOverrides ?? []);
    if (enabled) {
      enabledOverrides.add(lower);
      disabledOverrides.delete(lower);
    } else {
      disabledOverrides.add(lower);
      enabledOverrides.delete(lower);
    }
    updateVisibility({
      ...storage.visibility,
      preset: 'custom',
      enabledOverrides: Array.from(enabledOverrides),
      disabledOverrides: Array.from(disabledOverrides),
    });
  }, [storage.visibility, updateVisibility]);

  const clearToolOverride = useCallback((name: string) => {
    const lower = name.toLowerCase();
    updateVisibility({
      ...storage.visibility,
      enabledOverrides: (storage.visibility.enabledOverrides ?? []).filter((item) => item !== lower),
      disabledOverrides: (storage.visibility.disabledOverrides ?? []).filter((item) => item !== lower),
    });
  }, [storage.visibility, updateVisibility]);

  const reset = useCallback(() => persist(DEFAULT_STORAGE), [persist]);

  return {
    visibility: storage.visibility,
    visibilityProfiles: storage.profiles,
    activeVisibilityProfileId: storage.activeProfileId,
    setPreset,
    selectVisibilityProfile,
    createVisibilityProfile,
    toggleTool,
    clearToolOverride,
    reset,
  };
}
