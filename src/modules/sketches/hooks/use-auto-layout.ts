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
import dagreModule from '@dagrejs/dagre';
import { useDiagramsStore } from '@/stores/diagrams.store';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 70;

// Handle ESM/CJS interop — Vite may wrap the module differently
const dagre = (dagreModule as Record<string, unknown>).default
  ? ((dagreModule as Record<string, unknown>).default as typeof dagreModule)
  : dagreModule;

export function useAutoLayout() {
  const reactFlow = useReactFlow();

  const applyLayout = useCallback(
    (direction: LayoutDirection) => {
      const { nodes, edges, setNodes } = useDiagramsStore.getState();
      if (nodes.length === 0) return;

      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({
        rankdir: direction,
        nodesep: 60,
        ranksep: 80,
        marginx: 50,
        marginy: 50,
      });

      for (const node of nodes) {
        g.setNode(node.id, {
          width: node.width || DEFAULT_NODE_WIDTH,
          height: node.height || DEFAULT_NODE_HEIGHT,
        });
      }

      for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
      }

      dagre.layout(g);

      const layoutedNodes = nodes.map((node) => {
        const layoutNode = g.node(node.id);
        if (!layoutNode) return node;
        const w = node.width || DEFAULT_NODE_WIDTH;
        const h = node.height || DEFAULT_NODE_HEIGHT;
        return {
          ...node,
          position: {
            x: layoutNode.x - w / 2,
            y: layoutNode.y - h / 2,
          },
        };
      });

      setNodes(layoutedNodes);

      // Fit view after layout settles
      requestAnimationFrame(() => {
        reactFlow.fitView({ padding: 0.15, duration: 300 });
      });
    },
    [reactFlow],
  );

  return { applyLayout };
}
