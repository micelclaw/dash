import { useEffect } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { normalizeToolCallRecords } from '@/lib/tool-call-record';

/** Every committed row is applied in receive order, before a later access/reset frame. */
export function useChatLedgerSubscription(): void {
  const client = useWebSocketStore(s => s.client);
  const generation = useAuthStore(s => s.sessionGeneration);
  useEffect(() => {
    if (!client) return;
    return client.on('chat.ledger_message', event => {
      if (useAuthStore.getState().sessionGeneration !== generation) return;
      const data = event.data as { id: string; conversation_id: string | null; from_agent: string; text: string; tool_calls?: Array<Record<string, unknown>> | null; thinking?: string | null; created_at: string; incremental?: boolean };
      if (!data.id || !data.conversation_id || useChatWorkspaceStore.getState().byConversation[data.conversation_id]?.revoked) return;
      const store = useChatStore.getState();
      store.upsertLedgerMessage({ id: data.id, conversation_id: data.conversation_id, role: 'assistant', content: data.text, agent: data.from_agent, timestamp: data.created_at, tool_calls: normalizeToolCallRecords(data.tool_calls), thinking: data.thinking ?? undefined });
      if (data.incremental !== true && store.streamingMessage?.conversationId === data.conversation_id) store.setStreamingMessage(null);
    });
  }, [client, generation]);
}
