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
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getStraightPath,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { DiagramEdgeData } from '../types';
import { resolveMarker } from './markers';
import '../diagrams.css';

/** Unique counter for particle path IDs */
let pathIdCounter = 0;

function LabeledEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as DiagramEdgeData | undefined;
  const pathType = edgeData?.pathType || 'smoothstep';

  // Compute path based on type
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  const pathParams = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };

  if (pathType === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath(pathParams);
  } else if (pathType === 'default') {
    [edgePath, labelX, labelY] = getBezierPath(pathParams);
  } else if (pathType === 'step') {
    [edgePath, labelX, labelY] = getSmoothStepPath({ ...pathParams, borderRadius: 0 });
  } else {
    // smoothstep (default)
    [edgePath, labelX, labelY] = getSmoothStepPath(pathParams);
  }

  const strokeColor = edgeData?.color || 'var(--text-dim, #64748b)';
  const strokeWidth = edgeData?.strokeWidth || 1.5;
  const dashArray = edgeData?.dashed ? '6 3' : undefined;
  const markerEnd = resolveMarker(edgeData?.markerEnd, edgeData?.color || '#64748b');
  const markerStart = resolveMarker(edgeData?.markerStart, edgeData?.color || '#64748b');

  const showDataFlow = !!edgeData?.dataFlow;
  const showGlow = !!edgeData?.glow;

  // Stable path ID for offset-path
  const pathElId = `edge-path-${id}-${++pathIdCounter}`;

  return (
    <>
      {/* Hidden path for particle offset-path */}
      {showDataFlow && (
        <path id={pathElId} d={edgePath} fill="none" stroke="none" />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          filter: selected
            ? 'drop-shadow(0 0 3px var(--amber, #d4a017))'
            : showGlow
              ? undefined
              : undefined,
          animation: showGlow ? 'diagram-glow 2s ease-in-out infinite' : undefined,
          ['--glow-color' as string]: showGlow ? (edgeData?.color || '#d4a017') : undefined,
        }}
      />

      {/* Data flow particles */}
      {showDataFlow && (
        <>
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              r={3}
              fill={edgeData?.color || 'var(--amber, #d4a017)'}
              style={{
                offsetPath: `path("${edgePath}")`,
                offsetDistance: '0%',
                animation: `diagram-particle 2s linear infinite`,
                animationDelay: `${i * 0.66}s`,
              }}
            />
          ))}
        </>
      )}

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
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
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LabeledEdge = memo(LabeledEdgeInner);
