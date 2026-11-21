import type { ReactNode } from 'react';
import { Code2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useI18n } from '@/i18n';
import type { OfficeProvider } from './office-providers.service';

const notices = 'https://github.com/micelclaw/registry/blob/main/LICENSING.md';

function sourceLink(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

/** The installed provider supplies the exact modified-source URL, not its name. */
export function OfficeSourceOffer({ provider, children }: { provider?: OfficeProvider; children?: ReactNode }) {
  const { t } = useI18n();
  const source = sourceLink(provider?.source_url);
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" title={t('office.licenses.title')} aria-label={t('office.licenses.title')} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--surface-hover)]" style={{ color: 'var(--text)' }}>
        {children ?? <><Code2 size={14} aria-hidden="true" />{t('office.licenses.title')}</>}
      </button>
    </DialogTrigger>
    <DialogContent>
      <DialogTitle>{t('office.licenses.title')}</DialogTitle>
      <DialogDescription className="mt-2 text-sm" style={{ color: 'var(--text-dim)' }}>
        {provider ? `${provider.app_name} · ${provider.version} · ${provider.license}` : t('office.licenses.unavailable')}
      </DialogDescription>
      <div className="mt-4 flex flex-col items-start gap-3 text-sm">
        {source && <a href={source} target="_blank" rel="noopener noreferrer" className="underline">{t('office.licenses.source')}</a>}
        <a href={notices} target="_blank" rel="noopener noreferrer" className="underline">{t('office.licenses.notices')}</a>
      </div>
    </DialogContent>
  </Dialog>;
}
