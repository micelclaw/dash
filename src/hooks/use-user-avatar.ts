/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * https://micelclaw.com
 */

// G9: per-device user avatar emoji. Persisted in localStorage (matches
// the "persistencia local" line of the OpenClaw changelog) — different
// devices can have different avatars without backend round-trip.
//
// The agent's avatar is server-side because it's shared across devices
// and synced to OpenClaw `agents.list[].identity.avatar` (G9 backend);
// the user's avatar is a personal/device preference.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'claw-user-avatar';
const DEFAULT_AVATAR = '👤';

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function useUserAvatar(): [string, (next: string) => void] {
  const [avatar, setAvatarState] = useState<string>(readStored);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAvatarState(e.newValue || DEFAULT_AVATAR);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setAvatar = useCallback((next: string) => {
    setAvatarState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  return [avatar, setAvatar];
}
