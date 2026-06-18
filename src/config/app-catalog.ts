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

// ─── Catálogo de apps (SSOT espejo del core) — rediseño NAS, Fase 1 ──
// Mismo contenido que core/src/config/app-catalog.ts. El dash lo usa para la
// pestaña "Aplicaciones" (matriz de permisos) y para razonar sobre tiers.
// El gating real de visibilidad lo hace use-app-access (GET /me/app-access).

export type AppTier = 'default' | 'opt_in' | 'admin';

export interface AppCatalogEntry {
  key: string;
  label: string;
  group: string | null;
  tier: AppTier;
}

export const APP_CATALOG: AppCatalogEntry[] = [
  // DEFAULT
  { key: 'chat', label: 'AI Chat', group: null, tier: 'default' },
  { key: 'agents', label: 'Agents', group: null, tier: 'default' },
  { key: 'micelhub', label: 'MicelHub', group: null, tier: 'default' },
  { key: 'search', label: 'Search', group: null, tier: 'default' },
  { key: 'notes', label: 'Notes', group: 'Productivity', tier: 'default' },
  { key: 'calendar', label: 'Calendar', group: 'Productivity', tier: 'default' },
  { key: 'mail', label: 'Mail', group: 'Productivity', tier: 'default' },
  { key: 'contacts', label: 'Contacts', group: 'Productivity', tier: 'default' },
  { key: 'bookmarks', label: 'Bookmarks', group: 'Productivity', tier: 'default' },
  { key: 'tools', label: 'Tools', group: 'Productivity', tier: 'default' },
  { key: 'drive', label: 'Drive', group: 'Files', tier: 'default' },
  { key: 'explorer', label: 'File Explorer', group: 'Files', tier: 'default' },
  { key: 'messages', label: 'Messages', group: 'Social', tier: 'default' },
  { key: 'settings', label: 'Settings', group: 'System', tier: 'default' },
  // OPT-IN
  { key: 'photos', label: 'Photos', group: 'Multimedia', tier: 'opt_in' },
  { key: 'video', label: 'Video', group: 'Multimedia', tier: 'opt_in' },
  { key: 'music', label: 'Music', group: 'Multimedia', tier: 'opt_in' },
  { key: 'books', label: 'Books', group: 'Multimedia', tier: 'opt_in' },
  { key: 'diary', label: 'Diary', group: 'Productivity', tier: 'opt_in' },
  { key: 'sketches', label: 'Sketches', group: 'Productivity', tier: 'opt_in' },
  { key: 'projects', label: 'Projects', group: 'Productivity', tier: 'opt_in' },
  { key: 'inventory', label: 'Inventory', group: 'Productivity', tier: 'opt_in' },
  { key: 'office', label: 'Office', group: 'Productivity', tier: 'opt_in' },
  { key: 'firefly', label: 'Firefly III', group: 'Finance', tier: 'opt_in' },
  { key: 'solidinvoice', label: 'SolidInvoice', group: 'Finance', tier: 'opt_in' },
  { key: 'crypto', label: 'Crypto Stack', group: 'Finance', tier: 'opt_in' },
  { key: 'feeds', label: 'Feeds', group: 'Social', tier: 'opt_in' },
  { key: 'flows', label: 'Flows', group: null, tier: 'opt_in' },
  { key: 'studio', label: 'Studio', group: null, tier: 'opt_in' },
  // ADMIN-ONLY
  { key: 'gateway', label: 'Gateway', group: null, tier: 'admin' },
  { key: 'multimedia', label: 'Servarr', group: 'Multimedia', tier: 'admin' },
  { key: 'vpn', label: 'VPN', group: 'Network', tier: 'admin' },
  { key: 'proxy', label: 'Reverse Proxy', group: 'Network', tier: 'admin' },
  { key: 'dns', label: 'DNS', group: 'Network', tier: 'admin' },
  { key: 'portainer', label: 'Portainer', group: 'Network', tier: 'admin' },
  { key: 'mail-server', label: 'Mail Server', group: 'System', tier: 'admin' },
  { key: 'terminal', label: 'Terminal', group: 'System', tier: 'admin' },
  { key: 'storage', label: 'Storage', group: 'System', tier: 'admin' },
  { key: 'processes', label: 'Processes', group: 'System', tier: 'admin' },
  { key: 'activity', label: 'Activity Center', group: 'System', tier: 'admin' },
];

export const OPT_IN_APPS: AppCatalogEntry[] = APP_CATALOG.filter((a) => a.tier === 'opt_in');
export const DEFAULT_APP_KEYS: string[] = APP_CATALOG.filter((a) => a.tier === 'default').map((a) => a.key);
export const ADMIN_APP_KEYS: string[] = APP_CATALOG.filter((a) => a.tier === 'admin').map((a) => a.key);
