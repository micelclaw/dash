import { create } from 'zustand';
import { api } from '@/services/api';

export interface DigestEntry {
  id: string;
  delivered_at: string;
  changes_count: number;
  domains: string[];
  raw_summary: string;
  alert_level: 'SILENT' | 'NORMAL' | 'URGENT' | null;
  intelligent_summary: string | null;
  action_suggested: string | null;
}

interface DigestState {
  todayDigests: DigestEntry[];
  unreadCount: number;
  latestUrgent: DigestEntry | null;
  loading: boolean;
  panelOpen: boolean;

  fetchTodayHistory: () => Promise<void>;
  markAllRead: () => void;
  handleDigestReady: (data: Record<string, unknown>) => void;
  handleDigestUrgent: (data: Record<string, unknown>) => void;
  dismissUrgent: () => void;
  setPanelOpen: (open: boolean) => void;
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const useDigestStore = create<DigestState>()((set, get) => ({
  todayDigests: [],
  unreadCount: 0,
  latestUrgent: null,
  loading: false,
  panelOpen: false,

  fetchTodayHistory: async () => {
    set({ loading: true });
    try {
      if (import.meta.env.VITE_MOCK_API === 'true') {
        await new Promise((r) => setTimeout(r, 300));
        set({
          todayDigests: [
            {
              id: '1',
              delivered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              changes_count: 5,
              domains: ['notes', 'events'],
              raw_summary: '2 notes updated, 1 new event, 2 emails received.',
              alert_level: 'NORMAL',
              intelligent_summary: null,
              action_suggested: 'Check email from Juan about the Q3 budget',
            },
            {
              id: '2',
              delivered_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
              changes_count: 8,
              domains: ['files', 'emails'],
              raw_summary: '3 files synced, 5 newsletters received.',
              alert_level: 'SILENT',
              intelligent_summary: null,
              action_suggested: null,
            },
          ],
          unreadCount: 1,
          loading: false,
        });
        return;
      }

      const res = await api.get<{ data: DigestEntry[]; total: number }>(`/digest/history?from=${todayStart()}&limit=50`);
      const digests = Array.isArray(res.data) ? res.data : [];
      set({ todayDigests: digests, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markAllRead: () => {
    set({ unreadCount: 0 });
  },

  handleDigestReady: (data) => {
    const entry: DigestEntry = {
      id: (data.digest_id as string) || crypto.randomUUID(),
      delivered_at: new Date().toISOString(),
      changes_count: (data.changes_count as number) || 0,
      domains: (data.domains_affected as string[]) || [],
      raw_summary: (data.summary as string) || '',
      alert_level: (data.alert_level as DigestEntry['alert_level']) || 'NORMAL',
      intelligent_summary: null,
      action_suggested: (data.action_suggested as string) || null,
    };

    set((s) => ({
      todayDigests: [entry, ...s.todayDigests],
      unreadCount: entry.alert_level !== 'SILENT' ? s.unreadCount + 1 : s.unreadCount,
    }));
  },

  handleDigestUrgent: (data) => {
    const entry: DigestEntry = {
      id: (data.digest_id as string) || crypto.randomUUID(),
      delivered_at: new Date().toISOString(),
      changes_count: (data.changes_count as number) || 0,
      domains: (data.domains_affected as string[]) || [],
      raw_summary: (data.summary as string) || '',
      alert_level: 'URGENT',
      intelligent_summary: null,
      action_suggested: (data.action_suggested as string) || null,
    };

    set((s) => ({
      todayDigests: [entry, ...s.todayDigests],
      unreadCount: s.unreadCount + 1,
      latestUrgent: entry,
    }));
  },

  dismissUrgent: () => {
    set({ latestUrgent: null });
  },

  setPanelOpen: (open) => {
    set({ panelOpen: open });
    if (open) {
      get().markAllRead();
    }
  },
}));
