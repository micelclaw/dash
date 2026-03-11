// ─── Office Store ────────────────────────────────────────────────────
// Zustand store for the Office module state.

import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────

export type OfficeApp = 'documents' | 'spreadsheets' | 'presentations' | 'pdf-viewer' | 'pdf-tools';

interface ServiceSubStatus {
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

interface OfficeStatus {
  onlyoffice: ServiceSubStatus;
  stirling_pdf: ServiceSubStatus;
  documenso: ServiceSubStatus;
}

interface EditorSession {
  fileId: string;
  documentType: 'word' | 'cell' | 'slide';
  config: Record<string, unknown>;
  token: string;
}

export interface RecentDoc {
  id: string;
  filename: string;
  filepath: string;
  mime_type: string;
  updated_at: string;
  size_bytes: number;
  parent_folder: string;
}

// ─── Store ───────────────────────────────────────────────────────────

interface OfficeState {
  activeApp: OfficeApp;
  status: OfficeStatus | null;
  currentSession: EditorSession | null;
  recentDocs: RecentDoc[];
  fullscreen: boolean;
  loading: boolean;

  setActiveApp: (app: OfficeApp) => void;
  toggleFullscreen: () => void;
  fetchStatus: () => Promise<void>;
  fetchRecentDocs: (mimeFilter?: string) => Promise<void>;
  createSession: (fileId: string) => Promise<EditorSession>;
  createNewDocument: (type: 'docx' | 'xlsx' | 'pptx', filename?: string) => Promise<EditorSession>;
  startService: (service: string) => Promise<void>;
  clearSession: () => void;
}

export const useOfficeStore = create<OfficeState>((set, get) => ({
  activeApp: 'documents',
  status: null,
  currentSession: null,
  recentDocs: [],
  fullscreen: false,
  loading: false,

  setActiveApp: (app) => set({ activeApp: app }),

  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),

  fetchStatus: async () => {
    try {
      const res = await api.get<{ data: OfficeStatus }>('/office/status');
      set({ status: res.data });
    } catch {
      // Status fetch failed — leave null
    }
  },

  fetchRecentDocs: async (mimeFilter?: string) => {
    try {
      const params: Record<string, string | number> = { sort: 'updated_at', limit: 12 };
      if (mimeFilter) params.mime_type = mimeFilter;
      const res = await api.get<{ data: RecentDoc[] }>('/files', params);
      set({ recentDocs: res.data ?? [] });
    } catch {
      set({ recentDocs: [] });
    }
  },

  createSession: async (fileId) => {
    set({ loading: true });
    try {
      const res = await api.rawPost<{ data: EditorSession }>(`/office/session/${fileId}`);
      const session = res.data;
      set({ currentSession: session, loading: false });
      return session;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  createNewDocument: async (type, filename) => {
    set({ loading: true });
    try {
      const res = await api.rawPost<{ data: EditorSession }>('/office/session/new', { type, filename });
      const session = res.data;
      set({ currentSession: session, loading: false });
      return session;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  startService: async (service) => {
    set({ loading: true });
    try {
      await api.post(`/office/start/${service}`);
      await get().fetchStatus();
    } finally {
      set({ loading: false });
    }
  },

  clearSession: () => set({ currentSession: null }),
}));
