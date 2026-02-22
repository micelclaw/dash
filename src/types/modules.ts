import type { LucideIcon } from 'lucide-react';

export interface ModuleConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  path: string | null;
  group: string | null;
}
