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

import {RefreshCw,Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/i18n';
import {AppCard} from './AppCard';
import {AppListHeader,AppListRow} from './AppListRow';
import type {AppPrimaryAction} from './AppCatalogPresentation';
import {appOrigin} from './catalog';
import type {InstalledApp} from '@/types/apps';

interface RegistryBrowserProps {
  apps: InstalledApp[];
  onSelect(app: InstalledApp): void;
  selectedId: string | null;
  onRefresh(): void;
  getAction(app: InstalledApp): AppPrimaryAction;
  viewMode: 'grid' | 'list';
  loading: boolean;
  error: string | null;
  hasQuery: boolean;
}

/** The public catalogue has one source; downloaded inventory lives in Available. */
export function RegistryBrowser({apps,onSelect,selectedId,onRefresh,getAction,viewMode,loading,error,hasQuery}:RegistryBrowserProps) {
  const {t}=useI18n();
  return <section className="space-y-4 p-4" aria-label={t('micelhub.registry')}>
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1"><h2 className="text-sm font-semibold text-[var(--text)]">{t('micelhub.registry')} <span className="text-[var(--text-dim)]">({apps.length})</span></h2><p className="text-xs text-[var(--text-dim)]">{t('micelhub.registryDescription')}</p></div>
      <Button variant="outline" size="sm" disabled={loading} onClick={onRefresh}><RefreshCw size={13}/>{t('micelhub.registryRefresh')}</Button>
    </div>
    {loading&&<p role="status" className="flex items-center gap-2 text-sm text-[var(--text-dim)]"><Loader2 size={14} className="animate-spin"/>{t('micelhub.registryLoading')}</p>}
    {error&&<div role="alert" className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm"><p>{t('micelhub.registryOffline')}</p><Button variant="outline" size="sm" onClick={onRefresh}>{t('micelhub.retry')}</Button></div>}
    {!loading&&!error&&!apps.length&&<p className="p-8 text-center text-sm text-[var(--text-dim)]">{t(hasQuery?'micelhub.noSearchResults':'micelhub.registryEmpty')}</p>}
    {viewMode==='list'?<><AppListHeader catalogView="registry"/>{apps.map(app=><AppListRow key={app.id} app={app} origin={appOrigin(app)} catalogView="registry" primaryAction={getAction(app)} selected={app.id===selectedId} onClick={()=>onSelect(app)}/>)}</>
      :<div className="grid gap-3" style={{gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,280px),1fr))'}}>{apps.map(app=><AppCard key={app.id} app={app} origin={appOrigin(app)} catalogView="registry" primaryAction={getAction(app)} selected={app.id===selectedId} onClick={()=>onSelect(app)}/>)}</div>}
  </section>;
}
