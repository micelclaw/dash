import type { GraphNode, GraphEdge } from '@/types/intelligence';
import { useGraphRenderer } from './use-graph-renderer';
import { GraphNodeTooltip } from './GraphNodeTooltip';
import { GraphEdgePopover } from './GraphEdgePopover';
import { GraphZoomControls } from './GraphZoomControls';
import { GraphLegend } from './GraphLegend';

interface GraphCanvasProps {
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

export function GraphCanvas({
  nodes, edges, heatMapMode,
  highlightNodeIds, highlightEdgeIds, searchQuery,
  categoryFilters,
  onNodeClick,
  externalHoverNodeId,
  width, height,
}: GraphCanvasProps) {
  const {
    svgRef,
    hoveredNode,
    hoveredNodePosition,
    clickedEdge,
    clickedEdgePosition,
    closeEdgePopover,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleFreeze,
    frozen,
    toggleHulls,
    showHulls,
  } = useGraphRenderer({
    nodes, edges, heatMapMode,
    highlightNodeIds, highlightEdgeIds,
    searchQuery, categoryFilters,
    onNodeClick, externalHoverNodeId,
    width, height,
  });

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block', background: 'transparent' }}
      />

      {/* Overlays */}
      <GraphNodeTooltip node={hoveredNode} position={hoveredNodePosition} />
      <GraphEdgePopover edge={clickedEdge} position={clickedEdgePosition} onClose={closeEdgePopover} />
      <GraphZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onToggleFreeze={toggleFreeze}
        frozen={frozen}
        onToggleHulls={toggleHulls}
        showHulls={showHulls}
      />
      <GraphLegend heatMapMode={heatMapMode} />
    </div>
  );
}
