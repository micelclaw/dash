/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
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

// ─── Types ──────────────────────────────────────────────────────────

export interface TerminalTab {
  id: string;
  sessionId: string;
  label: string;
  type: 'local' | 'ssh';
  cwd?: string;
  connectionId?: string;
}

export interface TerminalDefault {
  type: 'local' | 'ssh';
  label: string;
  cwd: string;
}

export interface SavedConnection {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  privateKeyPath?: string;
  jumpHost?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedSnippet {
  id: string;
  label: string;
  command: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Store ──────────────────────────────────────────────────────────

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;
  splitMode: 'none' | 'vertical' | 'horizontal';
  splitTabIds: [string, string] | null;
  connections: SavedConnection[];
  snippets: SavedSnippet[];

  addTab: (type: 'local' | 'ssh', opts?: { connectionId?: string; label?: string; cwd?: string }) => TerminalTab;
  closeTab: (tabId: string) => void;
  clearTabs: () => void;
  setActiveTab: (tabId: string) => void;
  setSplitMode: (mode: 'none' | 'vertical' | 'horizontal') => void;
  setSplitSecondTab: (tabId: string) => void;

  fetchDefaults: () => Promise<TerminalDefault[]>;
  fetchConnections: () => Promise<void>;
  createConnection: (data: {
    label: string; host: string; port?: number; username: string;
    auth_method?: string; password?: string; private_key_path?: string;
    passphrase?: string; jump_host?: string;
  }) => Promise<SavedConnection>;
  updateConnection: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; latency_ms: number; error?: string }>;

  fetchSnippets: () => Promise<void>;
  createSnippet: (data: { label: string; command: string; tags?: string[] }) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
}

export const useTerminalStore = create<TerminalStore>()((set, get) => ({
  tabs: [],
  activeTabId: null,
  splitMode: 'none',
  splitTabIds: null,
  connections: [],
  snippets: [],

  addTab: (type, opts) => {
    const { tabs } = get();
    const typeCount = tabs.filter(t => t.type === type).length;
    const tab: TerminalTab = {
      id: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      label: opts?.label || (type === 'local' ? `Local ${typeCount + 1}` : `SSH ${typeCount + 1}`),
      type,
      cwd: opts?.cwd,
      connectionId: opts?.connectionId,
    };
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }));
    return tab;
  },

  closeTab: (tabId) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== tabId);
      let activeTabId = s.activeTabId;
      if (activeTabId === tabId) {
        activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      const splitTabIds = s.splitTabIds;
      const needClearSplit = splitTabIds && (splitTabIds[0] === tabId || splitTabIds[1] === tabId);
      return {
        tabs,
        activeTabId,
        splitMode: needClearSplit ? 'none' : s.splitMode,
        splitTabIds: needClearSplit ? null : splitTabIds,
      };
    });
  },

  clearTabs: () => set({ tabs: [], activeTabId: null, splitMode: 'none', splitTabIds: null }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setSplitMode: (mode) => {
    const { tabs, activeTabId } = get();
    if (mode === 'none') {
      set({ splitMode: 'none', splitTabIds: null });
      return;
    }
    if (tabs.length < 2) return;
    const second = tabs.find((t) => t.id !== activeTabId);
    if (!second) return;
    set({ splitMode: mode, splitTabIds: [activeTabId!, second.id] });
  },

  setSplitSecondTab: (tabId) => {
    const { splitTabIds } = get();
    if (!splitTabIds) return;
    set({ splitTabIds: [splitTabIds[0], tabId] });
  },

  fetchDefaults: async () => {
    try {
      const res = await api.get<{ data: TerminalDefault[] }>('/terminal/defaults');
      return res.data;
    } catch {
      return [{ type: 'local' as const, label: 'Local', cwd: '' }];
    }
  },

  fetchConnections: async () => {
    try {
      const res = await api.get<{ data: SavedConnection[] }>('/terminal/connections');
      set({ connections: res.data });
    } catch { /* ignore */ }
  },

  createConnection: async (data) => {
    const res = await api.post<{ data: SavedConnection }>('/terminal/connections', data);
    get().fetchConnections();
    return res.data;
  },

  updateConnection: async (id, data) => {
    await api.patch(`/terminal/connections/${id}`, data);
    get().fetchConnections();
  },

  deleteConnection: async (id) => {
    await api.delete(`/terminal/connections/${id}`);
    get().fetchConnections();
  },

  testConnection: async (id) => {
    const res = await api.post<{ data: { success: boolean; latency_ms: number; error?: string } }>(`/terminal/connections/${id}/test`);
    return res.data;
  },

  fetchSnippets: async () => {
    try {
      const res = await api.get<{ data: SavedSnippet[] }>('/terminal/snippets');
      set({ snippets: res.data });
    } catch { /* ignore */ }
  },

  createSnippet: async (data) => {
    await api.post('/terminal/snippets', data);
    get().fetchSnippets();
  },

  deleteSnippet: async (id) => {
    await api.delete(`/terminal/snippets/${id}`);
    get().fetchSnippets();
  },
}));
