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

import { useWebSocketStore } from '@/stores/websocket.store';
import { useGatewayStore } from '@/stores/gateway.store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  collapsed: boolean;
}

interface Composite {
  color: string;
  label: string;
  tooltip: string;
}

/**
 * Combines WS connection status (dash↔Core) with Gateway health
 * (Core↔OpenClaw). Worst state wins. Gateway health is loaded
 * periodically by Shell.tsx (every 30s). Until the first health
 * fetch resolves, falls back to wsStatus alone (no false yellow).
 */
function compute(
  wsStatus: ReturnType<typeof useWebSocketStore.getState>['status'],
  gwHealth: ReturnType<typeof useGatewayStore.getState>['health'],
): Composite {
  // Worst case first.
  if (wsStatus === 'offline') {
    return { color: 'var(--error)', label: 'Offline', tooltip: 'Cannot reach Core (port 7200). Backend down or network issue.' };
  }
  if (wsStatus === 'auth_failed') {
    return { color: 'var(--error)', label: 'Auth failed', tooltip: 'Authentication failed against Core. Try logging out and back in.' };
  }
  if (wsStatus === 'reconnecting') {
    return { color: 'var(--warning)', label: 'Reconnecting…', tooltip: 'Reconnecting to Core…' };
  }
  // wsStatus === 'connected' from here. Now factor Gateway health.
  if (gwHealth?.status === 'down') {
    const why = gwHealth.error ?? gwHealth.checks.find(c => c.status === 'fail')?.message ?? 'Unknown reason';
    return { color: 'var(--error)', label: 'Gateway down', tooltip: `Gateway unreachable. ${why}` };
  }
  if (gwHealth?.status === 'degraded') {
    const failed = gwHealth.checks.find(c => c.status === 'fail' || c.status === 'warn');
    const why = failed ? `${failed.name}: ${failed.message ?? 'check failed'}` : 'one or more checks failed';
    return { color: 'var(--warning)', label: 'Gateway degraded', tooltip: `Gateway is degraded — ${why}.` };
  }
  // gwHealth healthy OR not yet loaded → trust wsStatus.
  return { color: 'var(--success)', label: 'Connected', tooltip: 'Connected to Core and Gateway.' };
}

export function ConnectionStatus({ collapsed }: ConnectionStatusProps) {
  const wsStatus = useWebSocketStore((s) => s.status);
  const gwHealth = useGatewayStore((s) => s.health);
  const composite = compute(wsStatus, gwHealth);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: collapsed ? '4px 0' : '4px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            cursor: 'default',
          }}
          aria-label={composite.label}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 'var(--radius-full)',
              background: composite.color,
              flexShrink: 0,
            }}
          />
          {!collapsed && <span>{composite.label}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6}>
        {composite.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
