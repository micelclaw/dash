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

// ─── Service URL Resolver Store ──────────────────────────────────────
// Cachea el catálogo de /network/services (dominio primario + URL por nombre
// de cada servicio) y resuelve la URL de un servicio: si hay dominio principal
// y el servicio está expuesto → https://<sub>.<dominio>; si no → el respaldo
// localhost:puerto que pase el llamante. Es la SSOT que sustituye los
// `http://localhost:PUERTO` escritos a mano por el dash.

import { create } from 'zustand';
import { getServices } from '@/services/domains.service';

interface ServiceUrlsState {
  primaryDomain: string | null;
  urls: Record<string, string | null>; // slug → url pública (o null)
  status: 'idle' | 'loading' | 'ready' | 'error';
  load: (force?: boolean) => Promise<void>;
  /** Espera a que el catálogo esté resuelto ('ready' o 'error'); dispara la carga si está en 'idle'. */
  ensureLoaded: () => Promise<void>;
  /** URL del servicio por nombre, con respaldo si no hay dominio configurado. */
  resolve: (slug: string, fallback: string) => string;
}

export const useServiceUrlsStore = create<ServiceUrlsState>()((set, get) => ({
  primaryDomain: null,
  urls: {},
  status: 'idle',

  load: async (force = false) => {
    const { status } = get();
    if (!force && (status === 'loading' || status === 'ready')) return;
    set({ status: 'loading' });
    try {
      const res = await getServices();
      const urls: Record<string, string | null> = {};
      for (const s of res.services) urls[s.slug] = s.exposed ? s.url : null;
      set({ primaryDomain: res.primary_domain, urls, status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },

  ensureLoaded: async () => {
    const { status, load } = get();
    if (status === 'idle') void load();
    const settled = (s: ServiceUrlsState['status']) => s === 'ready' || s === 'error';
    if (settled(get().status)) return;
    // Espera a la primera transición a 'ready'/'error'. La suscripción se autolimpia al resolver;
    // load() siempre acaba en uno de los dos estados (try/catch), así que nunca queda colgada.
    await new Promise<void>((resolve) => {
      const unsub = useServiceUrlsStore.subscribe((state) => {
        if (settled(state.status)) {
          unsub();
          resolve();
        }
      });
    });
  },

  resolve: (slug, fallback) => {
    return get().urls[slug] ?? fallback;
  },
}));
