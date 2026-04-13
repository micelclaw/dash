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
  // Browser sessions keyed by session ID
  browserSessions: Map<string, BrowserSessionState>;
  // Which mode is active in the panel
  activeMode: ActiveMode;

  // Canvas actions
  setCanvasContent: (convId: string, type: 'html' | 'a2ui', content: string, path?: string) => void;
  /** Ola 7: set canvas to a URL (served by /canvas-host/* proxy). */
  setCanvasUrl: (convId: string, url: string, path?: string) => void;
  /** Ola 7: bump reloadKey on the active canvas to force iframe re-render. */
  reloadCanvas: (convId: string) => void;
  clearCanvas: (convId: string) => void;
  setCanvasSnapshot: (convId: string, base64?: string) => void;

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

const emptyCanvas: CanvasState = { type: null, content: null, url: null, hasContent: false, reloadKey: 0 };

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
  canvasStates: new Map(),
  browserSessions: new Map(),
  activeMode: null,

  setCanvasContent: (convId, type, content, path) => {
    set((s) => {
      const updated = new Map(s.canvasStates);
      updated.set(convId, { type, content, url: null, path, hasContent: true, reloadKey: 0 });
      return { canvasStates: updated, activeMode: 'canvas' };
    });
  },

  setCanvasUrl: (convId, url, path) => {
    set((s) => {
      const updated = new Map(s.canvasStates);
      // Reset reloadKey to 0 when switching to a new URL so the iframe
      // reloads cleanly. Subsequent canvas.reload events bump it.
      updated.set(convId, { type: 'url', content: null, url, path, hasContent: true, reloadKey: 0 });
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
