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

import { Grid2x2, Rotate3d } from 'lucide-react';

interface GraphDimensionToggleProps {
  is3D: boolean;
  onChange: (is3D: boolean) => void;
}

const OPTIONS: Array<{ key: boolean; label: string; Icon: typeof Grid2x2; title: string }> = [
  { key: false, label: '2D', Icon: Grid2x2, title: 'Vista 2D (plana)' },
  { key: true, label: '3D', Icon: Rotate3d, title: 'Vista 3D (WebGL)' },
];

/** Segmented control para alternar entre la vista 2D (SVG) y la 3D (WebGL) del grafo. */
export function GraphDimensionToggle({ is3D, onChange }: GraphDimensionToggleProps) {
  return (
    <div style={{ display: 'flex', borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {OPTIONS.map(({ key, label, Icon, title }) => {
        const isActive = is3D === key;
        return (
          <button
            key={label}
            onClick={() => onChange(key)}
            title={title}
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
              background: isActive ? 'var(--amber)' : 'transparent',
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
