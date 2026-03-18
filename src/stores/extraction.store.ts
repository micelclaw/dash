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
import { useWebSocketStore } from './websocket.store';

export interface ExtractionLogEntry {
  time: string;
  text: string;
  type: 'info' | 'entity' | 'error' | 'done';
}

const DOMAIN_SINGULAR: Record<string, string> = {
  notes: 'note', events: 'event', contacts: 'contact',
  emails: 'email', diary_entries: 'diary entry',
};

interface ExtractionStore {
  running: boolean;
  paused: boolean;
  processed: number;
  total: number;
  logs: ExtractionLogEntry[];

  // Internal
  _wsListening: boolean;

  // Actions
  addLog: (text: string, type?: ExtractionLogEntry['type']) => void;
  fetchStatus: () => Promise<void>;
  startListening: () => void;
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const useExtractionStore = create<ExtractionStore>()((set, get) => ({
  running: false,
  paused: false,
  processed: 0,
  total: 0,
  logs: [],
  _wsListening: false,

  addLog: (text, type = 'info') => {
    set(s => ({ logs: [...s.logs, { time: timestamp(), text, type }] }));
  },

  fetchStatus: async () => {
    try {
      const res = await api.get('/graph/extraction/status') as any;
      const data = res.data ?? res;
      if (data.active) {
        set({
          running: true,
          paused: data.paused ?? false,
          processed: data.processed ?? 0,
          total: data.total ?? 0,
        });
        // Add a reconnect log entry if logs are empty (navigated back)
        const state = get();
        if (state.logs.length === 0) {
          const pct = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
          state.addLog(`Extraction in progress: ${data.processed}/${data.total} (${pct}%)`, 'info');
          if (data.paused) state.addLog('Extraction paused', 'info');
        }
      } else {
        // Only reset running state, keep logs visible if they exist
        set({ running: false, paused: false });
      }
    } catch {
      // Server unreachable — don't change state
    }
  },

  startListening: () => {
    if (get()._wsListening) return;
    set({ _wsListening: true });

    const loggedDomains = new Set<string>();

    // Re-check periodically until client is available
    const tryAttach = () => {
      const client = useWebSocketStore.getState().client;
      if (!client) {
        setTimeout(tryAttach, 500);
        return;
      }

      client.on('extraction.started', (e) => {
        const totalJobs = (e.data.total_jobs as number) ?? 0;
        const domains = (e.data.domains ?? {}) as Record<string, number>;
        loggedDomains.clear();
        set({ total: totalJobs, processed: 0, running: true, paused: false, logs: [] });
        const { addLog } = get();
        addLog(`Re-indexing started: ${totalJobs} jobs queued`);
        for (const [d, count] of Object.entries(domains)) {
          const label = DOMAIN_SINGULAR[d] ?? d;
          addLog(`Processing ${count} ${count === 1 ? label : d}...`);
        }
      });

      client.on('extraction.progress', (e) => {
        set({ processed: e.data.processed as number });

        const type = e.data.type as string;
        if (type !== 'extract') return;

        const domain = e.data.domain as string;
        const entities = (e.data.entities as Array<{ name: string; type: string }>) ?? [];
        const error = e.data.error as string | undefined;
        const recordIndex = e.data.record_index as number | undefined;
        const domainTotal = e.data.domain_total as number | undefined;
        const { addLog } = get();

        if (!loggedDomains.has(domain) && recordIndex !== undefined) {
          loggedDomains.add(domain);
        }

        if (error) {
          const label = DOMAIN_SINGULAR[domain] ?? domain;
          addLog(`${label} ${recordIndex ?? '?'}/${domainTotal ?? '?'}: error — ${error}`, 'error');
        } else {
          if (recordIndex !== undefined && domainTotal !== undefined) {
            const label = DOMAIN_SINGULAR[domain] ?? domain;
            addLog(`processing ${label} ${recordIndex}/${domainTotal}`);
          }
          if (entities.length > 0) {
            const names = entities.map(en => en.name).join(', ');
            addLog(`Entity extracted: ${names}`, 'entity');
          }
        }
      });

      client.on('extraction.complete', () => {
        set({ running: false, paused: false });
        get().addLog('Re-indexing complete', 'done');
      });

      client.on('extraction.paused', () => {
        set({ paused: true });
        get().addLog('Extraction paused');
      });

      client.on('extraction.resumed', () => {
        set({ paused: false });
        get().addLog('Extraction resumed');
      });

      client.on('extraction.stopped', () => {
        set({ running: false, paused: false });
        get().addLog('Extraction stopped', 'done');
      });
    };

    tryAttach();
  },
}));
