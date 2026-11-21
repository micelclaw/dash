import type { OriginEntity } from '@/types/origins';
import { sourceBadgeModel } from './source-badge-model';

/** SourceBadge text surface for the native sandbox: no icon URLs or Vite asset loader. */
export function SourceBadgeText({ entity }: { entity?: OriginEntity & { source?: string | null } }) {
 const model = sourceBadgeModel(entity?.origins, entity?.source);
 return <span role="group" aria-label={`Fuente: ${model.description}`} title={model.description} data-source-badge data-source-provider={model.known[0]?.provider_slug ?? 'unknown'} style={{ color: 'var(--text-dim)', fontSize: 11 }}>{model.description}</span>;
}
