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

export interface ClipboardEntry {
  id: string;
  content: string;
  contentType: string;
  source: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
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
  addEntry: (entry: ClipboardEntry) => void;
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

  addEntry: (entry: ClipboardEntry) => {
    set((s) => ({ entries: [entry, ...s.entries].slice(0, 20) }));
  },
}));
