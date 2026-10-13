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

import { Globe } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataProviderIcon, DataServiceIcon, type DataServiceDomain } from '@/config/data-provider-icons';
import type { DataTypeId } from '@/config/data-types';
import { distinctOriginProviders, originDescription, type EntityOrigin, type OriginEntity } from '@/types/origins';

interface SourceBadgeProps {
  origins?: EntityOrigin[];
  /** Compatibility with old Core: only explicit local/scan sources identify Micelclaw. */
  source?: string | null;
  domain?: DataTypeId;
  size?: 'sm' | 'md' | 'xs';
  detail?: boolean;
}
const SERVICE_DOMAINS = new Set<DataTypeId>(['mail', 'calendar', 'contacts', 'tasks']);

function OriginIcon({ origin, domain, size }: { origin: EntityOrigin; domain?: DataTypeId; size: number }) {
  if (origin.provider_slug === 'micelclaw') return <img src="/logo.svg" alt="" width={size} height={size} style={{ objectFit: 'contain' }} />;
  if (!origin.provider_slug) return <Globe size={size} />;
  return domain && SERVICE_DOMAINS.has(domain)
    ? <DataServiceIcon providerSlug={origin.provider_slug} domain={domain as DataServiceDomain} size={size} style={{ maxWidth: '100%', maxHeight: '100%' }} />
    : <DataProviderIcon slug={origin.provider_slug} size={size} style={{ maxWidth: '100%', maxHeight: '100%' }} />;
}

export function SourceBadge({ origins, source, domain, size = 'sm', detail = false }: SourceBadgeProps) {
  const known = origins?.length ? origins : source === 'local' || (domain === 'photos' && source === 'scan')
    ? [{ provider_slug: 'micelclaw', label: 'Micelclaw' }]
    : [{ provider_slug: null, label: source || 'Fuente desconocida' }];
  const groups = distinctOriginProviders(known);
  const description = known.map(originDescription).join(' / ');
  const iconSize = size === 'xs' ? 12 : 14;
  const full = detail || size === 'md';
  const content = (
    <span role={full ? 'group' : 'img'} aria-label={`Fuente: ${description}`} title={description}
      data-source-badge data-source-provider={known[0]?.provider_slug ?? 'unknown'}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, gap: 4,
        color: 'var(--text-dim)', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)', lineHeight: 1.3 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: iconSize, height: iconSize, flexShrink: 0 }}>
        <OriginIcon origin={known[0]!} domain={domain} size={iconSize} />
      </span>
      {full ? <span>{description}</span> : groups.length > 1 ? <span>+{groups.length - 1}</span> : null}
    </span>
  );
  return <Tooltip><TooltipTrigger asChild>{content}</TooltipTrigger><TooltipContent>{description}</TooltipContent></Tooltip>;
}

/** Shared adapter for every domain; no requests or mutable state in the badge. */
export function EntitySource({ entity, native = false, ...props }: Omit<SourceBadgeProps, 'origins' | 'source'> & {
  entity?: OriginEntity & { source?: string | null }; native?: boolean;
}) {
  return <SourceBadge {...props} origins={entity?.origins} source={entity?.source ?? (native ? 'local' : undefined)} />;
}

/** Consistent permanent overlay, away from photo selection/favorite controls. */
export function PhotoSource({ entity }: { entity?: OriginEntity & { source?: string | null } }) {
  return <span style={{ position: 'absolute', bottom: 4, right: 4, display: 'inline-flex',
    padding: '3px 4px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.65)', zIndex: 2 }}>
    <EntitySource entity={entity} domain="photos" />
  </span>;
}
