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

// ─── Per-conversation TTS auto-play toggle ───────────────────────────
//
// Tracks the user's choice for "auto-play TTS in this conversation":
//
//   - 'on'      → always auto-play assistant responses, regardless of
//                 whether the user typed or spoke
//   - 'off'     → never auto-play (overrides the global setting)
//   - 'default' → inherit existing dash behaviour (auto-play only if
//                 the user used voice input AND `voice.autoplay_responses`
//                 is enabled in Settings)
//
// State lives in localStorage keyed by conversation id. The dash is the
// source of truth — the backend dispatcher (`/tts chat <state>`) only
// emits a system-message chip for visual confirmation; the actual
// behaviour is decided client-side by `ChatInput`'s autoplay handler.
//
// `claw:tts-chat-state-changed` custom event covers same-tab updates;
// the native `storage` event covers cross-tab updates.

import { useEffect, useState } from 'react';

export type TtsChatState = 'on' | 'off' | 'default';

const STORAGE_KEY_PREFIX = 'claw-tts-chat-';
const CHANGE_EVENT = 'claw:tts-chat-state-changed';

function storageKey(convId: string): string {
  return `${STORAGE_KEY_PREFIX}${convId}`;
}

/**
 * Read the persisted toggle state for a conversation. `'default'` when the
 * conv id is missing, the entry doesn't exist, or localStorage is unavailable
 * (private mode quirks).
 */
export function readTtsChatState(convId: string | null | undefined): TtsChatState {
  if (!convId) return 'default';
  try {
    const raw = localStorage.getItem(storageKey(convId));
    if (raw === 'on' || raw === 'off') return raw;
    return 'default';
  } catch {
    return 'default';
  }
}

/**
 * Persist the toggle for a conversation. `'default'` removes the entry so
 * the autoplay handler falls back to the existing voice-input + global
 * setting gate. Silently no-ops if localStorage is unavailable.
 */
export function writeTtsChatState(convId: string | null | undefined, state: TtsChatState): void {
  if (!convId) return;
  try {
    if (state === 'default') {
      localStorage.removeItem(storageKey(convId));
    } else {
      localStorage.setItem(storageKey(convId), state);
    }
  } catch {
    // localStorage unavailable — silent fail. Worst case: toggle doesn't
    // persist across reloads; behaviour for THIS session still works as
    // long as the caller keeps state in component memory.
  }
  // Same-tab listeners (`storage` event only fires for other tabs).
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* ignore */ }
}

/**
 * React hook returning the current toggle state for a conversation. Re-renders
 * the host component when the entry changes — works for same-tab updates
 * (custom event) and cross-tab updates (`storage` event).
 */
export function useTtsChatState(convId: string | null | undefined): TtsChatState {
  const [state, setState] = useState<TtsChatState>(() => readTtsChatState(convId));

  useEffect(() => {
    setState(readTtsChatState(convId));
    if (!convId) return;
    const key = storageKey(convId);
    const onStorage = (e: StorageEvent) => {
      // Other-tab change: refresh only if the affected key is ours.
      if (e.key === null || e.key === key) setState(readTtsChatState(convId));
    };
    const onLocalChange = () => setState(readTtsChatState(convId));
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, onLocalChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, onLocalChange);
    };
  }, [convId]);

  return state;
}

/** Cycle order for the header button: default → on → off → default. */
export function nextTtsChatState(current: TtsChatState): TtsChatState {
  switch (current) {
    case 'default': return 'on';
    case 'on':      return 'off';
    case 'off':     return 'default';
  }
}
