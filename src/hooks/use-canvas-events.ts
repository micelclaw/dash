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
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const canvasStates = useCanvasStore((s) => s.canvasStates);

  useEffect(() => {
    if (!event) return;
    const convId = activeConvId ?? '__standalone__';

    switch (event.event) {
      case 'canvas.content': {
        const type = event.data.type as 'html' | 'a2ui';
        const content = event.data.content as string;
        const path = event.data.path as string | undefined;
        setCanvasContent(convId, type, content, path);
        break;
      }
      case 'canvas.clear':
        clearCanvas(convId);
        break;
      case 'canvas.snapshot':
        // Snapshot events are informational — no UI action needed yet
        break;
    }
  }, [event, activeConvId, setCanvasContent, clearCanvas]);

  const key = activeConvId ?? '__standalone__';
  const current = canvasStates.get(key);
  return {
    hasContent: current?.hasContent ?? false,
    canvasType: current?.type ?? null,
  };
}
