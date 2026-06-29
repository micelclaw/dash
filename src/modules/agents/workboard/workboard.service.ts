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
} from './types';

// Recordatorio: `api.get/post` NO desempaquetan el envelope → tipar `<{ data: T }>` y usar `.data`.

export interface NewCardInput {
  title: string;
  priority?: WorkboardPriority;
  notes?: string;
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

  diagnostics: () =>
    api.get<{ data: { diagnostics?: WorkboardDiagnostic[] } }>('/workboard/diagnostics').then((r) => r.data.diagnostics ?? []),

  createCard: (input: NewCardInput) =>
    api.post<{ data: { card: WorkboardCard } }>('/workboard/cards', input).then((r) => r.data.card),

  move: (id: string, status: WorkboardStatus, position?: number) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/move`, { status, position }),

  claim: (id: string, owner_id: string) =>
    api.post<{ data: { card: WorkboardCard; token: string } }>(`/workboard/cards/${id}/claim`, { owner_id }),

  heartbeat: (id: string, owner_id: string, token?: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/heartbeat`, { owner_id, token }),

  release: (id: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/release`, {}),

  proof: (id: string, input: { status: string; label?: string; url?: string; note?: string }) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/proof`, input),

  complete: (id: string) =>
    api.post<{ data: unknown }>(`/workboard/cards/${id}/complete`, {}),

  remove: (id: string) =>
    api.delete<{ data: unknown }>(`/workboard/cards/${id}`),
};
