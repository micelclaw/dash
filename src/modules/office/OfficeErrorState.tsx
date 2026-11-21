import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router';
import { useI18n } from '@/i18n';

/** Shared Office opening failure. The real cause remains visible; retry never
 * discards dirty work and navigation stays inside the Office container. */
export function OfficeErrorState({message,title,color,retryDisabled=false,retryLabel,onRetry}: {
  message?: string; title?: string; color?: string; retryDisabled?: boolean; retryLabel?: string; onRetry(): void;
}) {
  const {t}=useI18n();const navigate=useNavigate();
  return <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center" style={{color:'var(--text-dim)'}}>
    <AlertTriangle size={28} aria-hidden="true" style={{color:'var(--error)'}} />
    <p className="text-sm">{title??t('office.error.title')}</p>
    {message&&<p className="max-w-xl text-xs" style={{color:'var(--text-muted)',overflowWrap:'anywhere'}}>{message}</p>}
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={()=>navigate('/office')}>{t('office.router.office')}</Button>
      <Button disabled={retryDisabled} onClick={onRetry} style={{background:color??'var(--accent)',color:'#111827',border:'none'}}>{retryLabel??t('office.external.retry')}</Button>
    </div>
  </div>;
}
