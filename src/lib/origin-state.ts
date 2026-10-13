import type { OriginEntity } from '@/types/origins';
const IDENTITY_FIELDS = ['source', 'source_id', 'connector_id', 'account_id'] as const;
/** Content/flags do not change provenance. Task connector references do. */
export function originIdentityChanged(previous: object, changes: Record<string, unknown>) {
  const record = previous as Record<string, unknown>;
  if (IDENTITY_FIELDS.some(key => key in changes && changes[key] !== record[key])) return true;
  if ('external_payload' in changes) {
    const keys = (payload: unknown) => payload && typeof payload === 'object' ? Object.keys(payload).sort().join(',') : '';
    return keys(record.external_payload) !== keys(changes.external_payload);
  }
  return false;
}
export function mergeOriginUpdate<T extends object>(previous: T, changes: Record<string, unknown>): T {
  const oldOrigins = (previous as OriginEntity).origins;
  return { ...previous, ...changes,
    origins: changes.origins ?? (originIdentityChanged(previous, changes) ? undefined : oldOrigins) };
}
