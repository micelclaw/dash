import { newOfficeDocument, officeRecentFiles, type OfficeEditorSession } from '@/modules/office/office-providers.service';
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

// ─── Office Store ────────────────────────────────────────────────────
// Zustand store for the Office module state.

import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────

export type OfficeApp = 'documents' | 'spreadsheets' | 'presentations' | 'pdf' | 'databases';

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
  mathesar: ServiceSubStatus;
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
  docsLoading: boolean;
  creatingProvider: string | null;
  creationError: { provider: string; message: string } | null;
  createProviderDocument: (provider: string) => Promise<OfficeEditorSession | null>;

  setActiveApp: (app: OfficeApp) => void;
  toggleFullscreen: () => void;
  setFullscreen: (v: boolean) => void;
  fetchStatus: () => Promise<void>;
  fetchRecentDocs: (mimeFilter?: string, formats?: readonly string[]) => Promise<void>;
  createSession: (fileId: string) => Promise<EditorSession>;
  createNewDocument: (type: 'docx' | 'xlsx' | 'pptx', filename?: string) => Promise<EditorSession>;
  startService: (service: string) => Promise<void>;
  clearSession: () => void;
}

let recentRequest = 0;
export const useOfficeStore = create<OfficeState>((set, get) => ({
  activeApp: 'documents',
  status: null,
  currentSession: null,
  recentDocs: [],
  fullscreen: false,
  loading: false,
  docsLoading: false,
  creatingProvider: null,
  creationError: null,

  createProviderDocument: async (provider) => {
    // Zustand updates synchronously: double clicks and remounts share this guard.
    if (get().creatingProvider) return null;
    set({ creatingProvider: provider, creationError: null });
    try {
      return await newOfficeDocument(provider);
    } catch (error) {
      set({ creationError: { provider, message: error instanceof Error ? error.message : '' } });
      return null;
    } finally {
      set({ creatingProvider: null });
    }
  },

  setActiveApp: (app) => {
    if(get().activeApp===app)return;
    recentRequest++;
    set({activeApp:app,recentDocs:[],docsLoading:false});
  },

  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
  setFullscreen: (v) => set({ fullscreen: v }),

  fetchStatus: async () => {
    try {
      const res = await api.get<{ data: OfficeStatus }>('/office/status');
      set({ status: res.data });
    } catch {
      // Status fetch failed — leave null
    }
  },

  fetchRecentDocs: async (mimeFilter?: string, formats?: readonly string[]) => {
    const slot = mimeFilter === 'application/pdf' ? 'pdf'
      : mimeFilter?.includes('spreadsheetml') ? 'spreadsheets'
      : mimeFilter?.includes('presentationml') ? 'presentations' : 'documents';
    if(get().activeApp!==slot)return;
    const request=++recentRequest;
    set({ docsLoading: true });
    try {
      const docs = await officeRecentFiles(slot, formats);
      if(request===recentRequest&&get().activeApp===slot)set({ recentDocs: docs, docsLoading: false });
    } catch {
      if(request===recentRequest&&get().activeApp===slot)set({ recentDocs: [], docsLoading: false });
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
