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

import { useEffect, useCallback, useMemo } from 'react';
import { useWebSocket } from './use-websocket';
import { useCanvasStore } from '@/stores/canvas.store';

/**
 * Listens to browser.* WS events and dispatches to canvas store.
 * Returns the active browser session state.
 */
export function useBrowserSession() {
  const event = useWebSocket('browser.*');

  // Select individual actions (stable references from zustand)
  const browserStarted = useCanvasStore((s) => s.browserStarted);
  const browserNavigating = useCanvasStore((s) => s.browserNavigating);
  const browserAction = useCanvasStore((s) => s.browserAction);
  const browserSnapshot = useCanvasStore((s) => s.browserSnapshot);
  const browserComplete = useCanvasStore((s) => s.browserComplete);
  const browserError = useCanvasStore((s) => s.browserError);
  const browserSessions = useCanvasStore((s) => s.browserSessions);

  useEffect(() => {
    if (!event) return;
    const d = event.data;
    const sessionId = d.session_id as string;

    switch (event.event) {
      case 'browser.started':
        browserStarted(sessionId);
        break;
      case 'browser.navigating':
        browserNavigating(sessionId, d.url as string);
        break;
      case 'browser.action':
        browserAction(
          sessionId,
          d.action as string,
          d.humanized as string,
          d.selector as string | undefined,
        );
        break;
      case 'browser.snapshot':
        browserSnapshot(sessionId, d.base64 as string, d.url as string | undefined);
        break;
      case 'browser.complete':
        browserComplete(sessionId, d.pages_visited as number | undefined);
        break;
      case 'browser.error':
        browserError(sessionId, d.error as string);
        break;
    }
  }, [event, browserStarted, browserNavigating, browserAction, browserSnapshot, browserComplete, browserError]);

  // Derive active session from browserSessions map
  const session = useMemo(() => {
    for (const s of browserSessions.values()) {
      if (s.status === 'active') return s;
    }
    // Fallback: most recent
    const all = [...browserSessions.values()];
    return all.length > 0 ? all[all.length - 1] : undefined;
  }, [browserSessions]);

  return {
    session,
    isActive: session?.status === 'active',
    actions: session?.actions ?? [],
    currentUrl: session?.currentUrl ?? null,
    humanizedAction: session?.humanizedAction ?? null,
    snapshot: session?.snapshot ?? null,
  };
}
