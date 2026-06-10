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
// pestaña (visibilitychange), (c) cuando Core EMPUJA un `chat.synced` tras
// persistir un mensaje (poke server-push → instantáneo sin cambiar de pestaña).
// El stream `chat.stream.*` es run-scoped (solo el socket que originó el run lo
// recibe); el poke (c) cubre los dashes que miran la conv pero no la originaron.
// Así cualquier mensaje que Core persistió aparece solo, sin F5. `loadMessages`
// ya mergea idempotente (dedup por client_temp_id). Montado en Shell (persistente).

import { useEffect, useRef } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useWebSocket } from './use-websocket';
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

  // (c) Poke server-push `chat.synced {conversation_id}`: Core acaba de persistir
  // un mensaje. Reconciliamos AL INSTANTE sin esperar a visibilitychange/reconnect
  // (caso del usuario mirando la conv en primer plano cuando llega un mensaje que
  // el stream run-scoped no entregó a este socket). Debounced ~150ms para coalescer
  // el poke del user + el del assistant del mismo turno.
  const syncedEvent = useWebSocket('chat.synced');
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!syncedEvent) return;
    const convId = syncedEvent.data?.conversation_id as string | undefined;
    if (!convId) return;
    if (pokeTimer.current) clearTimeout(pokeTimer.current);
    pokeTimer.current = setTimeout(() => {
      const cs = useChatStore.getState();
      void cs.loadConversations(); // refresca el sidebar (último mensaje / orden)
      // El hilo solo se recarga si es el que el usuario mira; los demás se
      // reconcilian al abrirlos (loadMessages en cambio de activeConversationId).
      if (convId === cs.activeConversationId) void cs.loadMessages(convId);
    }, 150);
  }, [syncedEvent]);
  useEffect(() => () => { if (pokeTimer.current) clearTimeout(pokeTimer.current); }, []);
}
