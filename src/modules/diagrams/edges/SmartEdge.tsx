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

import { memo } from 'react';
import { SmartBezierEdge as SmartBezierBase } from '@tisoap/react-flow-smart-edge';
import { EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { DiagramEdgeData } from '../types';
import { resolveMarker } from './markers';

function SmartEdgeInner(props: EdgeProps) {
  const edgeData = props.data as DiagramEdgeData | undefined;
  const strokeColor = edgeData?.color || 'var(--text-dim, #64748b)';
  const strokeWidth = edgeData?.strokeWidth || 1.5;
  const dashArray = edgeData?.dashed ? '6 3' : undefined;

  const markerEnd = resolveMarker(edgeData?.markerEnd, edgeData?.color || '#64748b');
  const markerStart = resolveMarker(edgeData?.markerStart, edgeData?.color || '#64748b');

  return (
    <>
      <SmartBezierBase
        {...props}
        label={undefined} // We render our own label below
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          filter: props.selected ? 'drop-shadow(0 0 3px var(--amber, #d4a017))' : undefined,
        }}
      />
      {props.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${(props.sourceX + props.targetX) / 2}px,${(props.sourceY + props.targetY) / 2}px)`,
              pointerEvents: 'all',
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--font-sans, system-ui)',
              color: 'var(--text, #e2e8f0)',
              background: edgeData?.labelBgColor || 'var(--surface, #1e1e1e)',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--border, #333)',
            }}
            className="nodrag nopan"
          >
            {props.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SmartEdge = memo(SmartEdgeInner);
