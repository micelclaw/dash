import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { useIntelligenceStore } from '@/stores/intelligence.store';
import { GraphCanvas } from './GraphCanvas';
import { GraphDetailPanel } from './GraphDetailPanel';
import { GraphSearchInput } from './GraphSearchInput';
import { GraphCategoryFilters } from './GraphCategoryFilters';
import { GraphPathFinder } from './GraphPathFinder';
import { GraphHeatMapToggle } from './GraphHeatMapToggle';
import type { GraphNode, GraphEdge } from '@/types/intelligence';

interface GraphViewModalProps {
  open: boolean;
  onClose: () => void;
  centerEntityId?: string;
}

export function GraphViewModal({ open, onClose, centerEntityId }: GraphViewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchSubgraph = useIntelligenceStore(s => s.fetchSubgraph);

  // Data
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ entities: number; edges: number }>({ entities: 0, edges: 0 });

  // UI state
  const [nodeLimit, setNodeLimit] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [heatMapMode, setHeatMapMode] = useState(false);
  const [pathMode, setPathMode] = useState(false);
  const [highlightNodeIds, setHighlightNodeIds] = useState<Set<string>>(new Set());
  const [highlightEdgeIds, setHighlightEdgeIds] = useState<Set<string>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<Record<string, boolean>>({});
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Click state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailHoverEntityId, setDetailHoverEntityId] = useState<string | null>(null);

  // Path finder
  const pathFinder = GraphPathFinder({
    active: pathMode,
    onToggle: () => setPathMode(p => !p),
    onPathFound: (nodeIds, edgeIds) => {
      setHighlightNodeIds(new Set(nodeIds));
      setHighlightEdgeIds(new Set(edgeIds));
    },
    onClearPath: () => {
      setHighlightNodeIds(new Set());
      setHighlightEdgeIds(new Set());
    },
  });

  // Load subgraph
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchSubgraph({ limit: nodeLimit, centerId: centerEntityId })
      .then(subgraph => {
        if (subgraph) {
          setNodes(subgraph.nodes);
          setEdges(subgraph.edges);
          setStats({
            entities: subgraph.meta.total_entities,
            edges: subgraph.meta.total_edges,
          });
          // Auto-select the center entity or first node
          const autoSelect = centerEntityId
            ? subgraph.nodes.find(n => n.id === centerEntityId)
            : subgraph.nodes[0];
          if (autoSelect) setSelectedNode(autoSelect);
        }
      })
      .finally(() => setLoading(false));
  }, [open, centerEntityId, nodeLimit, fetchSubgraph]);

  // Resize observer
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (pathMode) {
      pathFinder.handleNodeSelect(node.id);
      return;
    }
    setSelectedNode(node);
  }, [pathMode, pathFinder]);

  const handleCenterEntity = useCallback((entityId: string) => {
    // If the entity is already in the current graph, just select it
    const targetNode = nodes.find(n => n.id === entityId);
    if (targetNode) {
      setSelectedNode(targetNode);
      return;
    }
    // Otherwise re-fetch subgraph centered on this entity
    setLoading(true);
    fetchSubgraph({ limit: nodeLimit, centerId: entityId })
      .then(subgraph => {
        if (subgraph) {
          setNodes(subgraph.nodes);
          setEdges(subgraph.edges);
          setStats({ entities: subgraph.meta.total_entities, edges: subgraph.meta.total_edges });
          const newNode = subgraph.nodes.find(n => n.id === entityId);
          if (newNode) setSelectedNode(newNode);
        }
      })
      .finally(() => setLoading(false));
  }, [nodes, nodeLimit, fetchSubgraph]);

  const toggleCategory = useCallback((type: string) => {
    setCategoryFilters(prev => ({
      ...prev,
      [type]: prev[type] === false ? true : false,
    }));
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 400,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <Maximize2 size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
          Knowledge Graph
        </span>

        <div style={{ flex: 1 }} />

        <GraphSearchInput value={searchQuery} onChange={setSearchQuery} />
        <GraphCategoryFilters enabled={categoryFilters} onToggle={toggleCategory} />
        {pathFinder.ui}
        <GraphHeatMapToggle active={heatMapMode} onToggle={() => setHeatMapMode(p => !p)} />

        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 4, display: 'flex',
            marginLeft: 8,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Canvas area */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              Loading graph...
            </div>
          ) : nodes.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 8,
              color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              <Maximize2 size={32} style={{ opacity: 0.3 }} />
              No entities in graph yet
            </div>
          ) : (
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              heatMapMode={heatMapMode}
              highlightNodeIds={highlightNodeIds}
              highlightEdgeIds={highlightEdgeIds}
              searchQuery={searchQuery}
              categoryFilters={categoryFilters}
              onNodeClick={handleNodeClick}
              externalHoverNodeId={detailHoverEntityId}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>

        {/* Detail panel — always visible */}
        <GraphDetailPanel
          node={selectedNode}
          graphNodes={nodes}
          graphEdges={edges}
          onCenterEntity={handleCenterEntity}
          onEntityHover={setDetailHoverEntityId}
          onNavigateAway={onClose}
        />
      </div>

      {/* Footer stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '4px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        fontSize: '0.6875rem',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <span>{stats.entities} entities</span>
        <span>{stats.edges} connections</span>
        <span>Showing {nodes.length} of {stats.entities}</span>
        {heatMapMode && <span style={{ color: '#f43f5e' }}>Heat map</span>}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ marginRight: 4 }}>Limit:</span>
          {[100, 250, 500, 2000].map(n => {
            const label = n === 2000 ? 'All' : String(n);
            const active = nodeLimit === n;
            return (
              <button
                key={n}
                onClick={() => setNodeLimit(n)}
                style={{
                  background: active ? 'var(--amber)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--text-muted)',
                  border: active ? 'none' : '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: '0.625rem',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  lineHeight: '16px',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
