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

// ─── Dynamic source loaders for StepCard params ─────────────
//
// Step type definitions can declare `param.source: 'agents'` (or
// `'calendars'`, `'feeds'`, etc.) instead of hardcoding `options`.
// This module fetches the live list from the right endpoint and
// returns a uniform `{value, label}[]` for the dropdown.
//
// Stale-while-revalidate cache by source key — most sources change
// rarely (agents are added once, calendars are edited maybe weekly),
// so we cache for 60s.

import { api } from '@/services/api';

export interface Option {
  value: string;
  label: string;
}

interface ApiList<T> { data: T[] }

const cache = new Map<string, { ts: number; options: Option[] }>();
const TTL_MS = 60_000;

export async function loadSourceOptions(source: string): Promise<Option[]> {
  const cached = cache.get(source);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.options;

  let options: Option[] = [];
  try {
    options = await fetchSource(source);
  } catch (err) {
    console.error(`Failed to load source options for "${source}"`, err);
  }
  cache.set(source, { ts: Date.now(), options });
  return options;
}

/** Force-refresh the cache for a source (e.g. after an agent is created). */
export function invalidateSourceCache(source?: string): void {
  if (source) cache.delete(source);
  else cache.clear();
}

// ─── Per-source fetchers ───────────────────────────────────────────

async function fetchSource(source: string): Promise<Option[]> {
  switch (source) {
    case 'agents': {
      const res = await api.get<ApiList<{ name: string; display_name?: string }>>('/managed-agents');
      return (res.data ?? []).map(a => ({
        value: a.name,
        label: a.display_name ?? a.name,
      }));
    }
    case 'calendars': {
      const res = await api.get<ApiList<{ id: string; name: string }>>('/calendars');
      return (res.data ?? []).map(c => ({ value: c.id, label: c.name }));
    }
    case 'email_accounts': {
      const res = await api.get<ApiList<{ id: string; email: string }>>('/email-accounts');
      return (res.data ?? []).map(a => ({ value: a.id, label: a.email }));
    }
    case 'feeds': {
      const res = await api.get<ApiList<{ id: string; title: string }>>('/feeds');
      return (res.data ?? []).map(f => ({ value: f.id, label: f.title }));
    }
    case 'kanban_boards': {
      const res = await api.get<ApiList<{ id: string; name: string }>>('/projects/boards');
      return (res.data ?? []).map(b => ({ value: b.id, label: b.name }));
    }
    case 'albums': {
      const res = await api.get<ApiList<{ id: string; name: string }>>('/photos/albums');
      return (res.data ?? []).map(a => ({ value: a.id, label: a.name }));
    }
    case 'ha_entities':
    case 'ha_scenes':
    case 'kanban_columns':
      // No simple GET endpoint; the user types the id directly. Return
      // [] so the StepCard falls back to a free-text input.
      return [];
    default:
      return [];
  }
}
