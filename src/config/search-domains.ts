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

// FUENTE ÚNICA (SSOT) de los dominios BUSCABLES del sistema. Alimenta los dos
// sitios donde el usuario filtra por dominio:
//   - el filtro `@` del Command Palette (Ctrl+K)
//   - los chips de filtro del módulo Search (/search, búsqueda avanzada)
// Añadir un dominio aquí lo hace aparecer en AMBOS sitios automáticamente.
//
// `domains` son las claves que entiende el backend en `?domains=` (ver
// VALID_DOMAINS + MEDIA_DOMAIN_ALIASES en core/src/routes/search.ts). Debe
// coincidir con lo que el backend realmente indexa/federa: 12 dominios locales
// + 3 multimedia (music/video/book). Projects = boards + cards (2 claves).
// El icono/color de cada uno sale del SSOT visual (resolveEntity), no se duplica.

export interface SearchableDomain {
  /** Clave estable del chip + alias del filtro `@` del Command Palette. */
  key: string;
  /** Etiqueta visible (chip + "Search in X"). */
  label: string;
  /** Dominio(s) backend enviados en `?domains=` (CSV-join). */
  domains: string[];
}

export const SEARCHABLE_DOMAINS: SearchableDomain[] = [
  { key: 'notes',     label: 'Notes',         domains: ['note'] },
  { key: 'calendar',  label: 'Events',        domains: ['event'] },
  { key: 'mail',      label: 'Emails',        domains: ['email'] },
  { key: 'contacts',  label: 'Contacts',      domains: ['contact'] },
  { key: 'diary',     label: 'Diary',         domains: ['diary'] },
  { key: 'drive',     label: 'Files',         domains: ['file'] },
  { key: 'photos',    label: 'Photos',        domains: ['photo'] },
  { key: 'projects',  label: 'Projects',      domains: ['kanban_board', 'kanban_card'] },
  { key: 'inventory', label: 'Inventory',     domains: ['inventory'] },
  { key: 'chat',      label: 'Conversations', domains: ['conversation'] },
  { key: 'messages',  label: 'Messages',      domains: ['message'] },
  { key: 'music',     label: 'Music',         domains: ['music'] },
  { key: 'video',     label: 'Video',         domains: ['video'] },
  { key: 'books',     label: 'Books',         domains: ['book'] },
];

const BY_KEY = new Map(SEARCHABLE_DOMAINS.map(d => [d.key, d]));
const LABEL_BY_DOMAIN = new Map(
  SEARCHABLE_DOMAINS.flatMap(d => d.domains.map(dom => [dom, d.label] as const)),
);

/** Entrada por su key (chip / alias `@`). */
export function searchableByKey(key: string): SearchableDomain | undefined {
  return BY_KEY.get(key);
}

/** CSV de dominios backend para `?domains=` a partir de una key de chip/alias. */
export function domainsParamOf(key: string): string {
  return (BY_KEY.get(key)?.domains ?? [key]).join(',');
}

/** Dominio representativo para resolver icono/color (resolveEntity). */
export function iconDomainOf(key: string): string {
  return BY_KEY.get(key)?.domains[0] ?? key;
}

/** Etiqueta de un dominio de RESULTADO (clave backend: 'note', 'kanban_card', 'music'…). */
export function labelOfResultDomain(domain: string): string {
  return LABEL_BY_DOMAIN.get(domain) ?? domain;
}
