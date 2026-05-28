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

import { useEffect } from 'react';
import { useWebSocket } from './use-websocket';
import { useChatStore } from '@/stores/chat.store';
import { useCanvasStore } from '@/stores/canvas.store';

/**
 * Listens to canvas.* WS events and dispatches to canvas store.
 * Returns whether canvas has content for the active conversation.
 */
export function useCanvasEvents() {
  const event = useWebSocket('canvas.*');
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const setCanvasContent = useCanvasStore((s) => s.setCanvasContent);
  const setCanvasUrl = useCanvasStore((s) => s.setCanvasUrl);
  const setCanvasError = useCanvasStore((s) => s.setCanvasError);
  const appendCanvasHistoryItem = useCanvasStore((s) => s.appendCanvasHistoryItem);
  const reloadCanvas = useCanvasStore((s) => s.reloadCanvas);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const canvasStates = useCanvasStore((s) => s.canvasStates);

  useEffect(() => {
    if (!event) return;
    // Always prefer the event's own conversation_id so a push lands on the
    // chat that triggered it, even if the user has since switched tabs.
    // Falling back to activeConvId leaked content into "New chat".
    const eventConvId = (event.data.conversation_id as string | undefined) ?? activeConvId;
    if (!eventConvId) return;
    const convId = eventConvId;

    switch (event.event) {
      case 'canvas.content': {
        // Ola 7 (oc7-5.1g): dual-mode dispatch.
        //   type='url' → setCanvasUrl (loads via /canvas-host/* proxy)
        //   type='html'/'a2ui' → setCanvasContent (inline srcDoc)
        const type = event.data.type as 'html' | 'a2ui' | 'url';
        const path = event.data.path as string | undefined;
        if (type === 'url') {
          const url = event.data.url as string;
          if (url) setCanvasUrl(convId, url, path);
        } else {
          const content = event.data.content as string;
          if (content) setCanvasContent(convId, type, content, path);
        }
        // Si el backend incluyó el id de la fila de canvas_pushes en el
        // payload, añadirlo al historial para que la barra de navegación
        // muestre el nuevo item inmediatamente sin necesidad de re-fetch.
        const rowId = event.data.canvas_push_id as string | undefined;
        const title = (event.data.title as string | undefined) ?? path ?? 'canvas';
        if (rowId) {
          const url = event.data.url as string | undefined;
          appendCanvasHistoryItem(convId, {
            id: rowId,
            url: url ?? null,
            path: path ?? null,
            title,
            type: type === 'url' ? 'html' : type,
            createdAt: new Date().toISOString(),
          });
        }
        break;
      }
      case 'canvas.error': {
        const message = (event.data.message as string) || 'Error al cargar el canvas';
        const code = event.data.code as string | undefined;
        setCanvasError(convId, message, code);
        break;
      }
      case 'canvas.reload':
        // Ola 7 (oc7-5.1g): chokidar in OpenClaw's canvasHost detected a
        // file change. We don't know which conv was affected (the reload
        // signal is global), so we bump the active conv's reloadKey if it
        // is in url mode. False positives are cheap (re-fetch is idempotent).
        reloadCanvas(convId);
        break;
      case 'canvas.clear':
        clearCanvas(convId);
        break;
      case 'canvas.snapshot':
        // Snapshot events are informational — no UI action needed yet
        break;
    }
  }, [event, activeConvId, setCanvasContent, setCanvasUrl, setCanvasError, appendCanvasHistoryItem, reloadCanvas, clearCanvas]);

  const current = activeConvId ? canvasStates.get(activeConvId) : undefined;
  return {
    hasContent: current?.hasContent ?? false,
    canvasType: current?.type ?? null,
  };
}
