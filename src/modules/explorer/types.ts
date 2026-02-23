import type { LucideIcon } from 'lucide-react';
import { HardDrive, Camera, Bot, Monitor, Folder } from 'lucide-react';

export interface SourceRoot {
  id: string;
  label: string;
  icon: LucideIcon;
  basePath: string;
  writable: boolean;
  children?: SourceRoot[];
}

export const SOURCE_ROOTS: SourceRoot[] = [
  { id: 'drive', label: 'Drive', icon: HardDrive, basePath: '/drive/', writable: true },
  { id: 'photos', label: 'Photos', icon: Camera, basePath: '/Photos/', writable: true },
  {
    id: 'gateway', label: 'Gateway', icon: Bot, basePath: '/gateway/', writable: false,
    children: [
      { id: 'gw-workspace', label: 'workspace', icon: Folder, basePath: '/gateway/workspace/', writable: true },
    ],
  },
  { id: 'system', label: 'System', icon: Monitor, basePath: '/', writable: false },
];
