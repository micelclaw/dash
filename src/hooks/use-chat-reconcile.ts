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

// Reconciliación DB-authoritative. Re-fetcha el hilo activo desde la DB cuando
// el dash recupera la capacidad de mostrar mensajes que se completaron mientras
// estaba "ciego": (a) al RECONECTAR el WS tras una caída, (b) al volver a la
// pestaña (visibilitychange). Así, cualquier mensaje que Core persistió mientras
// el WS estaba caído aparece solo, sin F5. `loadMessages` ya mergea idempotente.
// Montado en Shell (persistente).

import { useEffect, useRef } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useChatStore } from '@/stores/chat.store';

function reconcile(): void {
  const cs = useChatStore.getState();
  void cs.loadConversations();
  const convId = cs.activeConversationId;
  if (convId) void cs.loadMessages(convId);
}

export function useChatReconcile(): void {
  const status = useWebSocketStore((s) => s.status);
  const prevStatus = useRef(status);

  // (a) Reconexión del WS: transición no-connected → connected.
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (status === 'connected' && prev !== 'connected') {
      reconcile();
    }
  }, [status]);

  // (b) Pestaña vuelve a ser visible.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
