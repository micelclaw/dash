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

import type { LucideIcon } from 'lucide-react';

export interface ModuleConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  path: string | null;
  group: string | null;
  /** Solo visible para owner/admin (infraestructura del sistema). Fase 0 del
   *  rediseño NAS; la Fase 1 añade además el gating per-usuario por app-access. */
  adminOnly?: boolean;
}
