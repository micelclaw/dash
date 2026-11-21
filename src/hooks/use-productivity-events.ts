import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { parseProductivityTabReference } from '@/modules/chat/mcp-apps/productivity/reference';
import { useProfileStore } from '@/stores/profile.store';
import { productivityHistoryPreviews, publishProductivity } from '@/lib/productivity-publication';

/** Dedicated Core descriptors; native Canvas cv_* documents keep their existing consumer. */
export function useProductivityEvents() {
 const chat = useChatStore(state => state.activeConversationId);
 const messages = useChatStore(state => chat ? state.messages.get(chat) : undefined);
 const client = useWebSocketStore(state => state.client); const generation = useAuthStore(state => state.sessionGeneration);
 const epoch = useChatWorkspaceStore(state => chat ? state.byConversation[chat]?.epoch : undefined);
 const live = useRef(new Map<string, string>());
 useEffect(() => { live.current.clear(); }, [generation, client]);
 useEffect(() => { if (chat) for (const key of live.current.keys()) if (key.startsWith(`${chat}:`)) live.current.delete(key); }, [chat, epoch]);
 useEffect(() => {
  if (!chat || !messages) return;
  for (const raw of productivityHistoryPreviews(chat, messages, live.current)) {
   publishProductivity(chat, raw, useProfileStore.getState().activeProfileId);
  }
 }, [chat, messages, generation]);
 useEffect(() => {
  if (!client) return;
  return client.on('chat.*', event => {
   if (event.event !== 'chat.productivity.preview' || useWebSocketStore.getState().client !== client || useAuthStore.getState().sessionGeneration !== generation || typeof event.data.conversation_id !== 'string') return;
   const conversation = event.data.conversation_id; const reference = parseProductivityTabReference(event.data.preview, conversation); if (!reference) return;
   live.current.set(`${conversation}:${reference.resource_id}`, reference.id); publishProductivity(conversation, event.data.preview, useProfileStore.getState().activeProfileId);
  });
 }, [client, generation]);
 useEffect(() => {
  // The selector changes synchronously; its window event may arrive after an unrelated network delay.
  return useProfileStore.subscribe((next, previous) => {
   if (next.activeProfileId !== previous.activeProfileId) useChatWorkspaceStore.getState().invalidateProductivityProfiles();
  });
 }, []);
}
