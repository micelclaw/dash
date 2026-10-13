import { useEffect } from 'react';
import { useWebSocket } from './use-websocket';
import { useChatStore } from '@/stores/chat.store';
import { normalizeToolCallRecords } from '@/lib/tool-call-record';

/** Receives committed ledger rows. Incremental diagnostics are independent of
 * the active response and must not end its stream. Mounted once by Shell. */
export function useChatLedgerSubscription(): void {
  const ledgerMsgEvent = useWebSocket('chat.ledger_message');
  useEffect(() => {
    if (!ledgerMsgEvent) return;
    const data = ledgerMsgEvent.data as {
      id: string; conversation_id: string | null; session_id: string; from_agent: string;
      text: string; tool_calls?: Array<Record<string, unknown>> | null;
      thinking?: string | null; created_at: string; incremental?: boolean;
    };
    if (!data.id || !data.conversation_id) return;
    const store = useChatStore.getState();
    store.upsertLedgerMessage({
      id: data.id, conversation_id: data.conversation_id, role: 'assistant', content: data.text,
      agent: data.from_agent, timestamp: data.created_at,
      tool_calls: normalizeToolCallRecords(data.tool_calls), thinking: data.thinking ?? undefined,
    });
    if (data.incremental !== true && store.streamingMessage?.conversationId === data.conversation_id) {
      store.setStreamingMessage(null);
    }
  }, [ledgerMsgEvent]);
}
