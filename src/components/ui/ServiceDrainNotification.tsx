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
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';
import { useServicesStore } from '@/stores/services.store';

/** Listens for drain_blocked WS events and shows toasts with action buttons */
export function ServiceDrainListener() {
  const drainEvent = useWebSocket('service.drain_blocked');
  const forceStopService = useServicesStore((s) => s.forceStopService);

  useEffect(() => {
    if (!drainEvent) return;

    const data = drainEvent.data as Record<string, unknown>;
    const name = (data.name as string) ?? 'Service';
    const serviceName = (data.service as string) ?? '';
    const guards = (data.guards as Array<{ name: string; reason: string }>) ?? [];
    const reason = guards[0]?.reason ?? 'Active session detected';

    toast(name, {
      description: reason,
      duration: 15_000,
      action: {
        label: 'Force Stop',
        onClick: () => {
          forceStopService(serviceName);
        },
      },
    });
  }, [drainEvent, forceStopService]);

  return null;
}
