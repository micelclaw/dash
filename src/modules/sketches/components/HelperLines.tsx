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

import { useReactFlow } from '@xyflow/react';
import type { HelperLine } from '../hooks/use-helper-lines';

interface HelperLinesProps {
  lines: HelperLine[];
}

/**
 * Renders alignment guide lines as an SVG overlay inside the ReactFlow viewport.
 * Lines are drawn in flow coordinates and span the visible viewport area.
 */
export function HelperLines({ lines }: HelperLinesProps) {
  const { getViewport } = useReactFlow();

  if (lines.length === 0) return null;

  const vp = getViewport();
  // We render in screen space inside the canvas container
  // so we need to figure out the visible flow-space bounds
  // For simplicity, render a large fixed range that covers most use cases
  const EXTENT = 10000;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      <g transform={`translate(${vp.x}, ${vp.y}) scale(${vp.zoom})`}>
        {lines.map((line, i) => {
          if (line.type === 'vertical') {
            return (
              <line
                key={`v-${i}`}
                x1={line.position}
                y1={-EXTENT}
                x2={line.position}
                y2={EXTENT}
                stroke="#06b6d4"
                strokeWidth={1 / vp.zoom}
                strokeDasharray={`${4 / vp.zoom} ${3 / vp.zoom}`}
                strokeOpacity={0.7}
              />
            );
          }
          return (
            <line
              key={`h-${i}`}
              x1={-EXTENT}
              y1={line.position}
              x2={EXTENT}
              y2={line.position}
              stroke="#06b6d4"
              strokeWidth={1 / vp.zoom}
              strokeDasharray={`${4 / vp.zoom} ${3 / vp.zoom}`}
              strokeOpacity={0.7}
            />
          );
        })}
      </g>
    </svg>
  );
}
