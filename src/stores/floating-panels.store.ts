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

export type PanelId = 'calculator' | 'converter' | 'pomodoro' | 'voice-recorder';

interface PanelState {
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
  zIndex: number;
}

interface FloatingPanelsState {
  panels: Map<PanelId, PanelState>;
  nextZ: number;

  openPanel: (id: PanelId) => void;
  closePanel: (id: PanelId) => void;
  togglePanel: (id: PanelId) => void;
  minimizePanel: (id: PanelId) => void;
  restorePanel: (id: PanelId) => void;
  bringToFront: (id: PanelId) => void;
  updatePosition: (id: PanelId, pos: { x: number; y: number }) => void;
}

const DEFAULT_SIZES: Record<PanelId, { width: number; height: number }> = {
  calculator:       { width: 320, height: 480 },
  converter:        { width: 360, height: 420 },
  pomodoro:         { width: 300, height: 380 },
  'voice-recorder': { width: 320, height: 280 },
};

const STAGGER = 30;

export const useFloatingPanelsStore = create<FloatingPanelsState>()((set, get) => ({
  panels: new Map(),
  nextZ: 250,

  openPanel: (id) => {
    const { panels, nextZ } = get();
    if (panels.has(id)) {
      // Already open — restore if minimized, bring to front
      const existing = panels.get(id)!;
      const updated = new Map(panels);
      updated.set(id, { ...existing, minimized: false, zIndex: nextZ });
      set({ panels: updated, nextZ: nextZ + 1 });
      return;
    }
    const size = DEFAULT_SIZES[id];
    const offset = panels.size * STAGGER;
    const x = Math.min(120 + offset, window.innerWidth - size.width - 40);
    const y = Math.min(80 + offset, window.innerHeight - size.height - 80);
    const updated = new Map(panels);
    updated.set(id, { position: { x, y }, size, minimized: false, zIndex: nextZ });
    set({ panels: updated, nextZ: nextZ + 1 });
  },

  closePanel: (id) => {
    const updated = new Map(get().panels);
    updated.delete(id);
    set({ panels: updated });
  },

  togglePanel: (id) => {
    const { panels } = get();
    if (panels.has(id)) {
      get().closePanel(id);
    } else {
      get().openPanel(id);
    }
  },

  minimizePanel: (id) => {
    const { panels } = get();
    const panel = panels.get(id);
    if (!panel) return;
    const updated = new Map(panels);
    updated.set(id, { ...panel, minimized: true });
    set({ panels: updated });
  },

  restorePanel: (id) => {
    const { panels, nextZ } = get();
    const panel = panels.get(id);
    if (!panel) return;
    const updated = new Map(panels);
    updated.set(id, { ...panel, minimized: false, zIndex: nextZ });
    set({ panels: updated, nextZ: nextZ + 1 });
  },

  bringToFront: (id) => {
    const { panels, nextZ } = get();
    const panel = panels.get(id);
    if (!panel) return;
    const updated = new Map(panels);
    updated.set(id, { ...panel, zIndex: nextZ });
    set({ panels: updated, nextZ: nextZ + 1 });
  },

  updatePosition: (id, pos) => {
    const { panels } = get();
    const panel = panels.get(id);
    if (!panel) return;
    const updated = new Map(panels);
    updated.set(id, { ...panel, position: pos });
    set({ panels: updated });
  },
}));
