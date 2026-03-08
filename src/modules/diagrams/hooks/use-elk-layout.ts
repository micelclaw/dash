import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { useDiagramsStore } from '@/stores/diagrams.store';

const elk = new ELK();

export type ElkAlgorithm = 'layered' | 'stress' | 'mrtree' | 'radial' | 'force';

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 70;

const ALGORITHM_OPTIONS: Record<ElkAlgorithm, Record<string, string>> = {
  layered: {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    'elk.spacing.nodeNode': '50',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  },
  stress: {
    'elk.algorithm': 'stress',
    'elk.stress.desiredEdgeLength': '150',
    'elk.spacing.nodeNode': '60',
  },
  mrtree: {
    'elk.algorithm': 'mrtree',
    'elk.mrtree.spacing.nodeNode': '40',
    'elk.spacing.nodeNode': '50',
  },
  radial: {
    'elk.algorithm': 'radial',
    'elk.radial.radius': '200',
    'elk.spacing.nodeNode': '50',
  },
  force: {
    'elk.algorithm': 'force',
    'elk.force.temperature': '0.01',
    'elk.spacing.nodeNode': '80',
  },
};

/**
 * Hook that provides elk-based layout algorithms.
 * Supports: layered, stress, mrtree, radial, force.
 * Animates nodes from old to new positions.
 */
export function useElkLayout() {
  const reactFlow = useReactFlow();

  const applyElkLayout = useCallback(
    async (algorithm: ElkAlgorithm, selectedOnly = false) => {
      const { nodes, edges, setNodes } = useDiagramsStore.getState();
      if (nodes.length === 0) return;

      const targetNodes = selectedOnly
        ? nodes.filter((n) => n.selected)
        : nodes;

      if (targetNodes.length === 0) return;

      const targetIds = new Set(targetNodes.map((n) => n.id));

      // Build elk graph
      const elkGraph: ElkNode = {
        id: 'root',
        layoutOptions: {
          ...ALGORITHM_OPTIONS[algorithm],
          'elk.padding': '[top=50,left=50,bottom=50,right=50]',
        },
        children: targetNodes.map((node) => ({
          id: node.id,
          width: node.width ?? node.measured?.width ?? DEFAULT_NODE_WIDTH,
          height: node.height ?? node.measured?.height ?? DEFAULT_NODE_HEIGHT,
        })),
        edges: edges
          .filter((e) => targetIds.has(e.source) && targetIds.has(e.target))
          .map((e) => ({
            id: e.id,
            sources: [e.source],
            targets: [e.target],
          })),
      };

      try {
        const result = await elk.layout(elkGraph);

        if (!result.children) return;

        // Build position map from elk result
        const positionMap = new Map<string, { x: number; y: number }>();
        for (const child of result.children) {
          if (child.x != null && child.y != null) {
            positionMap.set(child.id, { x: child.x, y: child.y });
          }
        }

        // Store original positions for animation
        const originalPositions = new Map<string, { x: number; y: number }>();
        for (const node of nodes) {
          if (positionMap.has(node.id)) {
            originalPositions.set(node.id, { ...node.position });
          }
        }

        // Animate with requestAnimationFrame
        const DURATION = 400;
        const startTime = performance.now();

        function animate(now: number) {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / DURATION, 1);
          // ease-out cubic
          const ease = 1 - Math.pow(1 - t, 3);

          const { nodes: currentNodes } = useDiagramsStore.getState();
          const animated = currentNodes.map((node) => {
            const target = positionMap.get(node.id);
            const origin = originalPositions.get(node.id);
            if (!target || !origin) return node;

            return {
              ...node,
              position: {
                x: origin.x + (target.x - origin.x) * ease,
                y: origin.y + (target.y - origin.y) * ease,
              },
            };
          });

          setNodes(animated);

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            // Fit view after animation
            requestAnimationFrame(() => {
              reactFlow.fitView({ padding: 0.15, duration: 200 });
            });
          }
        }

        requestAnimationFrame(animate);
      } catch {
        // Fallback: apply without animation if elk fails
        console.warn('ELK layout failed, skipping');
      }
    },
    [reactFlow],
  );

  return { applyElkLayout };
}
