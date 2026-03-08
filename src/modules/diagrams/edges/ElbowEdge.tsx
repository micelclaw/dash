import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, Position } from '@xyflow/react';
import type { DiagramEdgeData } from '../types';
import { resolveMarker } from './markers';

/**
 * ElbowEdge — clean 90° angled edge with minimal bends.
 * Creates an L-shape or Z-shape path depending on node positions.
 */
function ElbowEdgeInner({
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

  // Compute elbow path
  const edgePath = computeElbowPath(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition);
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

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

export const ElbowEdge = memo(ElbowEdgeInner);

function computeElbowPath(
  sx: number, sy: number,
  tx: number, ty: number,
  sourcePos: Position, targetPos: Position,
): string {
  const OFFSET = 20;

  // Vertical source → vertical target (Top/Bottom → Top/Bottom)
  if (isVertical(sourcePos) && isVertical(targetPos)) {
    const midY = (sy + ty) / 2;
    return `M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`;
  }

  // Horizontal source → horizontal target (Left/Right → Left/Right)
  if (isHorizontal(sourcePos) && isHorizontal(targetPos)) {
    const midX = (sx + tx) / 2;
    return `M ${sx},${sy} L ${midX},${sy} L ${midX},${ty} L ${tx},${ty}`;
  }

  // Vertical source → horizontal target (or vice versa): L-shape
  if (isVertical(sourcePos) && isHorizontal(targetPos)) {
    return `M ${sx},${sy} L ${sx},${ty} L ${tx},${ty}`;
  }

  if (isHorizontal(sourcePos) && isVertical(targetPos)) {
    return `M ${sx},${sy} L ${tx},${sy} L ${tx},${ty}`;
  }

  // Fallback: Z-shape via midpoint
  const midY = sy + (sourcePos === Position.Bottom ? OFFSET : -OFFSET);
  return `M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`;
}

function isVertical(pos: Position): boolean {
  return pos === Position.Top || pos === Position.Bottom;
}

function isHorizontal(pos: Position): boolean {
  return pos === Position.Left || pos === Position.Right;
}
