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

// ─── OpenClaw plugin catalog (§PARTE 3) ─────────────────────────────
// Client for the MicelHub "Plugins" tab. All requests go through api.ts.
// Admin-only endpoints under /gateway/plugins.

import { api } from './api';

export type PluginSurface = 'tool' | 'runtime' | 'provider' | 'channel' | 'utility';

export interface CatalogPlugin {
  id: string;
  name: string;
  description: string;
  version?: string;
  surface: PluginSurface;
  distribution: 'bundled' | 'external' | 'local';
  installed: boolean;
  enabled: boolean;
  status?: string;
  featured?: boolean;
  install_ref?: string;
  capabilities: string[];
}

export interface PluginSecurityMeta {
  allow: string[];
  deny: string[];
}

export interface PluginSearchHit {
  name: string;
  description?: string;
  install_ref?: string;
  version?: string;
}

export async function getPlugins(): Promise<{ plugins: CatalogPlugin[]; security: PluginSecurityMeta }> {
  const res = await api.get<{ data: { plugins: CatalogPlugin[]; security: PluginSecurityMeta } }>('/gateway/plugins');
  return res.data;
}

export async function searchPlugins(q: string): Promise<PluginSearchHit[]> {
  const res = await api.get<{ data: { results: PluginSearchHit[] } }>(`/gateway/plugins/search?q=${encodeURIComponent(q)}`);
  return res.data.results ?? [];
}

export async function installPlugin(ref: string, enable = true): Promise<{ op_id: string }> {
  const res = await api.post<{ data: { op_id: string } }>('/gateway/plugins/install', { ref, enable });
  return res.data;
}

export async function uninstallPlugin(name: string): Promise<{ op_id: string }> {
  const res = await api.post<{ data: { op_id: string } }>(`/gateway/plugins/${encodeURIComponent(name)}/uninstall`, {});
  return res.data;
}

export async function enablePlugin(name: string): Promise<void> {
  await api.post(`/gateway/plugins/${encodeURIComponent(name)}/enable`, {});
}

export async function disablePlugin(name: string): Promise<void> {
  await api.post(`/gateway/plugins/${encodeURIComponent(name)}/disable`, {});
}
