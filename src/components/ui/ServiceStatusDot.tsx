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

import { cn } from '@/lib/utils';
import type { ServiceState } from '@/stores/services.store';

interface ServiceStatusDotProps {
  status: ServiceState;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

const STATUS_CONFIG: Record<ServiceState, { color: string; label: string; pulse?: boolean }> = {
  running: { color: 'bg-emerald-500', label: 'Running' },
  starting: { color: 'bg-amber-500', label: 'Starting', pulse: true },
  stopped: { color: 'bg-[var(--text-dim)] opacity-40', label: 'Stopped' },
  draining: { color: 'bg-amber-500', label: 'Draining' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

const SIZE_MAP = { sm: 'h-1.5 w-1.5', md: 'h-2 w-2' };

export function ServiceStatusDot({ status, size = 'sm', className, title }: ServiceStatusDotProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped;
  const sizeClass = SIZE_MAP[size];

  return (
    <span
      className={cn(
        'inline-block rounded-full shrink-0',
        sizeClass,
        config.color,
        config.pulse && 'animate-pulse',
        className,
      )}
      title={title ?? config.label}
    />
  );
}
