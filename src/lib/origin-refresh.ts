/** UI-only invalidation. No provider requests and no changes to entity identity. */
export interface OriginRefreshSignal { domains?: string[]; connectorId?: string }
const listeners = new Set<(signal: OriginRefreshSignal) => void>();
export function notifyOriginsChanged(signal: OriginRefreshSignal = {}) {
  for (const listener of listeners) listener(signal);
}
export function subscribeOriginRefresh(listener: (signal: OriginRefreshSignal) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function syncAffectsDomain(data: Record<string, unknown>, domains: string[], connectorIds?: string[]) {
  if (data.cancelled || typeof data.connector_id !== 'string') return false;
  if (connectorIds?.length && !connectorIds.includes(data.connector_id)) return false;
  const breakdown = data.domain_breakdown;
  if (!breakdown || typeof breakdown !== 'object') return false;
  return domains.some(domain => {
    const counts = (breakdown as Record<string, unknown>)[domain];
    return typeof counts === 'number' ? counts > 0 : !!counts && typeof counts === 'object'
      && Object.values(counts).some(value => typeof value === 'number' && value > 0);
  });
}
