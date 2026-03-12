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

import { Flame } from 'lucide-react';

interface GraphHeatMapToggleProps {
  active: boolean;
  onToggle: () => void;
}

export function GraphHeatMapToggle({ active, onToggle }: GraphHeatMapToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={active ? 'Standard view' : 'Heat map view'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? '#f43f5e' : 'var(--border)'}`,
        background: active ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
        color: active ? '#f43f5e' : 'var(--text-dim)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
      }}
    >
      <Flame size={12} />
      Heat
    </button>
  );
}
