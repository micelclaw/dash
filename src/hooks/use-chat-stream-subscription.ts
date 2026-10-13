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
//
// IMPORTANTE: nos suscribimos DIRECTO al cliente WS (no vía `useWebSocket`, que
// devuelve solo el ÚLTIMO evento por estado de React). En una RÁFAGA de varios
// `chat.stream.tool` en el mismo tick, `useWebSocket`+`useEffect` perdía los
// intermedios (React batchea los setEvent → el efecto solo ve el último). El
// `dispatch` del cliente (services/websocket.ts) invoca este callback por CADA
// frame → cero pérdida. Ver docs/reference/chat-streaming-sync.md.

import { useEffect } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useChatStore } from '@/stores/chat.store';
import { useNativeCanvasBoardStore } from '@/stores/native-canvas-board.store';
import type { ToolCallRecord } from '@/types/chat';
import type { WsEvent } from '@/types/websocket';

interface SmoothStream {
  runId?: string;
  chunks: string[];
  timer: ReturnType<typeof setInterval>;
  onDrain?: () => void;
}

const smoothStreams = new Map<string, SmoothStream>();

function splitCatchupText(text: string): string[] {
  const target = Math.max(12, Math.ceil(text.length / 60));
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + target);
    if (end < text.length) {
      const nextSpace = text.indexOf(' ', end);
      if (nextSpace >= 0 && nextSpace - end <= 12) end = nextSpace + 1;
    }
    chunks.push(text.slice(cursor, end));
    cursor = end;
  }
  return chunks;
}

/** Some providers (notably a Codex app-server run resumed after approval)
 * emit no deltas and then send the whole final block in one frame. Pace only
 * those large catch-up frames so the user still sees progressive output. */
function appendTokenWithFinalFallback(conversationId: string, token: string, runId?: string): void {
  if (token.length < 120 && !smoothStreams.has(conversationId)) {
    useChatStore.getState().appendStreamToken(conversationId, token, 'text', runId);
    return;
  }

  let existing = smoothStreams.get(conversationId);
  if (existing && existing.runId && runId && existing.runId !== runId) {
    cancelSmoothStream(conversationId);
    existing = undefined;
  }
  if (existing) {
    existing.chunks.push(...splitCatchupText(token));
    return;
  }

  const stream: SmoothStream = {
    runId,
    chunks: splitCatchupText(token),
    timer: setInterval(() => {
      const chunk = stream.chunks.shift();
      if (chunk) useChatStore.getState().appendStreamToken(conversationId, chunk, 'text', runId);
      if (stream.chunks.length === 0) {
        clearInterval(stream.timer);
        smoothStreams.delete(conversationId);
        stream.onDrain?.();
      }
    }, 14),
  };
  smoothStreams.set(conversationId, stream);
}

function cancelSmoothStream(conversationId: string): void {
  const stream = smoothStreams.get(conversationId);
  if (!stream) return;
  clearInterval(stream.timer);
  smoothStreams.delete(conversationId);
}

export function useChatStreamSubscription(): void {
  const client = useWebSocketStore((s) => s.client);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  useEffect(() => {
    if (!client || !activeConversationId) return;
    void useChatStore.getState().recoverActiveToolRun(activeConversationId);
  }, [client, activeConversationId]);

  useEffect(() => {
    if (!client) return;
    const unsubscribe = client.on('chat.stream.*', (streamEvent: WsEvent) => {
      const data = streamEvent.data;
      const convId = data.conversation_id as string;
      const runId = typeof data.run_id === 'string' ? data.run_id : undefined;
      // Acciones estables de Zustand → getState evita re-suscripción por deps.
      const s = useChatStore.getState();
      const isBackground = s.backgroundRuns.has(convId)
        || s.conversations.find((conversation) => conversation.id === convId)?.is_background === true;

      switch (streamEvent.event) {
        case 'chat.stream.start':
          cancelSmoothStream(convId);
          if (isBackground) {
            s.setBackgroundRunStatus(convId, 'running');
            break;
          }
          s.setStreamingMessage({
            conversationId: convId,
            runId,
            tokens: '', thinking: '', isThinking: false, tools: [],
          });
          break;
        case 'chat.stream.token':
          if (isBackground) break;
          appendTokenWithFinalFallback(convId, data.token as string, runId);
          break;
        case 'chat.stream.thinking':
          if (isBackground) break;
          s.appendStreamToken(convId, data.token as string, 'thinking', runId);
          break;
        case 'chat.stream.tool':
          if (isBackground) break;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          s.addToolEvent(convId, data as any);
          // Native show_widget writes the OpenClaw board directly. Unlike a
          // Core-initiated board PATCH, that path emits no canvas.board_changed
          // event through Core, so discard any pre-tool empty snapshot.
          if (data.tool === 'show_widget' && (data.status === 'completed' || data.status === 'success')) {
            useNativeCanvasBoardStore.getState().invalidate(convId);
          }
          break;
        case 'chat.stream.gateway_down':
          cancelSmoothStream(convId);
          if (isBackground) {
            s.setBackgroundRunStatus(convId, 'failed');
            void s.loadMessages(convId);
            break;
          }
          s.finalizeStream(convId, '', '__gateway_down__', 0);
          break;
        case 'chat.stream.error':
          if (isBackground) {
            s.setBackgroundRunStatus(convId, 'failed');
            void s.loadMessages(convId);
          }
          break;
        case 'chat.stream.system_message':
          s.addSystemMessage(
            convId,
            data.text as string,
            typeof data.command === 'string' ? data.command : null,
            typeof data.command_args === 'string' ? data.command_args : null,
          );
          break;
        case 'chat.stream.cleared':
          s.clearConversationMessages(convId);
          break;
        case 'chat.stream.new_session':
          s.startNewConversation();
          break;
        case 'chat.stream.done':
          {
            if (isBackground) {
              s.setBackgroundRunStatus(convId, data.error_type ? 'failed' : 'completed');
              void s.loadMessages(convId, { replace: true });
              void s.loadConversations();
              break;
            }
            const finalize = () => {
              useChatStore.getState().finalizeStream(
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
                  errorDetail: typeof data.error_detail === 'string' ? data.error_detail : null,
                  runId: runId ?? null,
                },
                Array.isArray(data.messages)
                  ? (data.messages as Array<{ id: string; text: string; tool_calls: ToolCallRecord[] | null; thinking: string | null; created_at: string }>)
                  : undefined,
              );
              if (Array.isArray(data.tool_calls) && data.tool_calls.some((call) => {
                const tool = call as Record<string, unknown>;
                return tool.tool === 'show_widget' && (tool.status === 'completed' || tool.status === 'success');
              })) {
                useNativeCanvasBoardStore.getState().invalidate(convId);
              }
              if (data.model !== 'error') {
                window.dispatchEvent(new CustomEvent('claw:tts-autoplay', {
                  detail: { text: data.full_text as string },
                }));
              }
            };
            const pending = smoothStreams.get(convId);
            if (pending && (!pending.runId || !runId || pending.runId === runId)) pending.onDrain = finalize;
            else if (pending) return;
            else finalize();
          }
          break;
      }
    });
    return () => {
      unsubscribe();
      for (const stream of smoothStreams.values()) clearInterval(stream.timer);
      smoothStreams.clear();
    };
  }, [client]);
}
