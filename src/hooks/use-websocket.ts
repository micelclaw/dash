import { useEffect, useState } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { WsEvent } from '@/types/websocket';

export function useWebSocket(pattern: string): WsEvent | null {
  const [event, setEvent] = useState<WsEvent | null>(null);
  const client = useWebSocketStore((s) => s.client);

  useEffect(() => {
    if (!client) return;
    const unsub = client.on(pattern, setEvent);
    return unsub;
  }, [client, pattern]);

  return event;
}
