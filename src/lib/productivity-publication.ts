import { useChatWorkspaceStore } from '../stores/chat-workspace.store';
import { parseProductivityContext, parseProductivityTabReference } from '../modules/chat/mcp-apps/productivity/reference';
import type { ProductivityTabReference } from '../modules/chat/mcp-apps/productivity/reference';

/** Reset, close and history revalidation retire pending launches before React's passive cleanup runs. */
export function isProductivityLaunchCurrent(chat: string, reference: ProductivityTabReference, epoch: number, viewEpoch: number) {
 const workspace = useChatWorkspaceStore.getState().byConversation[chat];
 const resource = workspace?.resources[reference.resource_id];
 return !!workspace && !workspace.revoked && workspace.epoch === epoch && workspace.openIds.includes(reference.resource_id)
  && resource?.kind === 'productivity' && resource.reference.id === reference.id && (resource.viewEpoch ?? 0) === viewEpoch;
}

/** Live overrides a stale history read only until its own durable record has caught up. */
export function productivityHistoryPreviews(chat: string, messages: ReadonlyArray<{ role: string; message_metadata?: Record<string, unknown> }>, live: Map<string, string>): unknown[] {
 const refs = new Map<string, unknown>(); const confirmed = new Set<string>();
 for (const message of messages) if (message.role === 'assistant' && Array.isArray(message.message_metadata?.productivity_previews)) for (const raw of message.message_metadata.productivity_previews) {
  const ref = parseProductivityTabReference(raw, chat);
  if (ref) { refs.set(ref.resource_id, raw); confirmed.add(ref.id); }
 }
 return [...refs].flatMap(([key, raw]) => {
  const ref = parseProductivityTabReference(raw, chat)!; const liveKey = `${chat}:${key}`; const newer = live.get(liveKey);
  if (newer && newer !== ref.id && !confirmed.has(newer)) return [];
  if (newer && confirmed.has(newer)) live.delete(liveKey);
  return [raw];
 });
}

/** A descriptor from another ERP profile remains an inert history lookup, never an automatic opening. */
export function publishProductivity(chat: string, raw: unknown, activeProfileId: string | null) {
 const reference = parseProductivityTabReference(raw, chat); if (!reference) return;
 const context = parseProductivityContext(raw, reference.area);
 if (!context || context.id !== reference.id || context.conversation_id !== chat || context.erp_profile_id !== reference.erp_profile_id) return;
 const store = useChatWorkspaceStore.getState(); if (store.byConversation[chat]?.revoked) return;
 const old = store.byConversation[chat]?.resources[reference.resource_id];
 if (reference.erp_profile_id && reference.erp_profile_id !== activeProfileId) {
  store.upsert(chat, { id: reference.resource_id, title: reference.title, kind: 'productivity', reference, sourceConversationId: chat, view: null }, 'remember');
  return;
 }
 const automatic = !old && !store.byConversation[chat]?.closedIds.includes(reference.resource_id);
 store.upsert(chat, { id: reference.resource_id, title: reference.title, kind: 'productivity', reference, context, sourceConversationId: chat, view: old?.kind === 'productivity' ? old.view : null }, automatic);
}
