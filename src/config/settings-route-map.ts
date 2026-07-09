/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { MODULES } from '@/config/modules';

/**
 * Botón "Ajustes" CONTEXTUAL de la barra inferior móvil (sustituye a "Hoy").
 * Según el módulo en pantalla, lleva a su sección de ajustes; si el módulo no tiene
 * sección propia, cae a los Ajustes generales (`/settings`).
 *
 * Las claves de sección son subrutas reales `/settings/<clave>` del SECTION_REGISTRY
 * (`components/settings/sections/index.ts`). Solo se mapean módulos con sección propia.
 */
export const SETTINGS_ROUTE_BY_MODULE: Record<string, string> = {
  mail: '/settings/mail',
  calendar: '/settings/calendar',
  photos: '/settings/photos',
  feeds: '/settings/feeds',
  search: '/settings/search',
  drive: '/settings/drive',
  gateway: '/settings/gateway-auth',
  studio: '/settings/studio-engines',
  digest: '/settings/digest',
  storage: '/settings/storage',
  // Caso especial: Activity usa un modal propio abierto por querystring (adminOnly).
  activity: '/activity?settings=open',
};

/**
 * Deriva el destino de Ajustes para la ruta actual. Usa la misma derivación
 * módulo-desde-ruta que `use-module-context.ts` (MODULES.find por prefijo de path).
 * Fallback a `/settings` (landing) si el módulo no tiene sección propia o no se reconoce.
 */
export function settingsRouteForPath(pathname: string): string {
  const mod = MODULES.find((m) => m.path && pathname.startsWith(m.path));
  if (mod && SETTINGS_ROUTE_BY_MODULE[mod.id]) return SETTINGS_ROUTE_BY_MODULE[mod.id];
  return '/settings';
}
