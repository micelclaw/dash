import type { InstalledApp, AppManifest } from '@/types/apps';
import type { RegistryPackage, PublicRegistryPackage } from '@/services/public-registry.service';

export type AppOrigin = 'Micelclaw' | 'OpenClaw' | 'Tuya' | 'Community';
export const ORIGIN_FILTERS = ['Micelclaw', 'OpenClaw', 'Community'] as const;
export interface CatalogFilters {
  origins: Set<string>; levels: Set<string>; tiers: Set<string>; distinctions: Set<string>;
}

export function appOrigin(app: InstalledApp): AppOrigin | undefined {
  if (app.source === 'adapted' || app.source === 'studio' || app.manifest?.author === 'studio') return 'Tuya';
  if (app.catalog_origin) return app.catalog_origin;
  if (app.source === 'openclaw') return 'OpenClaw';
  const author = app.manifest?.author?.toLowerCase();
  if (author?.startsWith('micelclaw') || app.source === 'micelhub' || app.source === 'local') return 'Micelclaw';
  if (app.catalog_metadata_pending && !author) return undefined;
  return 'Community';
}

/** A downloaded package is inventory, not an installed or activated application. */
export function registryApp(local: RegistryPackage | undefined, entry?: PublicRegistryPackage): InstalledApp {
  const m = local?.manifest ?? {};
  const name = local?.name ?? entry!.name;
  const version = local?.version ?? entry!.version;
  const level = Number(String(local?.level ?? m.app_level ?? entry?.app_level ?? 1).replace(/^L/i, ''));
  const tier = m.tier_required ?? entry?.tier_required;
  // Public editorial labels remain visible after downloading an older manifest.
  // They describe this exact catalogue version, never installation or scan state.
  const tags = [...new Set([
    ...(Array.isArray(m.tags) ? m.tags.filter((v): v is string => typeof v === 'string') : []),
    ...(entry?.tags ?? []),
  ])];
  return {
    id: `registry-${name}-${version}`, app_name: name, version, app_level: level, status: 'available', source: 'registry', install_path: null,
    manifest: {
      ...m, name: entry?.display_name ?? m.name ?? name, version, app_level: level,
      description: local?.description ?? m.description ?? entry?.description ?? '',
      author: m.author ?? entry?.author, tier_required: tier ?? 'free',
      icon: m.icon ?? entry?.icon, icon_kind: m.icon_kind ?? entry?.icon_kind, color: m.color ?? entry?.color,
      min_core_version: m.min_core_version ?? '', skill: m.skill ?? 'SKILL.md', permissions: m.permissions ?? [],
      tags: [...tags, 'registry-available', ...(!local?.claw_file ? ['registry-public'] : [])],
    } as AppManifest,
    catalog_origin: entry?.origin, catalog_metadata_pending: !tier,
    catalog_keywords: entry?.keywords ?? [],
    forked_from: null, installed_by: null, installed_at: '', updated_at: '',
  };
}

export function matchesCatalog(app: InstalledApp, query: string, filters: CatalogFilters, exact?: {name:string;version:string} | null): boolean {
  if (exact) return app.app_name === exact.name && app.version === exact.version;
  const q = query.trim().toLocaleLowerCase();
  if (q && ![app.app_name, app.manifest?.name, app.manifest?.description, ...(app.catalog_keywords ?? [])].some(value => value?.toLocaleLowerCase().includes(q))) return false;
  const appSource = appOrigin(app);
  const origin = appSource === 'Tuya' ? 'Community' : appSource;
  if (origin ? filters.origins.size && !filters.origins.has(origin) : filters.origins.size > 0 && filters.origins.size < ORIGIN_FILTERS.length) return false;
  if (filters.levels.size && !filters.levels.has(`L${app.app_level}`)) return false;
  if (!app.catalog_metadata_pending) {
    const tier = app.manifest?.tier_required;
    if (filters.tiers.size && !filters.tiers.has(tier === 'pro' ? 'Pro' : tier === 'plus' ? 'Plus' : 'Free')) return false;
  } else if (filters.tiers.size > 0 && filters.tiers.size < 3) return false;
  const tags = app.manifest?.tags ?? [];
  if (filters.distinctions.has('Verified') && !tags.includes('verified')) return false;
  if (filters.distinctions.has('Featured') && !tags.includes('featured')) return false;
  return true;
}
