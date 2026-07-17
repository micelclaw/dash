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

import type { GraphNode, GraphEdge, GraphColorMode, GraphCommunity } from '@/types/intelligence';
import { useGraphRenderer } from './use-graph-renderer';
import { GraphNodeTooltip } from './GraphNodeTooltip';
import { GraphEdgePopover } from './GraphEdgePopover';
import { GraphZoomControls } from './GraphZoomControls';
import { GraphLegend } from './GraphLegend';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colorMode: GraphColorMode;
  communities?: GraphCommunity[];
  highlightNodeIds: Set<string>;
  highlightEdgeIds: Set<string>;
  pathEndpointIds?: Set<string>;
  egoNodeIds?: Set<string> | null;
  searchQuery: string;
  categoryFilters: Record<string, boolean>;
  onNodeClick: (node: GraphNode, event?: MouseEvent) => void;
  onResetGraph?: () => void;
  externalHoverNodeId?: string | null;
  selectedNodeId?: string | null;
  strengthThreshold?: number;
  width: number;
  height: number;
  mode?: 'entities' | 'records';
  is3D: boolean;
  on3DUnavailable?: () => void;
  // Ego-red por grados (stepper +/− en la botonera).
  egoDegree?: number;
  egoEnabled?: boolean;
  onEgoPlus?: () => void;
  onEgoMinus?: () => void;
}

export function GraphCanvas({
  nodes, edges, colorMode, communities,
  highlightNodeIds, highlightEdgeIds, pathEndpointIds, egoNodeIds, searchQuery,
  categoryFilters,
  onNodeClick,
  onResetGraph,
  externalHoverNodeId,
  selectedNodeId,
  strengthThreshold,
  width, height,
  mode = 'entities',
  is3D,
  on3DUnavailable,
  egoDegree, egoEnabled, onEgoPlus, onEgoMinus,
}: GraphCanvasProps) {
  const {
    svgRef,
    heatCanvasRef,
    containerRef,
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
    fov,
    setFov,
  } = useGraphRenderer({
    nodes, edges, colorMode, communities,
    highlightNodeIds, highlightEdgeIds, pathEndpointIds, egoNodeIds,
    searchQuery, categoryFilters,
    onNodeClick, externalHoverNodeId, selectedNodeId,
    strengthThreshold,
    width, height,
    // Records: mostrar nombres pero truncados a 2 líneas (antes se ocultaban del todo).
    hideLabels: false,
    compactLabels: mode === 'records',
    is3D,
    on3DUnavailable,
  });

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      {is3D ? (
        <>
          {/* Campo de calor DETRÁS del WebGL: el renderer 3D pinta aquí los mismos
              splats radiales que el 2D. El orden del DOM basta para el apilado (heat
              primero = detrás; contenedor WebGL después = encima; overlays al final =
              encima de todo). SIN z-index: poner z-index al contenedor lo elevaba por
              encima de los controles de zoom/FOV (sin z-index) y los volvía inpulsables. */}
          <canvas
            ref={heatCanvasRef}
            width={width}
            height={height}
            style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}
          />
          {/* El renderer 3D crea su propio canvas WebGL dentro del contenedor. */}
          <div
            ref={containerRef}
            style={{ width, height, position: 'absolute', inset: 0, overflow: 'hidden' }}
          />
        </>
      ) : (
        <>
          <canvas
            ref={heatCanvasRef}
            width={width}
            height={height}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height,
              pointerEvents: 'none',
            }}
          />
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ display: 'block', background: 'transparent', position: 'relative' }}
          />
        </>
      )}

      {/* Overlays */}
      <GraphNodeTooltip node={hoveredNode} position={hoveredNodePosition} />
      <GraphEdgePopover edge={clickedEdge} position={clickedEdgePosition} onClose={closeEdgePopover} />
      <GraphZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={() => { zoomReset(); onResetGraph?.(); }}
        onToggleFreeze={toggleFreeze}
        frozen={frozen}
        onToggleHulls={toggleHulls}
        showHulls={showHulls}
        is3D={is3D}
        fov={fov}
        onFovChange={setFov}
        egoDegree={egoDegree}
        egoEnabled={egoEnabled}
        onEgoPlus={onEgoPlus}
        onEgoMinus={onEgoMinus}
      />
      <GraphLegend colorMode={colorMode} communities={communities} mode={mode} />
    </div>
  );
}
