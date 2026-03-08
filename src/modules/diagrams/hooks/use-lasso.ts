import { useState, useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';

export interface LassoState {
  points: { x: number; y: number }[];
  isDrawing: boolean;
}

/**
 * Point-in-polygon using ray casting algorithm.
 */
function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Hook for lasso (freeform) selection.
 * Activate with Shift+drag on the canvas pane.
 */
export function useLasso(
  nodes: Node[],
  onSelect: (nodeIds: string[]) => void,
  screenToFlow: (pos: { x: number; y: number }) => { x: number; y: number },
) {
  const [lasso, setLasso] = useState<LassoState>({ points: [], isDrawing: false });
  const flowPointsRef = useRef<{ x: number; y: number }[]>([]);

  const startLasso = useCallback((screenX: number, screenY: number) => {
    const flowPt = screenToFlow({ x: screenX, y: screenY });
    flowPointsRef.current = [flowPt];
    setLasso({ points: [{ x: screenX, y: screenY }], isDrawing: true });
  }, [screenToFlow]);

  const updateLasso = useCallback((screenX: number, screenY: number) => {
    const flowPt = screenToFlow({ x: screenX, y: screenY });
    flowPointsRef.current.push(flowPt);
    setLasso((prev) => ({
      ...prev,
      points: [...prev.points, { x: screenX, y: screenY }],
    }));
  }, [screenToFlow]);

  const endLasso = useCallback(() => {
    const polygon = flowPointsRef.current;
    if (polygon.length < 3) {
      setLasso({ points: [], isDrawing: false });
      return;
    }

    // Find nodes whose center is inside the polygon
    const selected: string[] = [];
    for (const node of nodes) {
      const w = node.width ?? node.measured?.width ?? 160;
      const h = node.height ?? node.measured?.height ?? 70;
      const cx = node.position.x + w / 2;
      const cy = node.position.y + h / 2;
      if (pointInPolygon(cx, cy, polygon)) {
        selected.push(node.id);
      }
    }

    if (selected.length > 0) {
      onSelect(selected);
    }

    flowPointsRef.current = [];
    setLasso({ points: [], isDrawing: false });
  }, [nodes, onSelect]);

  const cancelLasso = useCallback(() => {
    flowPointsRef.current = [];
    setLasso({ points: [], isDrawing: false });
  }, []);

  return { lasso, startLasso, updateLasso, endLasso, cancelLasso };
}
