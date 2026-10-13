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
import { listCapabilities, type PlatformCapability } from '@/services/messages.service';

/**
 * Cuánto se considera "fresco" lo cacheado. Existe por un bug REAL: `load()`
 * hacía `if (loaded) return` → como el store es global y vive toda la sesión de
 * la SPA, una pestaña abierta desde hace horas mostraba para siempre el estado
 * del primer fetch. El usuario acabó con una fila "Connected" apuntando a un
 * connector ya borrado: Configure no abría nada y Sync/Disconnect daban 404 —
 * un callejón sin salida del que no se podía ni desconectar.
 * Stale-while-revalidate: los montajes seguidos no machacan la API, pero volver
 * a la pantalla más tarde SIEMPRE re-pregunta al backend (que es la verdad).
 */
const STALE_MS = 30_000;

interface PlatformCapabilitiesState {
  byPlatform: Record<string, PlatformCapability>;
  list: PlatformCapability[];
  loading: boolean;
  loaded: boolean;
  /** Momento del último fetch OK — alimenta el gate de frescura. */
  fetchedAt: number;
  error: string | null;
  /** Asegura datos frescos; comparte la promesa en vuelo (seguro con doble montaje). */
  load: () => Promise<void>;
  /** Fuerza re-fetch (WS `sync.completed`, mutación de connector, foco de ventana). */
  refresh: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

async function fetchInto(set: (partial: Partial<PlatformCapabilitiesState>) => void): Promise<void> {
  set({ loading: true });
  try {
    const list = await listCapabilities();
    const byPlatform: Record<string, PlatformCapability> = {};
    for (const cap of list) byPlatform[cap.platform] = cap;
    set({ list, byPlatform, loading: false, loaded: true, fetchedAt: Date.now(), error: null });
  } catch (err) {
    set({ loading: false, error: (err as Error).message });
  }
}

export const usePlatformCapabilitiesStore = create<PlatformCapabilitiesState>((set, get) => ({
  byPlatform: {},
  list: [],
  loading: false,
  loaded: false,
  fetchedAt: 0,
  error: null,
  load: async () => {
    if (inFlight) return inFlight;
    if (get().loaded && Date.now() - get().fetchedAt < STALE_MS) return;
    inFlight = fetchInto(set).finally(() => {
      inFlight = null;
    });
    return inFlight;
  },
  refresh: async () => {
    if (inFlight) return inFlight;
    inFlight = fetchInto(set).finally(() => {
      inFlight = null;
    });
    return inFlight;
  },
}));

/** Selector hook: the capability for one platform (undefined until loaded). */
export function usePlatformCapability(platform: string): PlatformCapability | undefined {
  return usePlatformCapabilitiesStore((s) => s.byPlatform[platform]);
}
