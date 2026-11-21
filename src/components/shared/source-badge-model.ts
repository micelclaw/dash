import type { DataTypeId } from '@/config/data-types';
import { distinctOriginProviders, originDescription, type EntityOrigin } from '@/types/origins';

/** Same origin resolution in the ordinary Dash and in isolated, asset-free MCP Apps. */
export function sourceBadgeModel(origins?: EntityOrigin[], source?: string | null, domain?: DataTypeId) {
 const known = origins?.length ? origins : source === 'local' || domain === 'photos' && source === 'scan'
  ? [{ provider_slug: 'micelclaw', label: 'Micelclaw' }] : [{ provider_slug: null, label: source || 'Fuente desconocida' }];
 return { known, groups: distinctOriginProviders(known), description: known.map(originDescription).join(' / ') };
}
