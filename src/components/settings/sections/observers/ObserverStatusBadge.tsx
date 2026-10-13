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

import { Loader2 } from 'lucide-react';
import type { PlatformCapability } from '@/services/messages.service';

/**
 * Status pill for an observer row, derived ENTIRELY from the backend capability
 * (+ live sync progress) — never from local component state, so it survives a
 * refresh (regla feedback_button_state_persistence).
 */
export function ObserverStatusBadge({
  capability,
  syncing,
}: {
  capability?: PlatformCapability;
  syncing?: boolean;
}) {
  if (syncing) {
    return (
      <Pill color="#d4a017">
        <Loader2 size={10} className="animate-spin" /> Syncing
      </Pill>
    );
  }
  const status = capability?.connector?.status ?? null;
  const stream = capability?.stream ?? 'not_applicable';
  const errors = capability?.connector?.errors_count ?? 0;

  if (status === 'error') return <Pill color="#f87171">Error{errors > 0 ? ` (${errors})` : ''}</Pill>;
  if (status === 'paused') return <Pill color="var(--text-muted)">Paused</Pill>;
  if (status === 'pending_pairing') return <Pill color="#d4a017">Needs pairing</Pill>;
  if (status === 'active') {
    const live = stream === 'connected';
    const degraded = stream === 'disconnected';
    return (
      <Pill color={degraded ? '#d4a017' : '#22c55e'} dot>
        {degraded ? 'Connected · stream down' : live ? 'Connected · live' : 'Connected'}
      </Pill>
    );
  }
  return null;
}

function Pill({ color, dot, children }: { color: string; dot?: boolean; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: '0.625rem', fontWeight: 500, color, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />}
      {children}
    </span>
  );
}
