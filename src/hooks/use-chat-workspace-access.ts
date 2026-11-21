import { retireChatStreamPresentation } from './use-chat-stream-subscription';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useChatStore } from '@/stores/chat.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { useNativeCanvasBoardStore } from '@/stores/native-canvas-board.store';
import { useCanvasStore } from '@/stores/canvas.store';

/** Shell owns access/history invalidation even while another module is visible. */
export function useChatWorkspaceAccess(): void {
  const client = useWebSocketStore(s => s.client);
  const generation = useAuthStore(s => s.sessionGeneration);
  useEffect(() => {
    if (!client) return;
    return client.on('*', event => {
      if (useAuthStore.getState().sessionGeneration !== generation) return;
      const chat = event.data.conversation_id;
      if (typeof chat !== 'string' || !chat) return;
      const store = useChatWorkspaceStore.getState();
      if (event.event === 'chat.access.revoked' || event.event === 'canvas.access_revoked') {
        if (event.event === 'chat.access.revoked') { retireChatStreamPresentation(chat); useChatStore.getState().clearConversationMessages(chat); }
        store.revokeSource(chat); useNativeCanvasBoardStore.getState().revoke(chat); useCanvasStore.getState().clearCanvas(chat);
      } else if (event.event === 'canvas.access_changed') {
        for (const [id, value] of Object.entries(store.byConversation)) if (id === chat || Object.values(value.resources).some(r => r.sourceConversationId === chat)) store.revalidate(id);
        useNativeCanvasBoardStore.getState().invalidate(chat);
      } else if (event.event === 'chat.stream.cleared' || event.event === 'chat.synced' && (event.data.history_reset === true || event.data.history_replaced === true)) {
        if (store.byConversation[chat]?.revoked) return;
        retireChatStreamPresentation(chat); useChatStore.getState().clearConversationMessages(chat);
        if (event.event === 'chat.synced') void useChatStore.getState().loadMessages(chat, { replace: true });
      }
    });
  }, [client, generation]);
}
