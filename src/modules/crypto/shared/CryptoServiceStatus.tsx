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

interface ServiceInfo {
  installed: boolean;
  running: boolean;
  phase: string;
}

export function getDotColor(svc: ServiceInfo | undefined): string {
  if (!svc || !svc.installed) return '#ef4444';
  if (!svc.running) return '#f59e0b';
  if (svc.phase === 'syncing') return '#f59e0b';
  return '#22c55e';
}

export function getStatusLabel(svc: ServiceInfo | undefined): string {
  if (!svc || !svc.installed) return 'Not installed';
  if (!svc.running) return 'Stopped';
  if (svc.phase === 'syncing') return 'Syncing';
  return 'Running';
}
