import { MODULES } from '@/config/modules';
import type { ModuleConfig } from '@/types/modules';
import { hasMessage, translate, type Locale } from './core';

const isBuiltIn = (module: ModuleConfig): boolean => MODULES.some((entry) => entry.id === module.id && entry.path === module.path && entry.label === module.label);

export function moduleLabel(module: ModuleConfig, locale: Locale): string {
  const key = `module.${module.id}`;
  return isBuiltIn(module) && hasMessage(key) ? translate(locale, key) : module.label;
}

export function moduleGroupLabel(name: string, locale: Locale, modules: ModuleConfig[]): string {
  const key = `moduleGroup.${name}`;
  return modules.length > 0 && modules.every(isBuiltIn) && hasMessage(key) ? translate(locale, key) : name;
}
