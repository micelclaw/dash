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

import type { WorkboardCard, WorkboardDiagnostic } from './types';

/** Índice card_id → conjunto de kinds de diagnóstico (para derivar las pills sin backend extra). */
export type DiagIndex = Record<string, Set<string>>;

export function buildDiagIndex(diags: WorkboardDiagnostic[]): DiagIndex {
  const idx: DiagIndex = {};
  for (const d of diags) {
    if (!d.card_id) continue;
    (idx[d.card_id] ??= new Set()).add(d.kind);
  }
  return idx;
}

const has = (idx: DiagIndex, id: string, kind: string) => idx[id]?.has(kind) ?? false;

export interface Pill {
  key: string;
  label: string;
  color: string;
  match: (c: WorkboardCard, idx: DiagIndex) => boolean;
}

/**
 * Pills derivadas de `cards` + `diagnostics` (mismos contadores que el Panel de trabajo de OpenClaw).
 * Cada pill es también un filtro rápido: `match` se reutiliza para filtrar el board al pulsarla.
 */
export const PILLS: Pill[] = [
  { key: 'running', label: 'en ejecución', color: 'var(--blue, #3b82f6)', match: (c) => c.status === 'running' },
  { key: 'blocked', label: 'bloqueado', color: 'var(--red, #ef4444)', match: (c) => c.status === 'blocked' },
  { key: 'stale', label: 'obsoleto', color: 'var(--amber)', match: (c, i) => Boolean(c.metadata?.stale) || has(i, c.id, 'orphaned_session') },
  { key: 'ready_unassigned', label: 'listo sin asignar', color: 'var(--amber)', match: (c, i) => (c.status === 'ready' && !c.claim?.owner_id) || has(i, c.id, 'stranded_ready') },
  { key: 'untested', label: 'sin prueba', color: 'var(--amber)', match: (c, i) => has(i, c.id, 'missing_proof') || ((c.status === 'done' || c.status === 'review') && (c.proof?.length ?? 0) === 0) },
  { key: 'failed', label: 'intentos fallidos', color: 'var(--red, #ef4444)', match: (c, i) => (c.metadata?.failure_count ?? 0) > 0 || has(i, c.id, 'repeated_failures') },
];

export function countPill(pill: Pill, cards: WorkboardCard[], idx: DiagIndex): number {
  return cards.reduce((n, c) => (pill.match(c, idx) ? n + 1 : n), 0);
}
