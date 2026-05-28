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

import { useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useCanvasStore, type CanvasHistoryItem } from '@/stores/canvas.store';

const EMPTY_HISTORY: CanvasHistoryItem[] = [];

interface ApiRow {
  id: string;
  url_path: string | null;
  title: string | null;
  type: 'html' | 'a2ui' | 'inline';
  created_at: string;
}

interface ListResponse {
  data: ApiRow[];
}

function toItem(row: ApiRow): CanvasHistoryItem {
  return {
    id: row.id,
    url: row.url_path ? `/api/v1/canvas-host/${row.url_path}` : null,
    path: row.url_path ?? null,
    title: row.title ?? row.url_path ?? row.id,
    type: row.type,
    createdAt: row.created_at,
  };
}

/**
 * Historial de canvases por conversación. Carga inicial desde
 * `GET /canvas-pushes?conversation_id=X` y se mantiene reactivo a través del
 * store (los eventos WS `canvas.content` añaden items vía
 * `appendCanvasHistoryItem` desde `use-canvas-events.ts`).
 *
 * Expone una API similar a `usePersistedScreenshots` para coherencia.
 */
export function useCanvasHistory(conversationId: string | null) {
  const history = useCanvasStore(
    (s) => (conversationId ? s.canvasHistory.get(conversationId) : undefined) ?? EMPTY_HISTORY,
  );
  const currentIndex = useCanvasStore((s) =>
    conversationId ? s.currentCanvasIndex.get(conversationId) ?? 0 : 0,
  );
  const setCanvasHistory = useCanvasStore((s) => s.setCanvasHistory);
  const setCanvasCursor = useCanvasStore((s) => s.setCanvasCursor);
  const removeCanvasHistoryItem = useCanvasStore((s) => s.removeCanvasHistoryItem);
  const setCanvasUrl = useCanvasStore((s) => s.setCanvasUrl);

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await api.get<ListResponse>(
        '/canvas-pushes',
        { conversation_id: conversationId },
      );
      const items = (res.data ?? []).map(toItem);
      setCanvasHistory(conversationId, items);
    } catch (err) {
      console.error('[canvas-history] fetch failed:', err);
    }
  }, [conversationId, setCanvasHistory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const navigate = useCallback(
    (index: number) => {
      if (!conversationId) return;
      const items = useCanvasStore.getState().canvasHistory.get(conversationId) ?? [];
      if (index < 0 || index >= items.length) return;
      setCanvasCursor(conversationId, index);
      const item = items[index]!;
      if (item.url && item.path) {
        // Forzar render del iframe con la URL del item navegado.
        setCanvasUrl(conversationId, item.url, item.path);
      }
    },
    [conversationId, setCanvasCursor, setCanvasUrl],
  );

  const removeCurrent = useCallback(
    async ({ deleteFile }: { deleteFile: boolean }) => {
      if (!conversationId) return;
      const items = useCanvasStore.getState().canvasHistory.get(conversationId) ?? [];
      const idx = useCanvasStore.getState().currentCanvasIndex.get(conversationId) ?? 0;
      const current = items[idx];
      if (!current) return;
      try {
        await api.delete(
          `/canvas-pushes/${current.id}?delete_file=${deleteFile ? 'true' : 'false'}`,
        );
        removeCanvasHistoryItem(conversationId, current.id);
        // Tras borrar, si quedan items, mover el iframe al item ahora activo.
        const after = useCanvasStore.getState().canvasHistory.get(conversationId) ?? [];
        const newIdx = useCanvasStore.getState().currentCanvasIndex.get(conversationId) ?? 0;
        const newCurrent = after[newIdx];
        if (newCurrent?.url && newCurrent.path) {
          setCanvasUrl(conversationId, newCurrent.url, newCurrent.path);
        }
      } catch (err) {
        console.error('[canvas-history] delete failed:', err);
      }
    },
    [conversationId, removeCanvasHistoryItem, setCanvasUrl],
  );

  const current = history[currentIndex];

  return {
    history,
    currentIndex,
    current,
    navigate,
    removeCurrent,
    refresh,
    canPrev: currentIndex > 0,
    canNext: currentIndex < history.length - 1,
  };
}
