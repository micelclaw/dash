/** Copyright (c) 2026 Micelclaw (Víctor García Valdunciel). All rights reserved. */
import type { CSSProperties } from 'react';
import { AppIcon, resolveManifestIcon } from '@/components/shared/AppIcon';
import type { InstalledApp } from '@/types/apps';
import { useI18n } from '@/i18n';
import { AppActionProgress, AppBadges, AppCatalogAction, AppLevelBadge, InstallationSize, type AppPrimaryAction, type CatalogView } from './AppCatalogPresentation';

// Shared column template keeps headings and rows aligned in every catalogue.
export const LIST_GRID = 'minmax(170px,1.5fr) minmax(150px,2fr) 48px 96px 60px minmax(112px,max-content)';

interface AppListRowProps {
  app: InstalledApp;
  origin?: string;
  selected?: boolean;
  onClick: () => void;
  onRefresh?: () => void;
  catalogView?: CatalogView;
  primaryAction?: AppPrimaryAction;
}

export function AppListHeader({ catalogView }: { catalogView?: CatalogView } = {}) {
  const { t } = useI18n();
  return <div data-catalog-view={catalogView} className="sticky top-0 z-[1] hidden items-center gap-2.5 border-b border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] min-[769px]:grid" style={{ gridTemplateColumns: LIST_GRID }}>
    <span>{t('micelhub.appColumn')}</span><span>{t('micelhub.descriptionColumn')}</span><span>{t('micelhub.level')}</span><span>{t('micelhub.origin')}</span><span>{t('micelhub.tier')}</span><span className="text-right">{t('micelhub.actions')}</span>
  </div>;
}

export function AppListRow({ app, origin, selected, onClick, catalogView = app.status === 'active' ? 'installed' : 'available', primaryAction }: AppListRowProps) {
  const name = app.manifest?.name || app.app_name;
  return <article aria-label={name} data-app-name={app.app_name} data-app-version={app.version} data-catalog-view={catalogView}
    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3 text-xs transition-colors hover:bg-[var(--surface)] min-[769px]:grid-cols-[var(--app-list-columns)]"
    style={{ '--app-list-columns': LIST_GRID, background: selected ? 'var(--surface-hover)' : undefined } as CSSProperties}>
    <button type="button" onClick={onClick} aria-pressed={!!selected} className="col-start-1 row-start-1 flex min-w-0 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] min-[769px]:col-auto min-[769px]:row-auto">
      <span className="mt-0.5 inline-flex shrink-0"><AppIcon {...resolveManifestIcon(app.manifest)} size={20} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[13px] font-semibold text-[var(--text)]" title={name}>{name}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-dim)]"><span>v{app.version}</span>{catalogView === 'installed' && <InstallationSize app={app} />}</span>
        <AppBadges app={app} showOrigin={false} showPlan={false} />
      </span>
    </button>
    <button type="button" onClick={onClick} className="col-span-2 row-start-2 line-clamp-2 min-w-0 break-words text-left leading-relaxed text-[var(--text-dim)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] min-[769px]:col-span-1 min-[769px]:row-auto">{app.manifest?.description || '—'}</button>
    <div className="col-span-2 row-start-3 flex min-w-0 flex-wrap items-center gap-2 min-[769px]:contents">
      <AppLevelBadge level={app.app_level} />
      <AppBadges app={app} origin={origin} showPlan={false} showDistinctions={false} />
      <AppBadges app={app} showOrigin={false} showDistinctions={false} />
    </div>
    <div className="col-start-2 row-start-1 flex min-w-0 max-w-[45vw] flex-col items-end gap-2 min-[769px]:col-auto min-[769px]:row-auto min-[769px]:max-w-none"><AppActionProgress action={primaryAction} /><AppCatalogAction view={catalogView} action={primaryAction} /></div>
  </article>;
}
