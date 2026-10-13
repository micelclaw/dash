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

import { api } from '@/services/api';
import type {
  WorkboardCard, WorkboardStatus, WorkboardStatusResponse,
  WorkboardBoardSummary, WorkboardDiagnostic, WorkboardPriority,
  WorkboardStats, WorkboardRunAttempt,
} from './types';

// Recordatorio: `api.get/post` NO desempaquetan el envelope → tipar `<{ data: T }>` y usar `.data`.

export interface NewCardInput {
  title: string;
  priority?: WorkboardPriority;
  notes?: string;
  labels?: string[];
  agent_id?: string;
}

export interface UpdateCardInput {
  title?: string;
  notes?: string;
  priority?: WorkboardPriority;
  labels?: string[];
  agent_id?: string;
}

export const workboardApi = {
  status: () =>
    api.get<{ data: WorkboardStatusResponse }>('/workboard/status').then((r) => r.data),

  enable: () =>
    api.post<{ data: { ok: boolean; gateway_reload_required: boolean } }>('/workboard/enable').then((r) => r.data),

  listCards: () =>
    api.get<{ data: { cards: WorkboardCard[]; statuses: WorkboardStatus[] } }>('/workboard/cards').then((r) => r.data),

  boards: () =>
    api.get<{ data: { boards: WorkboardBoardSummary[] } }>('/workboard/boards').then((r) => r.data.boards),

  stats: () =>
    api.get<{ data: WorkboardStats }>('/workboard/stats').then((r) => r.data),

  diagnostics: () =>
    api.get<{ data: { diagnostics?: WorkboardDiagnostic[] } }>('/workboard/diagnostics').then((r) => r.data.diagnostics ?? []),

  createCard: (input: NewCardInput) =>
    api.post<{ data: { card: WorkboardCard } }>('/workboard/cards', input).then((r) => r.data.card),

  update: (id: string, patch: UpdateCardInput) =>
    api.patch<{ data: unknown }>(`/workboard/cards/${id}`, patch),

  move: (id: string, status: WorkboardStatus, position?: number) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/move`, { status, position }),

  claim: (id: string, owner_id: string) =>
    api.post<{ data: { card: WorkboardCard; token: string } }>(`/workboard/cards/${id}/claim`, { owner_id }),

  heartbeat: (id: string, owner_id: string, token?: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/heartbeat`, { owner_id, token }),

  release: (id: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/release`, {}),

  reassign: (id: string, agent_id: string, opts?: { status?: WorkboardStatus; reset_failures?: boolean }) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/reassign`, { agent_id, ...opts }),

  reclaim: (id: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/reclaim`, {}),

  promote: (id: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/promote`, {}),

  block: (id: string, reason?: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/block`, { reason }),

  unblock: (id: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/unblock`, {}),

  comment: (id: string, body: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/comment`, { body }),

  proof: (id: string, input: { status: string; label?: string; url?: string; note?: string }) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/proof`, input),

  complete: (id: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/complete`, {}),

  archive: (id: string, archived: boolean) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/archive`, { archived }),

  runs: (id: string) =>
    api.get<{ data: { attempts?: WorkboardRunAttempt[] } }>(`/workboard/cards/${id}/runs`).then((r) => r.data.attempts ?? []),

  // Despachador LOCAL de UNA card: el agente asignado la trabaja en su modelo local (visible en
  // Conversations). Devuelve la conversación de trabajo.
  work: (id: string) =>
    api.post<{ data: { conversation_id: string; agent: string } }>(`/workboard/cards/${id}/work`, {}).then((r) => r.data),

  // Conversaciones de trabajo enlazadas a la card (por metadata.workboard_card_id).
  cardConversations: (id: string) =>
    api.get<{ data: { conversations: WorkboardCardConversation[] } }>(`/workboard/cards/${id}/conversations`).then((r) => r.data.conversations),

  // Batch: housekeeping + pone a trabajar en local cada card asignada por trabajar.
  dispatch: () =>
    api.post<{ data: { dispatched: number; promoted: number; skipped: number; conversation_ids: string[] } }>('/workboard/dispatch', {}).then((r) => r.data),

  remove: (id: string) =>
    api.delete<{ data: unknown }>(`/workboard/cards/${id}`),
};

export interface WorkboardCardConversation {
  conversation_id: string;
  agent: string;
  started_at: string;
}
