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
  const reloadCanvas = useCanvasStore((s) => s.reloadCanvas);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const canvasStates = useCanvasStore((s) => s.canvasStates);

  useEffect(() => {
    if (!event) return;
    const convId = activeConvId ?? '__standalone__';

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
  }, [event, activeConvId, setCanvasContent, setCanvasUrl, reloadCanvas, clearCanvas]);

  const key = activeConvId ?? '__standalone__';
  const current = canvasStates.get(key);
  return {
    hasContent: current?.hasContent ?? false,
    canvasType: current?.type ?? null,
  };
}
