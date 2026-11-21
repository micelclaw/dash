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

import { Palette, Flame, Boxes } from 'lucide-react';
import type { GraphColorMode } from '@/types/intelligence';
import { useI18n } from '@/i18n';

interface GraphColorModeToggleProps {
  mode: GraphColorMode;
  onChange: (mode: GraphColorMode) => void;
}

const OPTIONS: Array<{ key: GraphColorMode; Icon: typeof Palette; active: string }> = [
  { key: 'type', Icon: Palette, active: 'var(--amber)' },
  { key: 'heat', Icon: Flame, active: '#f43f5e' },
  { key: 'community', Icon: Boxes, active: '#a78bfa' },
];

/** Segmented control para el coloreado del grafo: por tipo / por calor / por comunidad. */
export function GraphColorModeToggle({ mode, onChange }: GraphColorModeToggleProps) {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {OPTIONS.map(({ key, Icon, active }) => {
        const isActive = mode === key;
        const label = t(`graph.color.${key}`);
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={t('graph.color.by', { mode: label.toLowerCase() })}
            aria-pressed={isActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.6875rem',
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'var(--font-sans)',
              background: isActive ? active : 'transparent',
              color: isActive ? 'var(--bg)' : 'var(--text-muted)',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
