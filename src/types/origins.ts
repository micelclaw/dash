/** Read-only presentation metadata from Core; never a synchronization identity. */
export interface EntityOrigin {
  provider_slug: string | null;
  label: string;
  connection_label?: string;
}
export interface OriginEntity { origins?: EntityOrigin[] }
export interface OriginPhoto extends OriginEntity { id: string }

export function originDescription(origin: EntityOrigin): string {
  return [origin.label, origin.connection_label].filter(Boolean).join(' · ');
}
export function distinctOriginProviders(origins: EntityOrigin[]): EntityOrigin[][] {
  const groups = new Map<string, EntityOrigin[]>();
  for (const origin of origins) {
    // Two unknown protocols are still different sources.
    const key = origin.provider_slug ?? `unknown:${origin.label}`;
    groups.set(key, [...(groups.get(key) ?? []), origin]);
  }
  return [...groups.values()];
}
