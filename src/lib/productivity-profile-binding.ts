export interface ProductivityProfileSnapshot { userId: string | null; sessionGeneration: number; profileId: string | null }
/** No retries, effects or ambient settings: notify Core only for the still-current human selection. */
export async function bindProductivityProfiles(input: {
 snapshot: ProductivityProfileSnapshot; current(): ProductivityProfileSnapshot; conversations: string[]; signal: AbortSignal;
 status(): Promise<{ profile_binding_supported?: boolean }>;
 select(conversationId: string): Promise<unknown>;
}): Promise<'bound' | 'unsupported' | 'superseded' | 'unavailable'> {
 const current = () => {
  const now = input.current(), before = input.snapshot;
  return !input.signal.aborted && !!before.userId && before.userId === now.userId && before.sessionGeneration === now.sessionGeneration && before.profileId === now.profileId;
 };
 if (!current()) return 'superseded';
 try {
  const supported = await input.status(); if (!current()) return 'superseded';
  if (!supported.profile_binding_supported) return 'unsupported';
  const conversations = [...new Set(input.conversations)].filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const outcomes = await Promise.allSettled(conversations.map(async id => { if (!current()) throw Error('superseded'); await input.select(id); }));
  if (!current()) return 'superseded';
  return outcomes.every(result => result.status === 'fulfilled') ? 'bound' : 'unavailable';
 } catch { return current() ? 'unavailable' : 'superseded'; }
}
