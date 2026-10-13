/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

/**
 * Parser de deep-links de la app móvil → ruta interna del dash.
 *
 * Los widgets nativos de Android (y otros lanzadores) abren la app con una URL
 * `micelclaw://open?route=<ruta-del-dash-url-encoded>` (esquema declarado en el
 * AndroidManifest). El wrapper Capacitor relanza la app y `@capacitor/app` emite
 * `appUrlOpen`; el hook use-deep-links pasa la URL por aquí y navega a la ruta.
 *
 * Puro y sin dependencias → testeable en el navegador sin APK.
 */

const ACCEPTED_SCHEMES = ['micelclaw:', 'claw:'];

/**
 * Devuelve la ruta interna del dash (path + querystring, empieza por "/") o null
 * si la URL no es un deep-link de navegación válido.
 *
 * Solo acepta la acción `open` con `route`. Rechaza rutas que no empiecen por un
 * único "/" (evita `//host`, `http(s)://`, y escapar del SPA → open-redirect).
 */
export function parseDeepLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!ACCEPTED_SCHEMES.includes(url.protocol)) return null;
  // host actúa como "acción": micelclaw://open?route=...
  if (url.hostname !== 'open') return null;

  const routeRaw = url.searchParams.get('route');
  if (!routeRaw) return null;

  let route: string;
  try {
    route = decodeURIComponent(routeRaw);
  } catch {
    route = routeRaw;
  }
  route = route.trim();

  // Debe ser una ruta interna absoluta: un solo "/" al inicio, sin esquema ni "//".
  if (!route.startsWith('/')) return null;
  if (route.startsWith('//')) return null;
  if (/^\/\\/.test(route)) return null; // "/\" trucos
  if (/[a-z][a-z0-9+.-]*:/i.test(route.split(/[?#]/)[0] ?? '')) return null; // esquema embebido en el path

  return route;
}
