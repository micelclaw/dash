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

// ÚNICA suscripción global a `chat.stream.*`. Montada en Shell (persistente toda
// la app) — así un `chat.stream.done` NO se descarta cuando el usuario navega
// fuera del chat (antes el handler vivía en ChatPage/BottomBar, que se desmontan
// → done perdido → mensaje colgado → había que hacer F5). ChatPage/BottomBar
// ahora solo RENDERIZAN del store. DB-authoritative: este handler actualiza el
// store en vivo; `loadMessages` reconcilia desde DB como red (ver use-chat-reconcile).

import { useEffect } from 'react';
import { useWebSocket } from './use-websocket';
import { useChatStore } from '@/stores/chat.store';
import type { ToolCallRecord } from '@/types/chat';

export function useChatStreamSubscription(): void {
  const streamEvent = useWebSocket('chat.stream.*');

  useEffect(() => {
    if (!streamEvent) return;
    const data = streamEvent.data;
    const convId = data.conversation_id as string;
    // Acciones estables de Zustand → getState evita re-suscripción por deps.
    const s = useChatStore.getState();

    switch (streamEvent.event) {
      case 'chat.stream.start':
        s.setStreamingMessage({ conversationId: convId, tokens: '', thinking: '', isThinking: false, tools: [] });
        break;
      case 'chat.stream.token':
        s.appendStreamToken(convId, data.token as string);
        break;
      case 'chat.stream.thinking':
        s.appendStreamToken(convId, data.token as string, 'thinking');
        break;
      case 'chat.stream.tool':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        s.addToolEvent(convId, data as any);
        break;
      case 'chat.stream.gateway_down':
        s.finalizeStream(convId, '', '__gateway_down__', 0);
        break;
      case 'chat.stream.system_message':
        s.addSystemMessage(convId, data.text as string);
        break;
      case 'chat.stream.cleared':
        s.clearConversationMessages(convId);
        break;
      case 'chat.stream.new_session':
        s.startNewConversation();
        break;
      case 'chat.stream.done':
        s.finalizeStream(
          convId,
          data.full_text as string,
          data.model as string | undefined,
          data.tokens_used as number | undefined,
          data.error_type as string | undefined,
          Array.isArray(data.tool_calls) ? (data.tool_calls as ToolCallRecord[]) : undefined,
          typeof data.thinking === 'string' ? (data.thinking as string) : null,
          {
            clientTempId: typeof data.client_temp_id === 'string' ? data.client_temp_id : null,
            userMessageId: typeof data.user_message_id === 'string' ? data.user_message_id : null,
            assistantMessageId: typeof data.assistant_message_id === 'string' ? data.assistant_message_id : null,
          },
        );
        // TTS auto-play (ChatInput escucha este evento de window).
        if (data.model !== 'error') {
          window.dispatchEvent(new CustomEvent('claw:tts-autoplay', {
            detail: { text: data.full_text as string },
          }));
        }
        break;
    }
  }, [streamEvent]);
}
