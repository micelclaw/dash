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

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Maximize2, Network, FileText } from 'lucide-react';
import { useIntelligenceStore } from '@/stores/intelligence.store';
import { GraphCanvas } from './GraphCanvas';
import { GraphDetailPanel } from './GraphDetailPanel';
import { GraphSearchInput } from './GraphSearchInput';
import { GraphCategoryFilters } from './GraphCategoryFilters';
import { GraphHeatMapToggle } from './GraphHeatMapToggle';
import type { GraphNode, GraphEdge } from '@/types/intelligence';

type GraphMode = 'entities' | 'records';

const RECORD_DOMAIN: Record<string, string> = {
  note: 'notes', contact: 'contacts', email: 'emails',
  event: 'events', file: 'files', diary: 'diary_entries',
};

interface GraphViewModalProps {
  open: boolean;
  onClose: () => void;
  centerEntityId?: string;
}

export function GraphViewModal({ open, onClose, centerEntityId }: GraphViewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchSubgraph = useIntelligenceStore(s => s.fetchSubgraph);
  const fetchRecordSubgraph = useIntelligenceStore(s => s.fetchRecordSubgraph);

  // Data
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ entities: number; edges: number }>({ entities: 0, edges: 0 });

  // UI state
  const [graphMode, setGraphMode] = useState<GraphMode>('entities');
  const [nodeLimit, setNodeLimit] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [heatMapMode, setHeatMapMode] = useState(false);
  const [highlightNodeIds, setHighlightNodeIds] = useState<Set<string>>(new Set());
  const [highlightEdgeIds, setHighlightEdgeIds] = useState<Set<string>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<Record<string, boolean>>({});
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Navigation state — tracks the current center for subgraph fetching
  const [centerId, setCenterId] = useState<string | null>(centerEntityId ?? null);
  const [centerType, setCenterType] = useState<string | null>(null);

  // Click state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailHoverEntityId, setDetailHoverEntityId] = useState<string | null>(null);

  // Compute degree centrality for record mode nodes
  const applyDegree = (graphNodes: GraphNode[], graphEdges: GraphEdge[]) => {
    const degree = new Map<string, number>();
    for (const e of graphEdges) {
      degree.set(e.source_id, (degree.get(e.source_id) || 0) + 1);
      degree.set(e.target_id, (degree.get(e.target_id) || 0) + 1);
    }
    for (const n of graphNodes) {
      n.mention_count = degree.get(n.id) || 0;
    }
  };

  // Load subgraph — re-runs when center, limit, or mode changes
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setHighlightNodeIds(new Set());
    setHighlightEdgeIds(new Set());

    const fetchFn = graphMode === 'records'
      ? fetchRecordSubgraph({
          limit: nodeLimit,
          centerId: centerId ?? undefined,
          centerType: centerId && centerType ? RECORD_DOMAIN[centerType] : undefined,
        })
      : fetchSubgraph({ limit: nodeLimit, centerId: centerId ?? undefined });

    fetchFn
      .then(subgraph => {
        if (subgraph) {
          const fetchedNodes = subgraph.nodes;
          const fetchedEdges = subgraph.edges;

          if (graphMode === 'records') {
            applyDegree(fetchedNodes, fetchedEdges);
          }

          setNodes(fetchedNodes);
          setEdges(fetchedEdges);
          setStats({
            entities: subgraph.meta.total_entities,
            edges: subgraph.meta.total_edges,
          });
          // Auto-select center node or first node
          if (centerId) {
            const centerNode = fetchedNodes.find(n => n.id === centerId);
            if (centerNode) setSelectedNode(centerNode);
            else if (fetchedNodes[0]) setSelectedNode(fetchedNodes[0]);
          } else if (fetchedNodes[0]) {
            setSelectedNode(fetchedNodes[0]);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [open, centerId, centerType, nodeLimit, graphMode, fetchSubgraph, fetchRecordSubgraph]);

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
    setSelectedNode(node);
    // Re-center the subgraph around the clicked node
    if (node.id !== centerId) {
      setCenterId(node.id);
      setCenterType(node.entity_type);
    }
  }, [centerId]);

  const handleCenterEntity = useCallback((entityId: string) => {
    // Look up entity_type from current nodes for record mode centering
    const targetNode = nodes.find(n => n.id === entityId);
    setCenterId(entityId);
    setCenterType(targetNode?.entity_type ?? null);
  }, [nodes]);

  const toggleCategory = useCallback((type: string) => {
    setCategoryFilters(prev => ({
      ...prev,
      [type]: prev[type] === false ? true : false,
    }));
  }, []);

  if (!open) return null;

  const isRecords = graphMode === 'records';
  const modeLabel = isRecords ? 'records' : 'entities';

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

        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          borderRadius: 6,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          marginLeft: 8,
        }}>
          {(['entities', 'records'] as const).map(mode => {
            const active = graphMode === mode;
            const ModeIcon = mode === 'entities' ? Network : FileText;
            return (
              <button
                key={mode}
                onClick={() => {
                  setGraphMode(mode);
                  setCenterId(null);
                  setCenterType(null);
                  setCategoryFilters({});
                  setSearchQuery('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  fontWeight: active ? 600 : 400,
                  fontFamily: 'var(--font-sans)',
                  background: active ? 'var(--amber)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--text-muted)',
                  textTransform: 'capitalize',
                }}
              >
                <ModeIcon size={12} />
                {mode}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <GraphSearchInput value={searchQuery} onChange={setSearchQuery} />
        <GraphCategoryFilters enabled={categoryFilters} onToggle={toggleCategory} mode={graphMode} />
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
              {isRecords ? 'No connected records found' : 'No entities in graph yet'}
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
              mode={graphMode}
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
          mode={graphMode}
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
        <span>{stats.entities} {modeLabel}</span>
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
