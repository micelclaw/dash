import { siGithub, siGoogledrive } from 'simple-icons';
import { Plug } from 'lucide-react';
import { DataProviderIcon, DataServiceIcon } from '@/config/data-provider-icons';
import slackLogo from './slack.png';

type Props = { slug?: string; name?: string; size?: number };
function Logo({ slug, name, size = 28 }: Props) {
  if (slug === 'gmail') return <DataServiceIcon providerSlug="google" domain="mail" size={size} />;
  if (slug === 'google-calendar') return <DataServiceIcon providerSlug="google" domain="calendar" size={size} />;
  if (slug === 'notion') return <DataProviderIcon slug="notion" size={size} />;
  if (slug === 'slack') return <img src={slackLogo} alt="" width={size} height={size} className="object-contain" />;
  const icon = slug === 'github' ? siGithub : slug === 'google-drive' ? siGoogledrive : undefined;
  if (icon) return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24"><path d={icon.path} fill={slug === 'github' ? 'currentColor' : `#${icon.hex}`} /></svg>;
  if (!name) return <Plug size={size} aria-hidden />;
  return <span aria-hidden className="flex shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-dim)]" style={{ width: size, height: size }}>{name.trim().slice(0, 1).toUpperCase()}</span>;
}
export function BrandLogo(props: Props) { return <span aria-hidden className="inline-flex shrink-0 items-center justify-center"><Logo {...props} /></span>; }
