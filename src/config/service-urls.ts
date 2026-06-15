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

// ─── Service URL helpers ─────────────────────────────────────────────
// Punto único para que el dash abra/enlace un servicio por su nombre de
// dominio (stirling.victor.claw) en vez de localhost:puerto. Respaldado por
// el store service-urls. Añadir un servicio al catálogo del backend basta
// para que su URL aparezca aquí sin tocar cada botón.

import { useEffect } from 'react';
import { useServiceUrlsStore } from '@/stores/service-urls.store';

/**
 * Hook reactivo: devuelve la URL pública del servicio `slug` si hay dominio
 * principal configurado, o `fallback` (típicamente http://localhost:PUERTO).
 * Dispara la carga del catálogo la primera vez.
 */
export function useServiceUrl(slug: string, fallback: string): string {
  const status = useServiceUrlsStore((s) => s.status);
  const url = useServiceUrlsStore((s) => s.urls[slug]);
  const load = useServiceUrlsStore((s) => s.load);

  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  return url ?? fallback;
}

/** Versión imperativa para handlers onClick. */
export function resolveServiceUrl(slug: string, fallback: string): string {
  return useServiceUrlsStore.getState().resolve(slug, fallback);
}

/** Abre el servicio en una pestaña nueva por su URL de dominio (o el respaldo). */
export function openServiceTab(slug: string, fallback: string): void {
  window.open(resolveServiceUrl(slug, fallback), '_blank', 'noopener,noreferrer');
}
