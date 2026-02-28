import { useState, useCallback } from 'react';
import { Route, X } from 'lucide-react';
import { api } from '@/services/api';
import type { GraphNode, GraphEdge } from '@/types/intelligence';

interface GraphPathFinderProps {
  active: boolean;
  onToggle: () => void;
  onPathFound: (nodeIds: string[], edgeIds: string[]) => void;
  onClearPath: () => void;
}

export function GraphPathFinder({ active, onToggle, onPathFound, onClearPath }: GraphPathFinderProps) {
  const [nodeA, setNodeA] = useState<string | null>(null);
  const [nodeB, setNodeB] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setNodeA(null);
    setNodeB(null);
    onClearPath();
  }, [onClearPath]);

  const handleNodeSelect = useCallback(async (nodeId: string) => {
    if (!active) return;

    if (!nodeA) {
      setNodeA(nodeId);
      return;
    }
    if (nodeA === nodeId) return;

    setNodeB(nodeId);
    setLoading(true);
    try {
      const res = await api.get<{ data: { nodes: GraphNode[]; edges: GraphEdge[] } }>(
        `/graph/path?from=${nodeA}&to=${nodeId}`,
      );
      const path = res.data;
      onPathFound(
        path.nodes.map(n => n.id),
        path.edges.map(e => e.id),
      );
    } catch {
      // Path not found, clear
      reset();
    } finally {
      setLoading(false);
    }
  }, [active, nodeA, onPathFound, reset]);

  return {
    ui: (
      <button
        onClick={() => {
          if (active) {
            reset();
            onToggle();
          } else {
            onToggle();
          }
        }}
        title={active ? 'Exit path finder' : 'Find path between entities'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
          background: active ? 'var(--amber-dim)' : 'transparent',
          color: active ? 'var(--amber)' : 'var(--text-dim)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        {active ? <X size={12} /> : <Route size={12} />}
        {active
          ? loading
            ? 'Finding...'
            : nodeA
              ? 'Click target node'
              : 'Click start node'
          : 'Path'}
      </button>
    ),
    handleNodeSelect,
  };
}
