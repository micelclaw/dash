import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { DiagramEdgeData } from '../types';
import { resolveMarker } from './markers';

/**
 * CurvedEdge — smooth bezier curve.
 * Uses getBezierPath with curvature derived from the source/target distance.
 */
function CurvedEdgeInner({
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
  const strokeColor = edgeData?.color || 'var(--text-dim, #64748b)';
  const strokeWidth = edgeData?.strokeWidth || 1.5;
  const dashArray = edgeData?.dashed ? '6 3' : undefined;
  const markerEnd = resolveMarker(edgeData?.markerEnd, edgeData?.color || '#64748b');
  const markerStart = resolveMarker(edgeData?.markerStart, edgeData?.color || '#64748b');

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          filter: selected ? 'drop-shadow(0 0 3px var(--amber, #d4a017))' : undefined,
        }}
      />
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

export const CurvedEdge = memo(CurvedEdgeInner);
