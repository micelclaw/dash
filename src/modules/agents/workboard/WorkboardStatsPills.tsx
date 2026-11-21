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
import { hasMessage, useI18n } from '@/i18n';
import { PILLS, countPill, buildDiagIndex } from './pills';
import type { WorkboardCard, WorkboardDiagnostic } from './types';

const PILL_MESSAGE: Record<string, string> = {
  running: 'agents.workboard.pill.running',
  blocked: 'agents.workboard.pill.blocked',
  stale: 'agents.workboard.pill.stale',
  ready_unassigned: 'agents.workboard.pill.readyUnassigned',
  untested: 'agents.workboard.pill.untested',
  failed: 'agents.workboard.pill.failed',
};

interface Props {
  cards: WorkboardCard[];
  diagnostics: WorkboardDiagnostic[];
  active: string | null;
  onToggle: (key: string | null) => void;
}

export function WorkboardStatsPills({ cards, diagnostics, active, onToggle }: Props) {
  const { t } = useI18n();
  const diagIndex = useMemo(() => buildDiagIndex(diagnostics), [diagnostics]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {PILLS.map((pill) => {
        const count = countPill(pill, cards, diagIndex);
        const on = active === pill.key;
        const labelKey = PILL_MESSAGE[pill.key];
        const label = labelKey && hasMessage(labelKey) ? t(labelKey) : pill.label;
        return (
          <button
            key={pill.key}
            onClick={() => onToggle(on ? null : pill.key)}
            title={t('agents.workboard.pill.filter', { label })}
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
            {label}
          </button>
        );
      })}
    </div>
  );
}
