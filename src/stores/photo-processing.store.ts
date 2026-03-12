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

export interface ProcessingPhase {
  phase: string;
  label: string;
  color: string;
}

const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Loading…',   color: '#94a3b8' },  // slate
  multimodal: { label: 'Vision AI',  color: '#f59e0b' },  // amber
  siglip:     { label: 'SigLIP',     color: '#06b6d4' },  // cyan
  dinov2:     { label: 'DINOv2',     color: '#3b82f6' },  // blue
  laion:      { label: 'Scoring',    color: '#a855f7' },  // purple
  faces:      { label: 'Faces',      color: '#ec4899' },  // pink
  post:       { label: 'Indexing',   color: '#22c55e' },  // green
};

interface PhotoProcessingState {
  /** Map of file_id → current processing phase */
  processingFiles: Map<string, ProcessingPhase>;
  /** The file_id currently being processed (spinner only on this one) */
  currentFileId: string | null;
  /** Whether processing is paused (shows grey paused icon on current file) */
  isPaused: boolean;
  setFilePhase: (fileId: string, phase: string) => void;
  setFilesPending: (fileIds: string[]) => void;
  setPaused: (paused: boolean) => void;
  clearFile: (fileId: string) => void;
  clearNonPending: () => void;
  clearAll: () => void;
}

export const usePhotoProcessingStore = create<PhotoProcessingState>()((set) => ({
  processingFiles: new Map(),
  currentFileId: null,
  isPaused: false,

  setFilePhase: (fileId, phase) =>
    set((state) => {
      const next = new Map(state.processingFiles);
      const cfg = PHASE_CONFIG[phase];
      next.set(fileId, { phase, label: cfg?.label ?? phase, color: cfg?.color ?? '#f59e0b' });
      return { processingFiles: next, currentFileId: fileId, isPaused: false };
    }),

  setFilesPending: (fileIds) =>
    set((state) => {
      const next = new Map(state.processingFiles);
      const cfg = PHASE_CONFIG.pending;
      for (const id of fileIds) {
        if (!next.has(id)) {
          next.set(id, { phase: 'pending', label: cfg.label, color: cfg.color });
        }
      }
      return { processingFiles: next };
    }),

  clearFile: (fileId) =>
    set((state) => {
      const next = new Map(state.processingFiles);
      next.delete(fileId);
      return { processingFiles: next };
    }),

  clearNonPending: () =>
    set((state) => {
      const next = new Map<string, ProcessingPhase>();
      for (const [id, entry] of state.processingFiles) {
        if (entry.phase === 'pending') next.set(id, entry);
      }
      return { processingFiles: next };
    }),

  setPaused: (paused) => set({ isPaused: paused }),

  clearAll: () => set({ processingFiles: new Map(), currentFileId: null, isPaused: false }),
}));
