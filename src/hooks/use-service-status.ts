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
import { useServicesStore } from '@/stores/services.store';
import type { ServiceState } from '@/stores/services.store';

/** Subscribe to service lifecycle WS events and keep the store in sync */
export function useServiceEvents(): void {
  const updateServiceFromWS = useServicesStore((s) => s.updateServiceFromWS);
  const serviceEvent = useWebSocket('service.*');

  useEffect(() => {
    if (!serviceEvent) return;
    updateServiceFromWS(serviceEvent.event, serviceEvent.data as Record<string, unknown>);
  }, [serviceEvent, updateServiceFromWS]);
}

/** Get the lifecycle state of a specific service */
export function useServiceState(name: string): ServiceState | null {
  const services = useServicesStore((s) => s.services);
  const svc = services.find((s) => s.name === name);
  return svc?.state ?? null;
}

/** Check if a specific service is running */
export function useIsServiceRunning(name: string): boolean {
  const state = useServiceState(name);
  return state === 'running';
}
