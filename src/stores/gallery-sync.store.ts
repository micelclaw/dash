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

// ─── Gallery sync store ─────────────────────────────────────────────
// Estado vivo del motor de sync de galería (móvil). Lo escribe el engine
// (lib/gallery-sync/engine.ts) y lo leen GallerySyncBlock (settings) y la
// píldora de progreso de Fotos. Progreso SIEMPRE visible — nunca un spinner
// ciego (regla del proyecto).

import { create } from 'zustand';
import type { GalleryPermissionState } from '@/lib/gallery-sync/native-gallery';
import type { GallerySyncDevice, GallerySyncAlbum } from '@/services/gallery-sync.service';

export type SyncPhase = 'enumerate' | 'hash' | 'dedup' | 'upload' | 'link' | 'advance';

export interface SyncProgress {
  albumConfigId: string;
  bucketName: string;
  phase: SyncPhase;
  /** Subidas completadas en la pasada actual del álbum. */
  done: number;
  /** Total estimado de la pasada (delta detectado hasta ahora). */
  total: number;
  currentName: string | null;
}

interface GallerySyncState {
  /** Capacidad detectada: null=sin sondear, false=APK sin plugin / web, true=capaz. */
  capable: boolean | null;
  permission: GalleryPermissionState | null;
  device: GallerySyncDevice | null;
  albums: GallerySyncAlbum[];
  running: boolean;
  current: SyncProgress | null;
  lastRunAt: number | null;
  lastRunError: string | null;

  setCapable: (v: boolean) => void;
  setPermission: (p: GalleryPermissionState | null) => void;
  setDevice: (d: GallerySyncDevice | null) => void;
  setAlbums: (a: GallerySyncAlbum[]) => void;
  patchAlbum: (id: string, patch: Partial<GallerySyncAlbum>) => void;
  setRunning: (v: boolean) => void;
  setCurrent: (p: SyncProgress | null) => void;
  setLastRun: (at: number, error?: string | null) => void;
}

export const useGallerySyncStore = create<GallerySyncState>()((set) => ({
  capable: null,
  permission: null,
  device: null,
  albums: [],
  running: false,
  current: null,
  lastRunAt: null,
  lastRunError: null,

  setCapable: (v) => set({ capable: v }),
  setPermission: (p) => set({ permission: p }),
  setDevice: (d) => set({ device: d }),
  setAlbums: (a) => set({ albums: a }),
  patchAlbum: (id, patch) => set((s) => ({
    albums: s.albums.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  })),
  setRunning: (v) => set({ running: v }),
  setCurrent: (p) => set({ current: p }),
  setLastRun: (at, error = null) => set({ lastRunAt: at, lastRunError: error }),
}));
