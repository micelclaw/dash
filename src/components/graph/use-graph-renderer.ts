import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { GraphNode, GraphEdge } from '@/types/intelligence';
import { createD3Graph, type D3GraphInstance, type SimNode } from './d3-graph-renderer';

export interface UseGraphRendererParams {
  nodes: GraphNode[];
  edges: GraphEdge[];
  heatMapMode: boolean;
  highlightNodeIds: Set<string>;
  highlightEdgeIds: Set<string>;
  searchQuery: string;
  categoryFilters: Record<string, boolean>;
  onNodeClick: (node: GraphNode) => void;
  externalHoverNodeId?: string | null;
  width: number;
  height: number;
}

export function useGraphRenderer(params: UseGraphRendererParams) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const instanceRef = useRef<D3GraphInstance | null>(null);

  // Hover / click overlay state
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredNodePos, setHoveredNodePos] = useState<{ x: number; y: number } | null>(null);
  const [clickedEdge, setClickedEdge] = useState<GraphEdge | null>(null);
  const [clickedEdgePos, setClickedEdgePos] = useState<{ x: number; y: number } | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [showHulls, setShowHulls] = useState(false);

  // Stable callback ref to avoid recreating D3 instance when parent re-renders
  const callbacksRef = useRef({ onNodeClick: params.onNodeClick });
  callbacksRef.current.onNodeClick = params.onNodeClick;

  // ── Derived data ──────────────────────────────────────────────────

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of params.nodes) {
      if (params.categoryFilters[n.entity_type] !== false) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [params.nodes, params.categoryFilters]);

  const searchMatches = useMemo(() => {
    if (!params.searchQuery.trim()) return null;
    const q = params.searchQuery.toLowerCase();
    const matches = new Set<string>();
    for (const n of params.nodes) {
      if (
        n.name.toLowerCase().includes(q) ||
        (n.aliases ?? []).some((a: string) => a.toLowerCase().includes(q))
      ) {
        matches.add(n.id);
      }
    }
    return matches;
  }, [params.nodes, params.searchQuery]);

  // ── Create / destroy D3 instance (mount / unmount only) ──────────

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const instance = createD3Graph({
      svgElement: svgEl,
      width: params.width || 800,
      height: params.height || 600,
      onNodeClick: (node: SimNode) => {
        callbacksRef.current.onNodeClick(node);
      },
      onNodeHover: (node: SimNode | null, event: MouseEvent | null) => {
        setHoveredNode(node);
        setHoveredNodePos(event ? { x: event.clientX, y: event.clientY } : null);
      },
      onEdgeClick: (edge: GraphEdge, event: MouseEvent) => {
        setClickedEdge(edge);
        setClickedEdgePos({ x: event.clientX, y: event.clientY });
      },
    });

    instanceRef.current = instance;

    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize ────────────────────────────────────────────────────────

  useEffect(() => {
    if (params.width > 0 && params.height > 0) {
      instanceRef.current?.resize(params.width, params.height);
    }
  }, [params.width, params.height]);

  // ── Push data updates to D3 ───────────────────────────────────────

  useEffect(() => {
    instanceRef.current?.update({
      nodes: params.nodes,
      edges: params.edges,
      heatMapMode: params.heatMapMode,
      showHulls,
      highlightNodeIds: params.highlightNodeIds,
      highlightEdgeIds: params.highlightEdgeIds,
      searchMatches,
      visibleNodeIds,
    });
  }, [
    params.nodes, params.edges, params.heatMapMode,
    params.highlightNodeIds, params.highlightEdgeIds,
    searchMatches, visibleNodeIds, showHulls,
  ]);

  // ── External hover (from detail panel) ──────────────────────────────

  useEffect(() => {
    instanceRef.current?.setExternalHover(params.externalHoverNodeId ?? null);
  }, [params.externalHoverNodeId]);

  // ── Zoom controls ─────────────────────────────────────────────────

  const zoomIn = useCallback(() => instanceRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => instanceRef.current?.zoomOut(), []);
  const zoomReset = useCallback(() => instanceRef.current?.zoomReset(), []);

  const toggleFreeze = useCallback(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    if (inst.isFrozen()) {
      inst.unfreeze();
      setFrozen(false);
    } else {
      inst.freeze();
      setFrozen(true);
    }
  }, []);

  const toggleHulls = useCallback(() => setShowHulls(v => !v), []);

  const centerOnNode = useCallback((nodeId: string) => {
    instanceRef.current?.centerOnNode(nodeId);
  }, []);

  const closeEdgePopover = useCallback(() => {
    setClickedEdge(null);
    setClickedEdgePos(null);
  }, []);

  return {
    svgRef,
    hoveredNode,
    hoveredNodePosition: hoveredNodePos,
    clickedEdge,
    clickedEdgePosition: clickedEdgePos,
    closeEdgePopover,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleFreeze,
    frozen,
    toggleHulls,
    showHulls,
    centerOnNode,
  };
}
