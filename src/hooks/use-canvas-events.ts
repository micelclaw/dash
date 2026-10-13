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
import { useNativeCanvasBoardStore } from '@/stores/native-canvas-board.store';

/**
 * Listens to canvas.* WS events and dispatches to canvas store.
 * Returns whether canvas has content for the active conversation.
 */
export function useCanvasEvents() {
  const event = useWebSocket('canvas.*');
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const activeMessages = useChatStore((s) => activeConvId ? s.messages.get(activeConvId) : undefined);
  const setCanvasContent = useCanvasStore((s) => s.setCanvasContent);
  const setCanvasUrl = useCanvasStore((s) => s.setCanvasUrl);
  const setCanvasError = useCanvasStore((s) => s.setCanvasError);
  const appendCanvasHistoryItem = useCanvasStore((s) => s.appendCanvasHistoryItem);
  const reloadCanvas = useCanvasStore((s) => s.reloadCanvas);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const canvasStates = useCanvasStore((s) => s.canvasStates);
  const nativeBoards = useNativeCanvasBoardStore((s) => s.byConversation);
  const nativePreviews = useNativeCanvasBoardStore((s) => s.previews);
  const invalidateNativeBoard = useNativeCanvasBoardStore((s) => s.invalidate);
  const revokeNativeBoard = useNativeCanvasBoardStore((s) => s.revoke);
  const addNativePreview = useNativeCanvasBoardStore((s) => s.addPreview);

  // Core persists native previews with the assistant turn. Restore those
  // opaque references when a conversation is reloaded; the live WS event alone
  // is not enough after a browser refresh or a missed notification.
  useEffect(() => {
    if (!activeConvId || !activeMessages) return;
    for (const message of activeMessages) {
      if (message.role !== 'assistant') continue;
      const previews = message.message_metadata?.canvas_previews;
      if (!Array.isArray(previews)) continue;
      for (const entry of previews) {
        if (!entry || typeof entry !== 'object') continue;
        const preview = entry as Record<string, unknown>;
        const documentId = preview.document_id;
        const viewId = preview.view_id;
        if (typeof documentId !== 'string' || !/^cv_[a-z0-9_-]{8,128}$/i.test(documentId)
          || typeof viewId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(viewId)) continue;
        addNativePreview(activeConvId, { documentId, viewId, title: typeof preview.title === 'string' ? preview.title : null });
      }
    }
  }, [activeConvId, activeMessages, addNativePreview]);

  useEffect(() => {
    if (!event) return;
    // Always prefer the event's own conversation_id so a push lands on the
    // chat that triggered it, even if the user has since switched tabs.
    // Falling back to activeConvId leaked content into "New chat".
    const eventConvId = (event.data.conversation_id as string | undefined) ?? activeConvId;
    if (!eventConvId) return;
    const convId = eventConvId;

    switch (event.event) {
      case 'canvas.snapshot':
        // Snapshot events are informational — no UI action needed yet
        break;
      case 'canvas.board_changed': {
        // Event payload is only an invalidation hint. The board is always
        // reloaded through the authorized REST route, never trusted from WS.
        const revision = typeof event.data.revision === 'number' ? event.data.revision : undefined;
        invalidateNativeBoard(convId, revision);
        break;
      }
      case 'canvas.preview': {
        const documentId = event.data.document_id as string | undefined;
        const viewId = event.data.view_id as string | undefined;
        if (documentId && viewId) addNativePreview(convId, { documentId, viewId, title: typeof event.data.title === 'string' ? event.data.title : null });
        break;
      }
      case 'canvas.access_revoked':
        revokeNativeBoard(convId);
        clearCanvas(convId);
        break;
    }
  }, [event, activeConvId, setCanvasContent, setCanvasUrl, setCanvasError, appendCanvasHistoryItem, reloadCanvas, clearCanvas, invalidateNativeBoard, revokeNativeBoard, addNativePreview]);

  const current = activeConvId ? canvasStates.get(activeConvId) : undefined;
  return {
    hasContent: current?.hasContent ?? false,
    hasNativeCanvas: Boolean(activeConvId && (nativeBoards.has(activeConvId) || nativePreviews.has(activeConvId))),
    canvasType: current?.type ?? null,
  };
}
