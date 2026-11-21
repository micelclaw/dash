import { Download, Loader2, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import type { InstalledApp } from '@/types/apps';

export type CatalogView = 'registry' | 'available' | 'installed';

/** The page owns mutations; every surface renders the same contextual action. */
export interface AppPrimaryAction {
  onClick(): void | Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  statusText?: string;
  progress?: number | null;
  title?: string;
  error?: string;
  registryState?: 'public' | 'downloaded' | 'installed';
}

export const LEVEL_COLORS: Record<number, string> = {
  1: 'var(--text-dim)', 2: '#3b82f6', 3: '#a855f7',
};
const ORIGIN_COLORS: Record<string, string> = {
  Micelclaw: '#06b6d4', OpenClaw: '#be4562', Tuya: '#f59e0b', Community: '#94a3b8',
};
const PLAN_COLORS: Record<string, string> = {
  free: '#22c55e', pro: 'var(--amber)', plus: '#3b82f6',
};

export function AppLevelBadge({ level }: { level: number }) {
  const color = LEVEL_COLORS[level];
  return color ? <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]" style={{ color, borderColor: color }}>L{level}</Badge> : null;
}

function AppTag({ children, color }: { children: React.ReactNode; color: string }) {
  return <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] leading-none" style={{ color, borderColor: 'var(--border)', background: 'var(--surface)' }}>{children}</Badge>;
}

export function AppBadges({ app, origin, showLevel = false, showOrigin = true, showPlan = true, showDistinctions = true }: {
  app: InstalledApp;
  origin?: string;
  showLevel?: boolean;
  showOrigin?: boolean;
  showPlan?: boolean;
  showDistinctions?: boolean;
}) {
  const { t } = useI18n();
  const plan = app.catalog_metadata_pending ? undefined : app.manifest?.tier_required;
  const tags = app.manifest?.tags ?? [];
  return <div className="flex min-w-0 flex-wrap items-center gap-1">
    {showLevel && <AppLevelBadge level={app.app_level} />}
    {showOrigin && origin && <AppTag color={ORIGIN_COLORS[origin] ?? 'var(--text-dim)'}>{origin}</AppTag>}
    {showPlan && plan && PLAN_COLORS[plan] && <AppTag color={PLAN_COLORS[plan]}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</AppTag>}
    {showDistinctions && tags.includes('verified') && <AppTag color="#22c55e">✓ {t('micelhub.verified')}</AppTag>}
    {showDistinctions && tags.includes('featured') && <AppTag color="var(--amber)">{t('micelhub.featured')}</AppTag>}
    {showDistinctions && app.status === 'error' && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{t('micelhub.error')}</Badge>}
  </div>;
}

export function formatAppSize(bytes: number): string {
  const format = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  if (bytes < 1024) return `${format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${format(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${format(bytes / (1024 * 1024))} MB`;
  return `${format(bytes / (1024 * 1024 * 1024))} GB`;
}

export function InstallationSize({ app }: { app: InstalledApp }) {
  const { t } = useI18n();
  const bytes = app.installation_size_bytes;
  const known = typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0;
  const text = known ? formatAppSize(bytes) : '—';
  return <span
    className="shrink-0 tabular-nums"
    data-installation-size={known ? bytes : 'unknown'}
    title={t(known ? 'micelhub.installationSizeHint' : 'micelhub.sizeUnknown')}
    aria-label={`${t('micelhub.size')}: ${known ? text : t('micelhub.sizeUnknown')}`}
  >{text}</span>;
}

export function AppActionProgress({ action }: { action?: AppPrimaryAction }) {
  const { t } = useI18n();
  if (!action) return null;
  const progress = typeof action.progress === 'number' && Number.isFinite(action.progress)
    ? Math.min(100, Math.max(0, action.progress)) : undefined;
  return <>
    {action.busy && <div className="w-full space-y-1.5" role="status">
      {action.statusText && <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-dim)]"><span>{action.statusText}</span>{progress !== undefined && <span className="tabular-nums">{Math.round(progress)}%</span>}</div>}
      <div role="progressbar" aria-label={action.statusText || action.label || t('micelhub.workingOn')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className={`h-full rounded-full bg-[var(--amber)] transition-[width] ${progress === undefined ? 'w-2/5 animate-pulse' : ''}`} style={progress === undefined ? undefined : { width: `${progress}%` }} />
      </div>
    </div>}
    {!action.busy && action.statusText && <span className="text-xs text-[var(--text-dim)]">{action.statusText}</span>}
    {action.error && <p role="alert" className="text-xs text-[var(--error)]">{action.error}</p>}
  </>;
}

export function AppCatalogAction({ view, action }: { view: CatalogView; action?: AppPrimaryAction }) {
  const { t } = useI18n();
  if (!action) return null;
  const label = action.label ?? t(view === 'registry' ? 'micelhub.download' : view === 'available' ? 'micelhub.install' : 'micelhub.uninstall');
  const Icon = view === 'registry' ? Download : Power;
  return <Button size="sm" variant="outline" disabled={action.busy || action.disabled} title={action.title} aria-busy={action.busy || undefined}
    className={view === 'installed' ? 'text-[var(--warning)]' : ''}
    onClick={(event) => { event.stopPropagation(); void action.onClick(); }}>
    {action.busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}{label}
  </Button>;
}
