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

// ─── Studio v2 — Shared resize handle ──────────────────────────────
//
// Visual + interactive handle for `react-resizable-panels`. 4px thick,
// neutral by default, ámbar on hover/drag. Used between every Panel in
// the BuildPhase split so the user can drag-redimension every viewport.

import { PanelResizeHandle } from 'react-resizable-panels';
import { useState } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  ariaLabel?: string;
}

export function ResizeHandle({ direction, ariaLabel }: Props) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isHorizontal = direction === 'horizontal';
  const active = hovered || dragging;
  const thickness = 4;
  return (
    <PanelResizeHandle
      onDragging={setDragging}
      style={{
        width: isHorizontal ? thickness : '100%',
        height: isHorizontal ? '100%' : thickness,
        background: active ? 'var(--amber)' : 'var(--border)',
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        flexShrink: 0,
        transition: 'background 80ms ease',
        outline: 'none',
      }}
    >
      <div
        aria-label={ariaLabel}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: '100%', height: '100%' }}
      />
    </PanelResizeHandle>
  );
}
