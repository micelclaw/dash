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

// Badge "Recurrente" reutilizable (Movimientos, Movimientos recientes, detalle).
// Se muestra cuando un movimiento tiene recurring_rule_id (0247).

import { Repeat } from 'lucide-react';
import { tintBackground } from './lib';

const ACCENT = '#8b5cf6'; // violeta: atributo neutro, no confundir con ingreso/gasto

export function RecurrenceBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Movimiento recurrente"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: compact ? 0 : 4,
        padding: compact ? '2px' : '2px 8px 2px 7px',
        background: tintBackground(ACCENT), border: `1px solid ${tintBackground(ACCENT, 0.4)}`,
        borderRadius: 'var(--radius-full, 999px)', fontSize: 11, color: ACCENT, fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.4,
      }}
    >
      <Repeat size={compact ? 11 : 12} />{compact ? '' : 'Recurrente'}
    </span>
  );
}
