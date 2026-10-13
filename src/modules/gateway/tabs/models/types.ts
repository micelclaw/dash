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

export type View = 'configured' | 'decision' | 'catalog' | 'advanced';
export type CatalogSubView = 'providers' | 'models';

export interface ProviderEntry {
  provider: string;
  label: string;
  color: string;
  modelCount: number;
  configuredCount: number;
  hasAuth: boolean;
  description: string;
  version: string | null;
  authMethodCount: number;
  legacyConfigured: boolean;
  migrationTarget: string | null;
  enabled: boolean;
}
