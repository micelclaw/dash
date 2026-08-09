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
  /**
   * El contenedor corre pero el servicio no está configurado (Core lo manda en
   * `setup_hint`). Gana al estado: un «running» sin configurar NO se pinta de
   * verde — era exactamente la mentira del panel con la VPN sin autenticar.
   */
  needsSetup?: boolean;
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

const NEEDS_SETUP_CONFIG = { color: 'bg-amber-500', label: 'Needs setup' } as const;

export function ServiceStatusDot({ status, needsSetup, size = 'sm', className, title }: ServiceStatusDotProps) {
  const config = needsSetup ? NEEDS_SETUP_CONFIG : (STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped);
  const sizeClass = SIZE_MAP[size];

  return (
    <span
      className={cn(
        'inline-block rounded-full shrink-0',
        sizeClass,
        config.color,
        'pulse' in config && config.pulse && 'animate-pulse',
        className,
      )}
      title={title ?? config.label}
    />
  );
}
