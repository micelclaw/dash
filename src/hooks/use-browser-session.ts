import { useAuthStore } from '@/stores/auth.store';
import { useEffect } from 'react';
import { useCanvasStore } from '@/stores/canvas.store';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';

/** Consume every frame, including same-tick bursts; never attribute an unscoped frame to the active chat. */
export function useBrowserSession() {
  const generation = useAuthStore(s => s.sessionGeneration);
  const client = useWebSocketStore(s => s.client);
  const activeConvId = useChatStore(s => s.activeConversationId);
  const sessions = useCanvasStore(s => s.browserSessions);
  useEffect(() => {
    if (!client) return;
    return client.on('browser.*', event => {
      if (useAuthStore.getState().sessionGeneration !== generation) return;
      const d = event.data;
      if (typeof d.conversation_id !== 'string' || typeof d.session_id !== 'string' || !d.session_id) return;
      const chat = d.conversation_id; const id = d.session_id;
      if (useChatWorkspaceStore.getState().byConversation[chat]?.revoked) return;
      const store = useCanvasStore.getState();
      const existing = store.browserSessions.get(id);
      if (existing && existing.conversationId !== chat) return;
      if (!existing || event.event === 'browser.started') store.browserStarted(id, chat);
      switch (event.event) {
        case 'browser.navigating': if (typeof d.url === 'string') store.browserNavigating(id, d.url); break;
        case 'browser.action': if (typeof d.action === 'string' && typeof d.humanized === 'string') store.browserAction(id, d.action, d.humanized, typeof d.selector === 'string' ? d.selector : undefined); break;
        case 'browser.snapshot': if (typeof d.base64 === 'string') store.browserSnapshot(id, d.base64, typeof d.url === 'string' ? d.url : undefined); break;
        case 'browser.complete': store.browserComplete(id, typeof d.pages_visited === 'number' ? d.pages_visited : undefined); break;
        case 'browser.error': store.browserError(id, typeof d.error === 'string' ? d.error : 'No se pudo cargar la captura'); break;
      }
      useChatWorkspaceStore.getState().upsert(chat, { id: `browser:${chat}`, kind: 'browser', title: 'Navegación', sourceConversationId: chat });
    });
  }, [client, generation]);
  const matching = [...sessions.values()].filter(s => s.conversationId === activeConvId);
  const session = matching.find(s => s.status === 'active') ?? matching.at(-1);
  return { session, isActive: session?.status === 'active', actions: session?.actions ?? [], currentUrl: session?.currentUrl ?? null, humanizedAction: session?.humanizedAction ?? null, snapshot: session?.snapshot ?? null };
}
