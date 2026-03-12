/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

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
