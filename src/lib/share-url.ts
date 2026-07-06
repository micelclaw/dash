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

/**
 * Construye la URL pública de un enlace compartido desde el ORIGEN del dash.
 *
 * La página `/share/:token` es una ruta del DASH (React, fuera del AuthGate),
 * servida allá donde se sirve el dash (Vite :7100 en dev, el dominio `.claw` vía
 * Caddy en prod) — NUNCA es una ruta de la API de Core (:7200). El backend, al no
 * tener contexto del origen del dash en dev, componía la URL contra su propio host
 * (`http://127.0.0.1:7200/share/…`) → 404 al abrirla.
 *
 * Preferencia: si hay un **dominio configurado** (`primaryDomain`, p.ej. `victor.claw`)
 * se usa ÉSE — así el enlace es el dominio bonito y no la IP, aunque estés navegando
 * el dash por `127.0.0.1:7100`. Si no hay dominio, se cae a `window.location.origin`.
 * El `token` es la credencial.
 */
export function buildShareUrl(token: string, domain?: string | null): string {
  const d = domain?.trim().replace(/\/+$/, '');
  if (d) {
    if (/^https?:\/\//i.test(d)) return `${d}/share/${token}`;
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[?::1|\d{1,3}(\.\d{1,3}){3})/i.test(d);
    return `${isLocal ? 'http' : 'https'}://${d}/share/${token}`;
  }
  return `${window.location.origin}/share/${token}`;
}
