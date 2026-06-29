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
 * El plugin nativo tiene 9 statuses; los agrupamos en 5 carriles legibles para el board.
 * `move` usa el `status` representativo del carril destino.
 */
export interface Lane {
  key: string;
  label: string;
  statuses: WorkboardStatus[];
  moveTo: WorkboardStatus;
  accent: string;
}

export const LANES: Lane[] = [
  { key: 'pending', label: 'Por reclamar', statuses: ['triage', 'backlog', 'todo', 'scheduled', 'ready'], moveTo: 'todo', accent: 'var(--text-dim)' },
  { key: 'running', label: 'En curso', statuses: ['running'], moveTo: 'running', accent: 'var(--blue, #3b82f6)' },
  { key: 'review', label: 'En revisión', statuses: ['review'], moveTo: 'review', accent: 'var(--amber)' },
  { key: 'blocked', label: 'Bloqueado', statuses: ['blocked'], moveTo: 'blocked', accent: 'var(--red, #ef4444)' },
  { key: 'done', label: 'Hecho', statuses: ['done'], moveTo: 'done', accent: 'var(--green, #10b981)' },
];

export function laneOf(status: WorkboardStatus): Lane {
  return LANES.find((l) => l.statuses.includes(status)) ?? LANES[0];
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

export const STATUS_LABEL: Record<WorkboardStatus, string> = {
  triage: 'triage', backlog: 'backlog', todo: 'por hacer', scheduled: 'programada',
  ready: 'lista', running: 'en curso', review: 'en revisión', blocked: 'bloqueada', done: 'hecha',
};
