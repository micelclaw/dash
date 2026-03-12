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

import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { NodeShapeType } from '../types';
import { VALID_NODE_TYPES } from '../types';

export function useDragToCanvas() {
  const reactFlow = useReactFlow();
  const addNode = useDiagramsStore((s) => s.addNode);
  const settings = useDiagramsStore((s) => s.settings);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const shapeType = event.dataTransfer.getData('application/diagram-shape') as NodeShapeType;
      if (!shapeType || !VALID_NODE_TYPES.includes(shapeType)) return;

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Snap to grid if enabled
      if (settings.snapToGrid) {
        const gs = settings.gridSize;
        position.x = Math.round(position.x / gs) * gs;
        position.y = Math.round(position.y / gs) * gs;
      }

      addNode(shapeType, position);
    },
    [reactFlow, addNode, settings],
  );

  return { onDrop, onDragOver };
}
