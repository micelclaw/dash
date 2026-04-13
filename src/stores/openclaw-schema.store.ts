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

// ─── OpenClaw schema store (Ola 7) ──────────────────────────────────
//
// Caches the OpenClaw config JSON Schema fetched from
// `GET /gateway/config-schema`. The schema is the source of truth for:
//   1. Validation in the Raw JSON editor (/settings/raw)
//   2. Section pickers / introspection of available config keys
//   3. Future schema-driven dynamic forms (deferred to post-MVP)
//
// The schema rarely changes (only on OpenClaw upgrades), so we fetch it
// once at boot and keep it in memory. Failures are non-fatal — sections
// that depend on schema validation degrade gracefully.

import { create } from 'zustand';
import { api } from '@/services/api';

type JsonSchema = Record<string, unknown>;

interface OpenclawSchemaState {
  schema: JsonSchema | null;
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;

  /** Fetch and cache the schema. Idempotent — does nothing if already loaded. */
  loadConfigSchema: () => Promise<void>;
  /** Force a re-fetch (for debugging or after a config patch that may have moved things). */
  reloadConfigSchema: () => Promise<void>;
}

export const useOpenclawSchemaStore = create<OpenclawSchemaState>()((set, get) => ({
  schema: null,
  loading: false,
  error: null,
  lastLoadedAt: null,

  loadConfigSchema: async () => {
    if (get().schema || get().loading) return;
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: JsonSchema }>('/gateway/config-schema');
      set({
        schema: res.data,
        loading: false,
        lastLoadedAt: Date.now(),
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load schema';
      // Non-fatal: log to console for debugging but don't break the app.
      // Sections that need the schema (Raw editor) will surface the error.
      // eslint-disable-next-line no-console
      console.warn('[openclaw-schema] failed to load config schema:', message);
      set({ loading: false, error: message });
    }
  },

  reloadConfigSchema: async () => {
    set({ schema: null, lastLoadedAt: null });
    await get().loadConfigSchema();
  },
}));
