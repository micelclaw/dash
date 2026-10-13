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

// ─── Types ──────────────────────────────────────────────

/** Fila de `GET /clipboard` — snake_case, como todo el contrato (03_CONVENTIONS §API). */
export interface ClipboardEntry {
  id: string;
  content: string;
  content_type: string;
  source: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * Payload del evento WS `clipboard.new` (`core/src/routes/clipboard.ts`):
 * NO es una `ClipboardEntry` — trae `content_preview` (100 chars) en vez de
 * `content` y no trae `created_at`.
 */
export interface ClipboardNewEvent {
  id: string;
  content_type: string;
  content_preview: string;
  source: string;
}

// ─── Store ──────────────────────────────────────────────

interface ClipboardState {
  entries: ClipboardEntry[];
  loading: boolean;
  panelOpen: boolean;

  fetchHistory: () => Promise<void>;
  copyToClipboard: (id: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  addEntry: (event: ClipboardNewEvent) => void;
}

export const useClipboardStore = create<ClipboardState>()((set, get) => ({
  entries: [],
  loading: false,
  panelOpen: false,

  fetchHistory: async () => {
    set({ loading: true });
    try {
      const res = await api.get<{ data: ClipboardEntry[] }>('/clipboard');
      set({ entries: res.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  copyToClipboard: async (id: string) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    try {
      await navigator.clipboard.writeText(entry.content);
    } catch {
      // Fallback — the text was at least read from store
    }
  },

  deleteEntry: async (id: string) => {
    try {
      await api.delete(`/clipboard/${id}`);
      set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    } catch {
      // Silent
    }
  },

  clearAll: async () => {
    try {
      await api.delete('/clipboard?all=true');
      set({ entries: [] });
    } catch {
      // Silent
    }
  },

  togglePanel: () => {
    const opening = !get().panelOpen;
    set({ panelOpen: opening });
    if (opening) get().fetchHistory();
  },

  setPanelOpen: (open: boolean) => {
    set({ panelOpen: open });
    if (open) get().fetchHistory();
  },

  addEntry: (event: ClipboardNewEvent) => {
    // El WS solo trae un preview de 100 chars y ningún `created_at`: se pinta
    // ya (feedback inmediato) y se reconcilia con GET /clipboard, que sí trae
    // el contenido entero y la fecha real. Sin esta normalización la entrada
    // entraba sin `content` y el panel reventaba al hacer content.slice().
    const entry: ClipboardEntry = {
      id: event.id,
      content: event.content_preview,
      content_type: event.content_type,
      source: event.source,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ entries: [entry, ...s.entries.filter((e) => e.id !== entry.id)].slice(0, 20) }));
    void get().fetchHistory();
  },
}));
