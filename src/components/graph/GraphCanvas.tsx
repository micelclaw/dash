import { useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  entityTypeColor, entityTypeShape, nodeSize,
  drawNodeShape, heatColor,
} from './graph-utils';
import type { GraphNode, GraphEdge } from '@/types/intelligence';

interface ForceNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface ForceLink {
  source: string | ForceNode;
  target: string | ForceNode;
  _edge: GraphEdge;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  heatMapMode: boolean;
  highlightNodeIds: Set<string>;
  highlightEdgeIds: Set<string>;
  searchQuery: string;
  categoryFilters: Record<string, boolean>;
  onNodeClick: (node: GraphNode) => void;
  width: number;
  height: number;
}

export function GraphCanvas({
  nodes, edges, heatMapMode,
  highlightNodeIds, highlightEdgeIds, searchQuery,
  categoryFilters,
  onNodeClick,
  width, height,
}: GraphCanvasProps) {
  const fgRef = useRef<any>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Filter nodes by category
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of nodes) {
      if (categoryFilters[n.entity_type] !== false) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [nodes, categoryFilters]);

  // Search matching
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const matches = new Set<string>();
    for (const n of nodes) {
      if (
        n.name.toLowerCase().includes(q) ||
        (n.aliases ?? []).some(a => a.toLowerCase().includes(q))
      ) {
        matches.add(n.id);
      }
    }
    return matches;
  }, [nodes, searchQuery]);

  const graphData = useMemo(() => {
    const filteredNodes = nodes.filter(n => visibleNodeIds.has(n.id));
    const filteredLinks: ForceLink[] = edges
      .filter(e => visibleNodeIds.has(e.source_id) && visibleNodeIds.has(e.target_id))
      .map(e => ({ source: e.source_id, target: e.target_id, _edge: e }));
    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, edges, visibleNodeIds]);

  const nodeCanvasObject = useCallback((node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const size = nodeSize(node.mention_count) / globalScale;

    // Determine fill & stroke
    let fillColor: string;
    let strokeColor: string;

    if (heatMapMode) {
      fillColor = heatColor(node.heat_score);
      strokeColor = heatColor(node.heat_score);
    } else {
      fillColor = entityTypeColor(node.entity_type);
      strokeColor = entityTypeColor(node.entity_type);
    }

    // Dim if search active but doesn't match
    const isSearchMatch = searchMatches === null || searchMatches.has(node.id);
    const isHighlighted = highlightNodeIds.size === 0 || highlightNodeIds.has(node.id);

    if (!isSearchMatch || !isHighlighted) {
      ctx.globalAlpha = 0.15;
    }

    // Path highlight glow
    if (highlightNodeIds.size > 0 && highlightNodeIds.has(node.id)) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      strokeColor = '#fbbf24';
    }
    // Heat map glow — hot nodes glow brighter
    else if (heatMapMode && node.heat_score > 0.2) {
      ctx.save();
      ctx.shadowColor = heatColor(node.heat_score);
      ctx.shadowBlur = 4 + node.heat_score * 12;
    }

    const shape = heatMapMode ? 'circle' : entityTypeShape(node.entity_type);
    drawNodeShape(ctx, x, y, size, shape, fillColor, strokeColor);

    if ((highlightNodeIds.size > 0 && highlightNodeIds.has(node.id)) || (heatMapMode && node.heat_score > 0.2)) {
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    // Label
    if (globalScale > 1.5 || (searchMatches?.has(node.id))) {
      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSearchMatch ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)';
      ctx.fillText(node.name, x, y + size / 2 + 2 / globalScale);
    }
  }, [heatMapMode, highlightNodeIds, searchMatches]);

  const linkColor = useCallback((link: ForceLink) => {
    const edge = link._edge;
    if (highlightEdgeIds.size > 0 && highlightEdgeIds.has(edge.id)) {
      return '#fbbf24';
    }
    if (heatMapMode) {
      return heatColor(edge.heat_edge);
    }
    return 'rgba(148, 163, 184, 0.25)';
  }, [heatMapMode, highlightEdgeIds]);

  const linkWidth = useCallback((link: ForceLink) => {
    const edge = link._edge;
    if (highlightEdgeIds.size > 0 && highlightEdgeIds.has(edge.id)) return 3;
    if (heatMapMode) return 0.5 + edge.heat_edge * 3;
    return 0.5 + (edge.confidence ?? 0.5) * 1.5;
  }, [heatMapMode, highlightEdgeIds]);

  // Manual click detection — bypasses react-force-graph-2d's broken onNodeClick
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownPos.current || !fgRef.current) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    pointerDownPos.current = null;

    // Only treat as click if pointer moved < 5px (not a pan/drag)
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    // Convert click position to canvas-relative coords
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Find nearest node using graph2ScreenCoords
    let nearest: ForceNode | null = null;
    let nearestDist = Infinity;
    for (const node of graphData.nodes as ForceNode[]) {
      if (node.x == null || node.y == null) continue;
      const screenPos = fgRef.current.graph2ScreenCoords(node.x, node.y);
      const d = Math.sqrt((screenPos.x - clickX) ** 2 + (screenPos.y - clickY) ** 2);
      const hitRadius = Math.max(nodeSize(node.mention_count) / 2, 8) + 4;
      if (d < hitRadius && d < nearestDist) {
        nearestDist = d;
        nearest = node;
      }
    }

    if (nearest) {
      onNodeClick(nearest);
    }
  }, [graphData.nodes, onNodeClick]);

  return (
    <div
      style={{ width, height }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={0}
        enableNodeDrag={true}
        linkHoverPrecision={0}
        backgroundColor="transparent"
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
