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

import { useState } from 'react';
import { WorkboardCardView } from './WorkboardCard';
import { CardDetailModal } from './CardDetailModal';
import { LANES } from './lanes';
import type { WorkboardCard } from './types';
import type { ManagedAgent } from '../types';

interface Props {
  cards: WorkboardCard[];
  agents: ManagedAgent[];
  onChanged: () => void;
}

export function WorkboardBoard({ cards, agents, onChanged }: Props) {
  const [selected, setSelected] = useState<WorkboardCard | null>(null);
  const [open, setOpen] = useState(false);

  // Mantener `selected` sincronizado con la última versión de la card tras un refresh.
  const live = selected ? cards.find((c) => c.id === selected.id) ?? selected : null;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {LANES.map((lane) => {
          const laneCards = cards
            .filter((c) => lane.statuses.includes(c.status))
            .sort((a, b) => a.position - b.position);
          return (
            <div key={lane.key} style={{ flex: '1 0 220px', minWidth: 220, maxWidth: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 8px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: lane.accent }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>{lane.label}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{laneCards.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minHeight: 40, padding: 6, borderRadius: 10, background: 'var(--bg-subtle, rgba(127,127,127,0.04))' }}>
                {laneCards.map((c) => (
                  <WorkboardCardView key={c.id} card={c} agents={agents} onClick={() => { setSelected(c); setOpen(true); }} />
                ))}
                {laneCards.length === 0 && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CardDetailModal card={live} agents={agents} open={open} onClose={() => setOpen(false)} onChanged={onChanged} />
    </>
  );
}
