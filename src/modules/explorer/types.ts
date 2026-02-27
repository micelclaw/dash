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
