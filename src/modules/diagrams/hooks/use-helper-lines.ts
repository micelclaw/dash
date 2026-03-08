import { useCallback, useRef, useState } from 'react';
import type { Node, NodeChange } from '@xyflow/react';

const THRESHOLD = 5; // px snap threshold in flow coordinates

export interface HelperLine {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
}

interface NodeBounds {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

function getNodeBounds(node: Node): NodeBounds {
  const w = node.width ?? node.measured?.width ?? 160;
  const h = node.height ?? node.measured?.height ?? 70;
  return {
    id: node.id,
    left: node.position.x,
    right: node.position.x + w,
    top: node.position.y,
    bottom: node.position.y + h,
    centerX: node.position.x + w / 2,
    centerY: node.position.y + h / 2,
    width: w,
    height: h,
  };
}

/**
 * Hook that computes helper/alignment lines during node drag.
 * Returns helper lines to render and a wrapper for onNodesChange that applies snapping.
 */
export function useHelperLines(nodes: Node[], enabled: boolean) {
  const [helperLines, setHelperLines] = useState<HelperLine[]>([]);
  const helperLinesRef = useRef<HelperLine[]>([]);
  helperLinesRef.current = helperLines;

  const applyHelperLines = useCallback(
    (changes: NodeChange<Node>[]): NodeChange<Node>[] => {
      if (!enabled) {
        if (helperLinesRef.current.length > 0) setHelperLines([]);
        return changes;
      }

      // Find position changes that are currently dragging
      const positionChanges = changes.filter(
        (c): c is NodeChange<Node> & { type: 'position'; position: { x: number; y: number }; dragging: boolean } =>
          c.type === 'position' && 'dragging' in c && (c as any).dragging === true && (c as any).position != null,
      );

      if (positionChanges.length === 0) {
        if (helperLinesRef.current.length > 0) setHelperLines([]);
        return changes;
      }

      const draggingIds = new Set(positionChanges.map((c) => c.id));
      const staticNodes = nodes.filter((n) => !draggingIds.has(n.id));

      if (staticNodes.length === 0) {
        if (helperLinesRef.current.length > 0) setHelperLines([]);
        return changes;
      }

      const staticBounds = staticNodes.map(getNodeBounds);
      const lines: HelperLine[] = [];

      for (const change of positionChanges) {
        const dragNode = nodes.find((n) => n.id === change.id);
        if (!dragNode) continue;

        const pos = (change as any).position as { x: number; y: number };
        const w = dragNode.width ?? dragNode.measured?.width ?? 160;
        const h = dragNode.height ?? dragNode.measured?.height ?? 70;

        const dragBounds: NodeBounds = {
          id: dragNode.id,
          left: pos.x,
          right: pos.x + w,
          top: pos.y,
          bottom: pos.y + h,
          centerX: pos.x + w / 2,
          centerY: pos.y + h / 2,
          width: w,
          height: h,
        };

        let snapX: number | null = null;
        let snapY: number | null = null;
        let bestDx = THRESHOLD;
        let bestDy = THRESHOLD;

        for (const sb of staticBounds) {
          // Vertical alignment checks (snap X)
          const xChecks = [
            { drag: dragBounds.left, static: sb.left },       // left-left
            { drag: dragBounds.right, static: sb.right },     // right-right
            { drag: dragBounds.centerX, static: sb.centerX }, // center-center
            { drag: dragBounds.left, static: sb.right },      // left-right
            { drag: dragBounds.right, static: sb.left },      // right-left
          ];

          for (const { drag, static: stat } of xChecks) {
            const dx = Math.abs(drag - stat);
            if (dx < bestDx) {
              bestDx = dx;
              snapX = stat - (drag - pos.x);
              lines.push({ type: 'vertical', position: stat });
            }
          }

          // Horizontal alignment checks (snap Y)
          const yChecks = [
            { drag: dragBounds.top, static: sb.top },         // top-top
            { drag: dragBounds.bottom, static: sb.bottom },   // bottom-bottom
            { drag: dragBounds.centerY, static: sb.centerY }, // center-center
            { drag: dragBounds.top, static: sb.bottom },      // top-bottom
            { drag: dragBounds.bottom, static: sb.top },      // bottom-top
          ];

          for (const { drag, static: stat } of yChecks) {
            const dy = Math.abs(drag - stat);
            if (dy < bestDy) {
              bestDy = dy;
              snapY = stat - (drag - pos.y);
              lines.push({ type: 'horizontal', position: stat });
            }
          }
        }

        // Apply snap
        if (snapX !== null) (change as any).position.x = snapX;
        if (snapY !== null) (change as any).position.y = snapY;
      }

      // Deduplicate and keep only the closest lines
      const uniqueLines: HelperLine[] = [];
      const seen = new Set<string>();
      for (const line of lines) {
        const key = `${line.type}-${Math.round(line.position)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueLines.push(line);
        }
      }

      setHelperLines(uniqueLines);
      return changes;
    },
    [nodes, enabled],
  );

  return { helperLines, applyHelperLines };
}
