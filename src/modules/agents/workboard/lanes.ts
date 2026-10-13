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

import type { WorkboardStatus, WorkboardPriority } from './types';

/**
 * El plugin nativo tiene 9 statuses (fases del ciclo de vida). El board ofrece DOS vistas:
 *  - "Fases": una columna por status (paridad con el Panel de trabajo de OpenClaw).
 *  - "Carriles": las 9 fases agrupadas en 5 carriles legibles.
 */

// ── Vista "Fases": una columna por status ──────────────────────────────────
export interface StatusColumn {
  status: WorkboardStatus;
  label: string;
  accent: string;
}

export const STATUS_COLUMNS: [StatusColumn, ...StatusColumn[]] = [
  { status: 'triage', label: 'Triage', accent: 'var(--text-muted)' },
  { status: 'backlog', label: 'Pendientes', accent: 'var(--text-dim)' },
  { status: 'todo', label: 'Por hacer', accent: 'var(--purple, #a855f7)' },
  { status: 'scheduled', label: 'Programado', accent: 'var(--cyan, #14b8a6)' },
  { status: 'ready', label: 'Listo', accent: 'var(--blue, #3b82f6)' },
  { status: 'running', label: 'En ejecución', accent: 'var(--blue, #3b82f6)' },
  { status: 'review', label: 'En revisión', accent: 'var(--amber)' },
  { status: 'blocked', label: 'Bloqueado', accent: 'var(--red, #ef4444)' },
  { status: 'done', label: 'Hecho', accent: 'var(--green, #10b981)' },
];

// ── Vista "Carriles": 9 fases → 5 carriles ─────────────────────────────────
export interface Lane {
  key: string;
  label: string;
  statuses: WorkboardStatus[];
  moveTo: WorkboardStatus;
  accent: string;
}

export const LANES: [Lane, ...Lane[]] = [
  { key: 'pending', label: 'Por reclamar', statuses: ['triage', 'backlog', 'todo', 'scheduled', 'ready'], moveTo: 'todo', accent: 'var(--text-dim)' },
  { key: 'running', label: 'En curso', statuses: ['running'], moveTo: 'running', accent: 'var(--blue, #3b82f6)' },
  { key: 'review', label: 'En revisión', statuses: ['review'], moveTo: 'review', accent: 'var(--amber)' },
  { key: 'blocked', label: 'Bloqueado', statuses: ['blocked'], moveTo: 'blocked', accent: 'var(--red, #ef4444)' },
  { key: 'done', label: 'Hecho', statuses: ['done'], moveTo: 'done', accent: 'var(--green, #10b981)' },
];

export function laneOf(status: WorkboardStatus): Lane {
  return LANES.find((l) => l.statuses.includes(status)) ?? LANES[0];
}

/**
 * ¿Se puede mover una card a mano de `from` a `to`? El plugin gobierna algunas transiciones:
 *  - una card `scheduled` está APARCADA: solo sale a `done` (el sistema la promueve a `ready` sola);
 *  - `scheduled` como DESTINO a mano es una vía muerta (queda sin fecha, solo puede ir a `done`).
 * El resto se deja permisivo — el mensaje legible de `friendlyMove` cubre lo que el cliente no puede
 * saber (p.ej. dependencias sin terminar).
 */
export function canManualMove(from: WorkboardStatus, to: WorkboardStatus): boolean {
  if (from === to) return false;
  if (from === 'scheduled' && to !== 'done') return false;
  if (to === 'scheduled') return false;
  return true;
}

/** Traduce el error de move del plugin a algo legible para el usuario. */
export function friendlyMove(rawMessage: string): string {
  const m = rawMessage.toLowerCase();
  if (m.includes('scheduled for later')) return 'Esta tarea está programada; saldrá a «Listo» cuando toque, no se mueve a mano.';
  if (m.includes('dependencies are not done')) return 'Depende de otra tarea que aún no está hecha.';
  return `No se pudo mover: ${rawMessage}`;
}

export function columnOf(status: WorkboardStatus): StatusColumn {
  return STATUS_COLUMNS.find((c) => c.status === status) ?? STATUS_COLUMNS[0];
}

export const PRIORITY_COLOR: Record<WorkboardPriority, string> = {
  low: 'var(--text-dim)',
  normal: 'var(--blue, #3b82f6)',
  high: 'var(--amber)',
  urgent: 'var(--red, #ef4444)',
};

export const PRIORITY_LABEL: Record<WorkboardPriority, string> = {
  low: 'baja', normal: 'normal', high: 'alta', urgent: 'urgente',
};

export const PRIORITY_ORDER: WorkboardPriority[] = ['low', 'normal', 'high', 'urgent'];

export const STATUS_LABEL: Record<WorkboardStatus, string> = {
  triage: 'triage', backlog: 'pendiente', todo: 'por hacer', scheduled: 'programada',
  ready: 'lista', running: 'en ejecución', review: 'en revisión', blocked: 'bloqueada', done: 'hecha',
};
