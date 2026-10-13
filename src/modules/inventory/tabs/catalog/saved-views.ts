import type { ItemFilters } from '@/stores/inventory.store';
import type { SortDir, SortKey } from './sorting';

export const MAX_CATALOG_VIEWS_PER_PROFILE = 20;

export interface CatalogSavedView {
  id: string;
  profile_id: string;
  name: string;
  filters: ItemFilters;
  view: 'grid' | 'list';
  sort_key: SortKey | null;
  sort_dir: SortDir;
  assets_only: boolean;
}

export type CatalogViewSnapshot = Omit<CatalogSavedView, 'id' | 'profile_id' | 'name'>;

export function viewsForProfile(views: readonly CatalogSavedView[], profileId: string): CatalogSavedView[] {
  return views.filter(view => view.profile_id === profileId);
}

export function addCatalogView(
  views: readonly CatalogSavedView[],
  profileId: string,
  name: string,
  snapshot: CatalogViewSnapshot,
  id: string = crypto.randomUUID(),
): CatalogSavedView[] {
  const cleanName = name.trim();
  if (cleanName.length < 1 || cleanName.length > 40) throw new Error('View name must be 1–40 characters');
  if (viewsForProfile(views, profileId).length >= MAX_CATALOG_VIEWS_PER_PROFILE) {
    throw new Error(`A profile can have at most ${MAX_CATALOG_VIEWS_PER_PROFILE} saved views`);
  }
  return [...views, { id, profile_id: profileId, name: cleanName, ...snapshot }];
}

export function removeCatalogView(
  views: readonly CatalogSavedView[], profileId: string, viewId: string,
): CatalogSavedView[] {
  return views.filter(view => view.id !== viewId || view.profile_id !== profileId);
}
