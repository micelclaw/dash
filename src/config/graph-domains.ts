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

// FUENTE ÚNICA (SSOT) de los dominios de RECORD que aparecen en el knowledge
// graph (modo "records"). Antes estaba duplicado en 6 sitios (RECORD_DOMAIN,
// RECORD_CATEGORIES, RECORD_TYPE_LIST, DOMAIN_LABEL, TYPE_COLORS, entityTypeShape).
// Añadir un dominio al grafo = UNA entrada aquí (+ su tabla en la UNION de
// core/src/routes/graph.ts si es nuevo en el backend).
//
// Debe coincidir con el `RECORD_DOMAINS` del backend (graph.ts): el `domain` es
// el `source_type` de entity_links (= el `center_record_type` que espera el
// endpoint). El icono/label salen del SSOT visual (resolveEntity); el `color`
// vive aquí porque el renderer D3 necesita HEX (hace `+ '18'` para alpha y mezcla
// con los colores de comunidad), mientras resolveEntity da `var(--mod-*)`.

import type { NodeShape } from '@/components/graph/graph-utils';

export interface GraphRecordDomain {
  /** Clave canónica singular (para resolveEntity): contact, note, inventory… */
  type: string;
  /** Nombre backend: entity_links.source_type / center_record_type (plural salvo inventory). */
  domain: string;
  /** Forma del nodo en el D3. */
  shape: NodeShape;
  /** Color HEX para el renderer (≈ var(--mod-*)). */
  color: string;
}

export const GRAPH_RECORD_DOMAINS: GraphRecordDomain[] = [
  { type: 'contact',     domain: 'contacts',      shape: 'circle',   color: '#ec4899' },
  { type: 'note',        domain: 'notes',         shape: 'square',   color: '#8b5cf6' },
  { type: 'email',       domain: 'emails',        shape: 'diamond',  color: '#06b6d4' },
  { type: 'event',       domain: 'events',        shape: 'triangle', color: '#fb923c' },
  { type: 'file',        domain: 'files',         shape: 'triangle', color: '#84cc16' },
  { type: 'diary',       domain: 'diary_entries', shape: 'octagon',  color: '#f43f5e' },
  { type: 'kanban_card', domain: 'kanban_cards',  shape: 'hexagon',  color: '#f97316' },
  { type: 'inventory',   domain: 'inventory',     shape: 'square',   color: '#d97706' }, // var(--mod-inventory)
];

const BY_TYPE = new Map(GRAPH_RECORD_DOMAINS.map(d => [d.type, d]));

/** Tipos de record del grafo (para leyenda / filtros). */
export const GRAPH_RECORD_TYPES: string[] = GRAPH_RECORD_DOMAINS.map(d => d.type);

/** Mapa type → domain backend (plural) para los endpoints del grafo. */
export const GRAPH_RECORD_DOMAIN_BY_TYPE: Record<string, string> =
  Object.fromEntries(GRAPH_RECORD_DOMAINS.map(d => [d.type, d.domain]));

/** Color HEX del nodo por tipo de record (undefined si no es un record-type). */
export function graphRecordColor(type: string): string | undefined {
  return BY_TYPE.get(type)?.color;
}

/** Forma del nodo por tipo de record (undefined si no es un record-type). */
export function graphRecordShape(type: string): NodeShape | undefined {
  return BY_TYPE.get(type)?.shape;
}
