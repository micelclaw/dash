/** Copyright (c) 2026 Micelclaw (Víctor García Valdunciel). All rights reserved. */
import { AppIcon, resolveManifestIcon } from '@/components/shared/AppIcon';
import type { InstalledApp } from '@/types/apps';
import { useI18n } from '@/i18n';
import { AppActionProgress, AppBadges, AppCatalogAction, AppLevelBadge, InstallationSize, type AppPrimaryAction, type CatalogView } from './AppCatalogPresentation';

interface AppCardProps {
  app: InstalledApp;
  origin?: string;
  selected?: boolean;
  onClick: () => void;
  onRefresh?: () => void;
  catalogView?: CatalogView;
  primaryAction?: AppPrimaryAction;
}

export function AppCard({ app, origin, selected, onClick, catalogView = app.status === 'active' ? 'installed' : 'available', primaryAction }: AppCardProps) {
  const { t } = useI18n();
  const manifest = app.manifest;
  const name = manifest?.name || app.app_name;
  const registryState = primaryAction?.registryState ?? 'public';
  const dotColor = catalogView === 'registry'
    ? registryState === 'installed' ? 'var(--success, #22c55e)' : registryState === 'downloaded' ? 'var(--amber)' : 'var(--text-muted)'
    : app.status === 'error' || manifest?.tags?.includes('unsupported') ? 'var(--error)'
    : manifest?.tags?.includes('needs-setup') ? 'var(--amber)'
    : catalogView === 'installed' ? 'var(--success, #22c55e)' : 'var(--text-muted)';

  return <article aria-label={name} data-app-name={app.app_name} data-app-version={app.version} data-catalog-view={catalogView}
    className="group flex min-w-0 flex-col rounded-[var(--radius-lg)] border bg-[var(--card)] transition-colors hover:border-[var(--border-hover)] focus-within:border-[var(--amber)]"
    style={{ borderColor: selected ? 'var(--amber)' : 'var(--border)' }}>
    <button type="button" onClick={onClick} aria-pressed={!!selected}
      className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-t-[var(--radius-lg)] p-3.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]">
      <span className="flex w-full min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} aria-hidden="true" data-registry-state={catalogView === 'registry' ? registryState : undefined} />
        <span className="inline-flex shrink-0"><AppIcon {...resolveManifestIcon(manifest)} size={23} /></span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]" title={name}>{name}</span>
        <AppLevelBadge level={app.app_level} />
      </span>
      <AppBadges app={app} origin={origin} />
      <span className="line-clamp-2 min-h-[2.8em] text-xs leading-[1.4] text-[var(--text-dim)]">{manifest?.description || t('micelhub.noDescription')}</span>
      <span className="mt-auto flex w-full min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
        <span className="shrink-0">v{app.version}</span>
        {manifest?.author && <><span aria-hidden="true">·</span><span className="min-w-0 truncate">{manifest.author}</span></>}
        {catalogView === 'installed' && <span className="ml-auto"><InstallationSize app={app} /></span>}
      </span>
    </button>
    {primaryAction && <div className="mx-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] py-2.5">
      <AppActionProgress action={primaryAction} />
      <AppCatalogAction view={catalogView} action={primaryAction} />
    </div>}
  </article>;
}
