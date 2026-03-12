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
import { HardDrive, Camera, Bot, Monitor } from 'lucide-react';

export type UserRole = 'owner' | 'admin' | 'user';

export interface SourceRoot {
  id: string;
  label: string;
  icon: LucideIcon;
  basePath: string;
  writable: boolean;
  children?: SourceRoot[];
  requiredRoles?: UserRole[];
}

export const SOURCE_ROOTS: SourceRoot[] = [
  { id: 'drive', label: 'Drive', icon: HardDrive, basePath: '/drive/', writable: true },
  { id: 'photos', label: 'Photos', icon: Camera, basePath: '/Photos/', writable: true },
  { id: 'gateway', label: 'Gateway', icon: Bot, basePath: '/gateway/', writable: false, requiredRoles: ['owner', 'admin'] },
  { id: 'system', label: 'System', icon: Monitor, basePath: '/system/', writable: false, requiredRoles: ['owner'] },
];
