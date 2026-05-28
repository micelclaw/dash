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

// ─── Canvas State ───────────────────────────────────────────────────
//
// Ola 7 (oc7-5.1g): dual-mode. Existing inline `html` / `a2ui` types
// keep working unchanged. A new `url` type points the iframe at our
// /canvas-host/* proxy (which talks to OpenClaw's native canvasHost).
//
// Backward compatibility: callers that produce inline html keep using
// {type: 'html', content}. The chat-bridge auto-push and large
// /canvas/push payloads now produce {type: 'url', url, path?}.

export type CanvasContentType = 'html' | 'a2ui' | 'url';
export type CanvasStatus = 'loading' | 'ready' | 'error';

export interface CanvasHistoryItem {
  /** row id de canvas_pushes en el backend */
  id: string;
  /** URL bajo /api/v1/canvas-host/* (null si inline) */
  url: string | null;
  /** Path relativo del archivo en canvasHost root (null si inline) */
  path: string | null;
  /** Título extraído del <title> o filename */
  title: string;
  type: 'html' | 'a2ui' | 'inline';
  createdAt: string;
}

export interface CanvasState {
  type: CanvasContentType | null;
  /** Inline HTML/A2UI content. Set when type === 'html' or 'a2ui'. */
  content: string | null;
  /** Proxy URL (e.g. `/canvas-host/abc12345/conv-1/chart.html`). Set when type === 'url'. */
  url?: string | null;
  /** Optional path (the canvasHost relative path) — used by live-reload to scope cache-busts. */
  path?: string;
  /** Cache-bust counter incremented on canvas.reload events to force iframe reload. */
  reloadKey?: number;
  hasContent: boolean;
  /** 'ready' (default) cuando hay contenido válido; 'error' cuando el push falló. */
  status: CanvasStatus;
  /** Mensaje a mostrar cuando status === 'error'. */
  errorMessage?: string;
  /** Código de error (p.ej. CANVAS_FILE_NOT_FOUND, CANVAS_HOST_FALLBACK). */
  errorCode?: string;
}

// ─── Browser Session State ──────────────────────────────────────────

export interface BrowserAction {
  action: string;
  humanized: string;
  timestamp: string;
  selector?: string;
}

export interface BrowserSessionState {
  sessionId: string;
  currentUrl: string | null;
  humanizedAction: string | null;
  snapshot: string | null;
  actions: BrowserAction[];
  status: 'active' | 'complete' | 'error';
  pagesVisited: number;
}

// ─── Store ──────────────────────────────────────────────────────────

export type ActiveMode = 'canvas' | 'browser' | null;

interface CanvasStore {
  // Canvas content keyed by conversation ID
  canvasStates: Map<string, CanvasState>;
  // Historial de canvases por conversación (orden ascendente: más antiguo primero)
  canvasHistory: Map<string, CanvasHistoryItem[]>;
  // Índice del canvas activo en el historial por conversación
  currentCanvasIndex: Map<string, number>;
  // Browser sessions keyed by session ID
  browserSessions: Map<string, BrowserSessionState>;
  // Which mode is active in the panel
  activeMode: ActiveMode;

  // Canvas actions
  setCanvasContent: (convId: string, type: 'html' | 'a2ui', content: string, path?: string) => void;
  /** Ola 7: set canvas to a URL (served by /canvas-host/* proxy). */
  setCanvasUrl: (convId: string, url: string, path?: string) => void;
  /** Marcar el canvas como error con mensaje claro al usuario. */
  setCanvasError: (convId: string, message: string, code?: string) => void;
  /** Ola 7: bump reloadKey on the active canvas to force iframe re-render. */
  reloadCanvas: (convId: string) => void;
  clearCanvas: (convId: string) => void;
  setCanvasSnapshot: (convId: string, base64?: string) => void;

  // Canvas history actions
  setCanvasHistory: (convId: string, items: CanvasHistoryItem[]) => void;
  /** Append a new item al final del historial y mover el cursor a él. */
  appendCanvasHistoryItem: (convId: string, item: CanvasHistoryItem) => void;
  /** Setear el índice activo para navegar entre canvases del mismo chat. */
  setCanvasCursor: (convId: string, index: number) => void;
  /** Eliminar un item del historial por id (tras el DELETE en el backend). */
  removeCanvasHistoryItem: (convId: string, id: string) => void;

  // Browser actions
  browserStarted: (sessionId: string) => void;
  browserNavigating: (sessionId: string, url: string) => void;
  browserAction: (sessionId: string, action: string, humanized: string, selector?: string) => void;
  browserSnapshot: (sessionId: string, base64: string, url?: string) => void;
  browserComplete: (sessionId: string, pagesVisited?: number) => void;
  browserError: (sessionId: string, error: string) => void;

  // Mode
  setActiveMode: (mode: ActiveMode) => void;

  // Selectors
  getCanvasForConversation: (convId: string) => CanvasState | undefined;
  getActiveBrowserSession: () => BrowserSessionState | undefined;
}

const emptyCanvas: CanvasState = {
  type: null,
  content: null,
  url: null,
  hasContent: false,
  reloadKey: 0,
  status: 'ready',
};

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
  canvasStates: new Map(),
  canvasHistory: new Map(),
  currentCanvasIndex: new Map(),
  browserSessions: new Map(),
  activeMode: null,

  setCanvasContent: (convId, type, content, path) => {
    set((s) => {
      const updated = new Map(s.canvasStates);
      updated.set(convId, {
        type,
        content,
        url: null,
        path,
        hasContent: true,
        reloadKey: 0,
        status: 'ready',
        errorMessage: undefined,
        errorCode: undefined,
      });
      return { canvasStates: updated, activeMode: 'canvas' };
    });
  },

  setCanvasUrl: (convId, url, path) => {
    set((s) => {
      const updated = new Map(s.canvasStates);
      // Reset reloadKey to 0 when switching to a new URL so the iframe
      // reloads cleanly. Subsequent canvas.reload events bump it.
      updated.set(convId, {
        type: 'url',
        content: null,
        url,
        path,
        hasContent: true,
        reloadKey: 0,
        status: 'ready',
        errorMessage: undefined,
        errorCode: undefined,
      });
      return { canvasStates: updated, activeMode: 'canvas' };
    });
  },

  setCanvasError: (convId, message, code) => {
    set((s) => {
      const updated = new Map(s.canvasStates);
      const existing = updated.get(convId) ?? emptyCanvas;
      updated.set(convId, {
        ...existing,
        hasContent: true,
        status: 'error',
        errorMessage: message,
        errorCode: code,
      });
      return { canvasStates: updated, activeMode: 'canvas' };
    });
  },

  reloadCanvas: (convId) => {
    set((s) => {
      const updated = new Map(s.canvasStates);
      const existing = updated.get(convId);
      // Only meaningful for url-mode canvases. Inline html/a2ui have no
      // server-side file to reload.
      if (existing && existing.type === 'url') {
        updated.set(convId, { ...existing, reloadKey: (existing.reloadKey ?? 0) + 1 });
        return { canvasStates: updated };
      }
      return s;
    });
  },

  clearCanvas: (convId) => {
    set((s) => {
      const updated = new Map(s.canvasStates);
      updated.set(convId, { ...emptyCanvas });
      return { canvasStates: updated };
    });
  },

  setCanvasSnapshot: (_convId, _base64) => {
    // Snapshot handling — future use (save to file)
  },

  setCanvasHistory: (convId, items) => {
    set((s) => {
      const updated = new Map(s.canvasHistory);
      updated.set(convId, items);
      // Posicionar el cursor al final (item más reciente) si no estaba seteado
      const cursors = new Map(s.currentCanvasIndex);
      if (items.length === 0) {
        cursors.delete(convId);
      } else if (!cursors.has(convId)) {
        cursors.set(convId, items.length - 1);
      } else {
        // Asegurar que el cursor no excede el array
        const idx = cursors.get(convId)!;
        cursors.set(convId, Math.min(idx, items.length - 1));
      }
      return { canvasHistory: updated, currentCanvasIndex: cursors };
    });
  },

  appendCanvasHistoryItem: (convId, item) => {
    set((s) => {
      const updated = new Map(s.canvasHistory);
      const prev = updated.get(convId) ?? [];
      // De-dup por id (si ya existe, no añadir — el WS event puede llegar antes
      // que un refresh del listado y al revés).
      if (prev.some((x) => x.id === item.id)) return s;
      const next = [...prev, item];
      updated.set(convId, next);
      // Mover el cursor al item recién añadido.
      const cursors = new Map(s.currentCanvasIndex);
      cursors.set(convId, next.length - 1);
      return { canvasHistory: updated, currentCanvasIndex: cursors };
    });
  },

  setCanvasCursor: (convId, index) => {
    set((s) => {
      const items = s.canvasHistory.get(convId) ?? [];
      if (index < 0 || index >= items.length) return s;
      const cursors = new Map(s.currentCanvasIndex);
      cursors.set(convId, index);
      return { currentCanvasIndex: cursors };
    });
  },

  removeCanvasHistoryItem: (convId, id) => {
    set((s) => {
      const updated = new Map(s.canvasHistory);
      const prev = updated.get(convId) ?? [];
      const next = prev.filter((x) => x.id !== id);
      updated.set(convId, next);
      const cursors = new Map(s.currentCanvasIndex);
      const oldIdx = cursors.get(convId) ?? 0;
      // Ajustar el cursor para que apunte a un item válido (al item anterior
      // si quitamos el actual; si era el primero, queda en 0).
      const newIdx = Math.max(0, Math.min(oldIdx, next.length - 1));
      if (next.length === 0) {
        cursors.delete(convId);
      } else {
        cursors.set(convId, newIdx);
      }
      return { canvasHistory: updated, currentCanvasIndex: cursors };
    });
  },

  browserStarted: (sessionId) => {
    set((s) => {
      const updated = new Map(s.browserSessions);
      updated.set(sessionId, {
        sessionId,
        currentUrl: null,
        humanizedAction: null,
        snapshot: null,
        actions: [],
        status: 'active',
        pagesVisited: 0,
      });
      return { browserSessions: updated, activeMode: 'browser' };
    });
  },

  browserNavigating: (sessionId, url) => {
    set((s) => {
      const updated = new Map(s.browserSessions);
      const existing = updated.get(sessionId);
      if (existing) {
        updated.set(sessionId, {
          ...existing,
          currentUrl: url,
          humanizedAction: `Navigating to ${extractDomain(url)}`,
          pagesVisited: existing.pagesVisited + 1,
        });
      }
      return { browserSessions: updated };
    });
  },

  browserAction: (sessionId, action, humanized, selector) => {
    set((s) => {
      const updated = new Map(s.browserSessions);
      const existing = updated.get(sessionId);
      if (existing) {
        updated.set(sessionId, {
          ...existing,
          humanizedAction: humanized,
          actions: [...existing.actions, {
            action,
            humanized,
            timestamp: new Date().toISOString(),
            selector,
          }],
        });
      }
      return { browserSessions: updated };
    });
  },

  browserSnapshot: (sessionId, base64, url) => {
    set((s) => {
      const updated = new Map(s.browserSessions);
      const existing = updated.get(sessionId);
      if (existing) {
        updated.set(sessionId, {
          ...existing,
          snapshot: base64,
          currentUrl: url ?? existing.currentUrl,
        });
      }
      return { browserSessions: updated };
    });
  },

  browserComplete: (sessionId, pagesVisited) => {
    set((s) => {
      const updated = new Map(s.browserSessions);
      const existing = updated.get(sessionId);
      if (existing) {
        updated.set(sessionId, {
          ...existing,
          status: 'complete',
          humanizedAction: 'Browsing complete',
          pagesVisited: pagesVisited ?? existing.pagesVisited,
        });
      }
      return { browserSessions: updated };
    });
  },

  browserError: (sessionId, error) => {
    set((s) => {
      const updated = new Map(s.browserSessions);
      const existing = updated.get(sessionId);
      if (existing) {
        updated.set(sessionId, {
          ...existing,
          status: 'error',
          humanizedAction: `Error: ${error}`,
        });
      }
      return { browserSessions: updated };
    });
  },

  setActiveMode: (mode) => set({ activeMode: mode }),

  getCanvasForConversation: (convId) => get().canvasStates.get(convId),

  getActiveBrowserSession: () => {
    for (const session of get().browserSessions.values()) {
      if (session.status === 'active') return session;
    }
    return undefined;
  },
}));

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}
