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

import { useMemo } from 'react';
import { PILLS, countPill, buildDiagIndex } from './pills';
import type { WorkboardCard, WorkboardDiagnostic } from './types';

interface Props {
  cards: WorkboardCard[];
  diagnostics: WorkboardDiagnostic[];
  active: string | null;
  onToggle: (key: string | null) => void;
}

export function WorkboardStatsPills({ cards, diagnostics, active, onToggle }: Props) {
  const diagIndex = useMemo(() => buildDiagIndex(diagnostics), [diagnostics]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {PILLS.map((pill) => {
        const count = countPill(pill, cards, diagIndex);
        const on = active === pill.key;
        return (
          <button
            key={pill.key}
            onClick={() => onToggle(on ? null : pill.key)}
            title={`Filtrar: ${pill.label}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
              fontSize: '0.6875rem', cursor: 'pointer',
              border: `1px solid ${on ? pill.color : 'var(--border)'}`,
              background: on ? 'var(--bg-subtle, rgba(127,127,127,0.14))' : 'transparent',
              color: count > 0 ? 'var(--text)' : 'var(--text-muted)',
              opacity: count === 0 && !on ? 0.55 : 1,
            }}
          >
            <span style={{ fontWeight: 700, color: count > 0 ? pill.color : 'var(--text-muted)' }}>{count}</span>
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
