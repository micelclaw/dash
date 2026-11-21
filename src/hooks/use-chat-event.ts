import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import type { WsEvent } from '@/types/websocket';

type ScopedChatEvent = WsEvent & { isCurrent(): boolean };
/** Keep the receipt's identity until its React consumer actually applies it. */
export function useChatEvent(pattern: string): ScopedChatEvent | null {
  const [event, setEvent] = useState<ScopedChatEvent | null>(null);
  const client = useWebSocketStore(s => s.client);
  const generation = useAuthStore(s => s.sessionGeneration);
  useEffect(() => {
    if (!client) return;
    return client.on(pattern, frame => {
      if (useAuthStore.getState().sessionGeneration !== generation) return;
      const chat = typeof frame.data.conversation_id === 'string' ? frame.data.conversation_id : null;
      const epoch = chat ? useChatWorkspaceStore.getState().byConversation[chat]?.epoch ?? 0 : 0;
      setEvent({ ...frame, isCurrent: () => useAuthStore.getState().sessionGeneration === generation && useWebSocketStore.getState().client === client && (!chat || !useChatWorkspaceStore.getState().byConversation[chat]?.revoked && (useChatWorkspaceStore.getState().byConversation[chat]?.epoch ?? 0) === epoch) });
    });
  }, [client, generation, pattern]);
  return event?.isCurrent() ? event : null;
}
