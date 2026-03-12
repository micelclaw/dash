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
import { useWebSocketStore } from '@/stores/websocket.store';
import { useModuleContext } from './use-module-context';
import { useIdle } from './use-idle';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Sends a `context.heartbeat` action over WebSocket every 30 seconds.
 * Includes the current module, active record, and idle state.
 * Should be mounted once in the Shell component.
 */
export function useHeartbeat(): void {
  const send = useWebSocketStore((s) => s.send);
  const status = useWebSocketStore((s) => s.status);
  const { moduleId, activeItem } = useModuleContext();
  const idle = useIdle();

  useEffect(() => {
    if (status !== 'connected') return;

    const interval = setInterval(() => {
      send('context.heartbeat', {
        module: moduleId,
        record_id: activeItem?.id ?? null,
        idle,
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [status, send, moduleId, activeItem?.id, idle]);
}
