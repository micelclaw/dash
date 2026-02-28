import * as d3 from 'd3';
import type { GraphNode, GraphEdge } from '@/types/intelligence';
import {
  entityTypeColor, entityTypeShape, nodeSize, heatColor,
  linkColor, linkDashArray, linkStrokeWidth, expandPolygon,
} from './graph-utils';
import { svgShapePath } from './graph-svg-shapes';
import type { NodeShape } from './graph-utils';

// ─── Types ──────────────────────────────────────────────────────────

export interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  _r: number; // computed radius
}

export interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  _edge: GraphEdge;
}

export interface D3GraphConfig {
  svgElement: SVGSVGElement;
  width: number;
  height: number;
  onNodeClick: (node: SimNode) => void;
  onNodeHover: (node: SimNode | null, event: MouseEvent | null) => void;
  onEdgeClick: (edge: GraphEdge, event: MouseEvent) => void;
}

export interface D3GraphUpdateParams {
  nodes: GraphNode[];
  edges: GraphEdge[];
  heatMapMode: boolean;
  showHulls: boolean;
  highlightNodeIds: Set<string>;
  highlightEdgeIds: Set<string>;
  searchMatches: Set<string> | null;
  visibleNodeIds: Set<string>;
}

export interface D3GraphInstance {
  update(params: D3GraphUpdateParams): void;
  resize(width: number, height: number): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;
  freeze(): void;
  unfreeze(): void;
  isFrozen(): boolean;
  centerOnNode(nodeId: string): void;
  setExternalHover(nodeId: string | null): void;
  destroy(): void;
}

// ─── Constants ──────────────────────────────────────────────────────

const LABEL_HIDE_THRESHOLD = 200;
const TICK_REDUCE_THRESHOLD = 500;
const HULL_PADDING = 35;

// Entity types distributed radially for grouping forces
const TYPE_ORDER = ['person', 'project', 'location', 'topic', 'organization', 'event'];

// ─── Factory ────────────────────────────────────────────────────────

export function createD3Graph(config: D3GraphConfig): D3GraphInstance {
  let { width, height } = config;
  const svg = d3.select(config.svgElement);

  // State
  let simNodes: SimNode[] = [];
  let simLinks: SimLink[] = [];
  let simulation: d3.ForceSimulation<SimNode, SimLink> | null = null;
  let frozen = false;
  let frameId: number | null = null;
  let currentHeatMode = false;
  let currentShowHulls = false;
  let currentHighlightNodeIds = new Set<string>();
  let currentHighlightEdgeIds = new Set<string>();
  let currentSearchMatches: Set<string> | null = null;
  let hoveredNodeId: string | null = null;

  // ─── Init SVG structure ─────────────────────────────────────────

  svg.selectAll('*').remove();
  svg.attr('width', width).attr('height', height);

  // Defs — glow filter
  const defs = svg.append('defs');
  const glowFilter = defs.append('filter').attr('id', 'glow');
  glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  glowFilter.append('feMerge')
    .call(m => { m.append('feMergeNode').attr('in', 'blur'); m.append('feMergeNode').attr('in', 'SourceGraphic'); });

  const zoomContainer = svg.append('g').attr('class', 'zoom-container');
  const hullGroup = zoomContainer.append('g').attr('class', 'layer-hulls');
  const hullLabelGroup = zoomContainer.append('g').attr('class', 'layer-hull-labels');
  const linkGroup = zoomContainer.append('g').attr('class', 'layer-links');
  const nodeGroup = zoomContainer.append('g').attr('class', 'layer-nodes');
  const labelGroup = zoomContainer.append('g').attr('class', 'layer-labels');

  // ─── Zoom ───────────────────────────────────────────────────────

  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => {
      zoomContainer.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);
  // Prevent default double-click zoom
  svg.on('dblclick.zoom', null);

  // ─── Drag ───────────────────────────────────────────────────────

  const dragBehavior = d3.drag<SVGGElement, SimNode>()
    .on('start', (event, d) => {
      if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active && simulation) simulation.alphaTarget(0);
      if (!frozen) { d.fx = null; d.fy = null; }
    });

  // ─── Group centers (for clustering force) ───────────────────────

  function groupCenterX(entityType: string): number {
    const idx = TYPE_ORDER.indexOf(entityType);
    if (idx < 0) return width / 2;
    const angle = (Math.PI * 2 * idx) / TYPE_ORDER.length - Math.PI / 2;
    return width / 2 + Math.min(width, height) * 0.30 * Math.cos(angle);
  }

  function groupCenterY(entityType: string): number {
    const idx = TYPE_ORDER.indexOf(entityType);
    if (idx < 0) return height / 2;
    const angle = (Math.PI * 2 * idx) / TYPE_ORDER.length - Math.PI / 2;
    return height / 2 + Math.min(width, height) * 0.30 * Math.sin(angle);
  }

  // ─── Simulation ─────────────────────────────────────────────────

  function createSimulation() {
    if (simulation) simulation.stop();

    const nodeCount = simNodes.length;

    simulation = d3.forceSimulation<SimNode, SimLink>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
        .id(d => d.id)
        .distance(100)
        .strength(d => d._edge.strength ?? 0.3)
      )
      .force('charge', d3.forceManyBody<SimNode>()
        .strength(-400)
        .distanceMax(500)
      )
      .force('collision', d3.forceCollide<SimNode>()
        .radius(d => d._r + 15)
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('x', d3.forceX<SimNode>().x(d => groupCenterX(d.entity_type)).strength(0.10))
      .force('y', d3.forceY<SimNode>().y(d => groupCenterY(d.entity_type)).strength(0.10))
      .alphaDecay(nodeCount > TICK_REDUCE_THRESHOLD ? 0.05 : 0.02)
      .velocityDecay(0.3);

    let skipFrame = false;
    simulation.on('tick', () => {
      // Performance: skip alternate frames for large graphs
      if (nodeCount > TICK_REDUCE_THRESHOLD) {
        skipFrame = !skipFrame;
        if (skipFrame) return;
      }
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        tickHandler();
        frameId = null;
      });
    });
  }

  // ─── Tick handler ───────────────────────────────────────────────

  function tickHandler() {
    // Update node positions
    nodeGroup.selectAll<SVGGElement, SimNode>('.graph-node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Update link positions
    linkGroup.selectAll<SVGLineElement, SimLink>('.graph-link')
      .attr('x1', d => (d.source as SimNode).x)
      .attr('y1', d => (d.source as SimNode).y)
      .attr('x2', d => (d.target as SimNode).x)
      .attr('y2', d => (d.target as SimNode).y);

    // Update label positions
    labelGroup.selectAll<SVGTextElement, SimNode>('.node-label')
      .attr('x', d => d.x)
      .attr('y', d => d.y + d._r + 12);

    // Update hulls (skip if settled)
    if (simulation && simulation.alpha() > 0.001) {
      computeHulls();
    }
  }

  // ─── Hull computation ───────────────────────────────────────────

  function computeHulls() {
    if (!currentShowHulls || currentHeatMode) {
      hullGroup.selectAll('.cluster-hull').remove();
      hullLabelGroup.selectAll('.hull-label').remove();
      return;
    }

    const groups = d3.group(simNodes, d => d.entity_type);
    const hullData: Array<{ type: string; points: [number, number][] }> = [];

    groups.forEach((groupNodes, type) => {
      if (groupNodes.length < 5) return;
      const pts: [number, number][] = groupNodes.map(n => [n.x, n.y]);
      const hull = d3.polygonHull(pts);
      if (hull) {
        hullData.push({ type, points: expandPolygon(hull, HULL_PADDING) });
      }
    });

    // Hulls
    const hullSel = hullGroup.selectAll<SVGPathElement, (typeof hullData)[0]>('.cluster-hull')
      .data(hullData, d => d.type);
    hullSel.exit().remove();
    const hullLine = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed);
    hullSel.enter().append('path').attr('class', 'cluster-hull')
      .merge(hullSel)
      .attr('d', d => hullLine(d.points))
      .attr('fill', d => entityTypeColor(d.type) + '0a')
      .attr('stroke', d => entityTypeColor(d.type) + '33')
      .attr('stroke-dasharray', '6 4')
      .attr('stroke-width', 1);

    // Hull labels
    const labelSel = hullLabelGroup.selectAll<SVGTextElement, (typeof hullData)[0]>('.hull-label')
      .data(hullData, d => d.type);
    labelSel.exit().remove();
    labelSel.enter().append('text').attr('class', 'hull-label')
      .merge(labelSel)
      .attr('x', d => d3.mean(d.points, p => p[0]) ?? 0)
      .attr('y', d => (d3.min(d.points, p => p[1]) ?? 0) - 12)
      .text(d => d.type.toUpperCase())
      .attr('fill', d => entityTypeColor(d.type) + '40')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-sans)')
      .attr('text-anchor', 'middle')
      .attr('letter-spacing', '0.08em')
      .attr('pointer-events', 'none');
  }

  // ─── Data binding ───────────────────────────────────────────────

  function bindData() {
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    // ── Links ──
    const linkSel = linkGroup.selectAll<SVGLineElement, SimLink>('.graph-link')
      .data(simLinks, d => d._edge.id);

    linkSel.exit().remove();

    const linkEnter = linkSel.enter().append('line')
      .attr('class', 'graph-link')
      .attr('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        config.onEdgeClick(d._edge, event);
      });

    linkEnter.merge(linkSel)
      .attr('stroke', d => {
        if (currentHighlightEdgeIds.size > 0 && currentHighlightEdgeIds.has(d._edge.id)) return '#fbbf24';
        if (currentHeatMode) return heatColor(d._edge.heat_edge);
        const targetId = typeof d.target === 'object' ? (d.target as SimNode).id : d.target;
        const targetNode = nodeMap.get(targetId as string);
        return linkColor(d._edge.link_type, targetNode?.entity_type);
      })
      .attr('stroke-width', d => {
        if (currentHighlightEdgeIds.size > 0 && currentHighlightEdgeIds.has(d._edge.id)) return 3;
        if (currentHeatMode) return 0.5 + d._edge.heat_edge * 3;
        if (d._edge.link_type === 'structural') return 3;
        return linkStrokeWidth(d._edge.strength);
      })
      .attr('stroke-dasharray', d => {
        if (currentHeatMode) return null;
        return linkDashArray(d._edge.link_type);
      })
      .attr('stroke-opacity', d => {
        if (currentHighlightEdgeIds.size > 0) return currentHighlightEdgeIds.has(d._edge.id) ? 0.8 : 0.05;
        return 0.15;
      });

    // ── Nodes ──
    const nodeSel = nodeGroup.selectAll<SVGGElement, SimNode>('.graph-node')
      .data(simNodes, d => d.id);

    nodeSel.exit().remove();

    const nodeEnter = nodeSel.enter().append('g')
      .attr('class', 'graph-node')
      .attr('cursor', 'pointer')
      .call(dragBehavior)
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        config.onNodeClick(d);
      })
      .on('mouseenter', (event: MouseEvent, d) => {
        hoveredNodeId = d.id;
        applyHoverDimming(d.id);
        config.onNodeHover(d, event);
      })
      .on('mouseleave', () => {
        hoveredNodeId = null;
        clearHoverDimming();
        config.onNodeHover(null, null);
      });

    // Build node visuals
    nodeEnter.each(function (d) {
      const g = d3.select(this);
      const r = d._r;
      const color = currentHeatMode ? heatColor(d.heat_score) : entityTypeColor(d.entity_type);
      const shape: NodeShape = currentHeatMode ? 'circle' : entityTypeShape(d.entity_type);

      // Solid background to occlude edges behind node
      const bgPath = svgShapePath(shape, r);
      if (bgPath) {
        g.append('path').attr('class', 'node-bg').attr('d', bgPath).attr('fill', '#0c0c10');
      } else {
        g.append('circle').attr('class', 'node-bg').attr('r', r).attr('fill', '#0c0c10');
      }

      // Halo
      const dPath = svgShapePath(shape, r + 6);
      if (dPath) {
        g.append('path').attr('class', 'node-halo')
          .attr('d', dPath).attr('fill', color + '08').attr('stroke', 'none');
      } else {
        g.append('circle').attr('class', 'node-halo')
          .attr('r', r + 6).attr('fill', color + '08').attr('stroke', 'none');
      }

      // Main shape
      const mainPath = svgShapePath(shape, r);
      if (mainPath) {
        g.append('path').attr('class', 'node-shape')
          .attr('d', mainPath).attr('fill', color + '18').attr('stroke', color).attr('stroke-width', 1.5);
      } else {
        g.append('circle').attr('class', 'node-shape')
          .attr('r', r).attr('fill', color + '18').attr('stroke', color).attr('stroke-width', 1.5);
      }
    });

    // Update existing node colors (for heat map toggle / highlight changes)
    nodeSel.each(function (d) {
      const g = d3.select(this);
      const r = d._r;
      const color = currentHeatMode ? heatColor(d.heat_score) : entityTypeColor(d.entity_type);
      const shape: NodeShape = currentHeatMode ? 'circle' : entityTypeShape(d.entity_type);

      // Rebuild bg + halo + shape on mode change
      g.selectAll('.node-bg, .node-halo, .node-shape').remove();

      // Solid background
      const bgPath = svgShapePath(shape, r);
      if (bgPath) {
        g.append('path').attr('class', 'node-bg').attr('d', bgPath).attr('fill', '#0c0c10');
      } else {
        g.append('circle').attr('class', 'node-bg').attr('r', r).attr('fill', '#0c0c10');
      }

      const dPath = svgShapePath(shape, r + 6);
      if (dPath) {
        g.append('path').attr('class', 'node-halo')
          .attr('d', dPath).attr('fill', color + '08').attr('stroke', 'none');
      } else {
        g.append('circle').attr('class', 'node-halo')
          .attr('r', r + 6).attr('fill', color + '08').attr('stroke', 'none');
      }

      const mainPath = svgShapePath(shape, r);
      if (mainPath) {
        g.append('path').attr('class', 'node-shape')
          .attr('d', mainPath).attr('fill', color + '18').attr('stroke', color).attr('stroke-width', 1.5);
      } else {
        g.append('circle').attr('class', 'node-shape')
          .attr('r', r).attr('fill', color + '18').attr('stroke', color).attr('stroke-width', 1.5);
      }
    });

    // Apply highlight / search dimming on nodes
    nodeGroup.selectAll<SVGGElement, SimNode>('.graph-node')
      .attr('opacity', d => {
        if (currentHighlightNodeIds.size > 0 && !currentHighlightNodeIds.has(d.id)) return 0.15;
        if (currentSearchMatches !== null && !currentSearchMatches.has(d.id)) return 0.15;
        return 1;
      })
      .attr('filter', d => {
        if (currentHighlightNodeIds.size > 0 && currentHighlightNodeIds.has(d.id)) return 'url(#glow)';
        if (currentHeatMode && d.heat_score > 0.2) return 'url(#glow)';
        return 'none';
      });

    // ── Labels ──
    const nodeCount = simNodes.length;
    const showLabels = nodeCount <= LABEL_HIDE_THRESHOLD;
    labelGroup.attr('display', showLabels ? null : 'none');

    const labelSel = labelGroup.selectAll<SVGTextElement, SimNode>('.node-label')
      .data(simNodes, d => d.id);

    labelSel.exit().remove();

    labelSel.enter().append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-sans)')
      .attr('pointer-events', 'none')
      .merge(labelSel)
      .text(d => d.name)
      .attr('fill', d => {
        if (currentSearchMatches !== null && !currentSearchMatches.has(d.id)) return 'rgba(255,255,255,0.15)';
        return 'rgba(255,255,255,0.7)';
      })
      .attr('opacity', d => {
        if (currentHighlightNodeIds.size > 0 && !currentHighlightNodeIds.has(d.id)) return 0.15;
        return 1;
      });
  }

  // ─── Hover dimming ──────────────────────────────────────────────

  function applyHoverDimming(nodeId: string) {
    const connectedIds = new Set<string>();
    connectedIds.add(nodeId);
    for (const link of simLinks) {
      const sId = typeof link.source === 'object' ? (link.source as SimNode).id : link.source;
      const tId = typeof link.target === 'object' ? (link.target as SimNode).id : link.target;
      if (sId === nodeId) connectedIds.add(tId as string);
      if (tId === nodeId) connectedIds.add(sId as string);
    }

    nodeGroup.selectAll<SVGGElement, SimNode>('.graph-node')
      .attr('opacity', d => d.id === nodeId ? 1 : connectedIds.has(d.id) ? 0.7 : 0.15)
      .attr('filter', d => d.id === nodeId ? 'url(#glow)' : 'none');

    linkGroup.selectAll<SVGLineElement, SimLink>('.graph-link')
      .attr('stroke-opacity', d => {
        const sId = typeof d.source === 'object' ? (d.source as SimNode).id : d.source;
        const tId = typeof d.target === 'object' ? (d.target as SimNode).id : d.target;
        return (sId === nodeId || tId === nodeId) ? 0.7 : 0.05;
      });

    labelGroup.selectAll<SVGTextElement, SimNode>('.node-label')
      .attr('opacity', d => connectedIds.has(d.id) ? 0.9 : 0.1);

    // Show label for hovered node even when labels are hidden
    if (simNodes.length > LABEL_HIDE_THRESHOLD) {
      const hNode = simNodes.find(n => n.id === nodeId);
      if (hNode) {
        const tempLabel = labelGroup.append('text')
          .attr('class', 'node-label-hover')
          .attr('x', hNode.x)
          .attr('y', hNode.y + hNode._r + 12)
          .text(hNode.name)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('font-family', 'var(--font-sans)')
          .attr('fill', 'rgba(255,255,255,0.9)')
          .attr('pointer-events', 'none');
        // Also show connected node labels
        for (const id of connectedIds) {
          if (id === nodeId) continue;
          const n = simNodes.find(nn => nn.id === id);
          if (n) {
            labelGroup.append('text')
              .attr('class', 'node-label-hover')
              .attr('x', n.x).attr('y', n.y + n._r + 12)
              .text(n.name)
              .attr('text-anchor', 'middle')
              .attr('font-size', '10px')
              .attr('font-family', 'var(--font-sans)')
              .attr('fill', 'rgba(255,255,255,0.5)')
              .attr('pointer-events', 'none');
          }
        }
        // suppress unused var warning
        void tempLabel;
      }
    }
  }

  function clearHoverDimming() {
    // Remove temp hover labels
    labelGroup.selectAll('.node-label-hover').remove();

    // Restore opacity based on current highlight/search state
    nodeGroup.selectAll<SVGGElement, SimNode>('.graph-node')
      .attr('opacity', d => {
        if (currentHighlightNodeIds.size > 0 && !currentHighlightNodeIds.has(d.id)) return 0.15;
        if (currentSearchMatches !== null && !currentSearchMatches.has(d.id)) return 0.15;
        return 1;
      });

    linkGroup.selectAll<SVGLineElement, SimLink>('.graph-link')
      .attr('stroke-opacity', d => {
        if (currentHighlightEdgeIds.size > 0) return currentHighlightEdgeIds.has(d._edge.id) ? 0.8 : 0.05;
        return 0.15;
      });

    labelGroup.selectAll<SVGTextElement, SimNode>('.node-label')
      .attr('opacity', d => {
        if (currentHighlightNodeIds.size > 0 && !currentHighlightNodeIds.has(d.id)) return 0.15;
        return 1;
      });
  }

  // ─── Public API ─────────────────────────────────────────────────

  function update(params: D3GraphUpdateParams) {
    currentHeatMode = params.heatMapMode;
    currentShowHulls = params.showHulls;
    currentHighlightNodeIds = params.highlightNodeIds;
    currentHighlightEdgeIds = params.highlightEdgeIds;
    currentSearchMatches = params.searchMatches;

    // Build filtered node list
    const filteredNodes = params.nodes.filter(n => params.visibleNodeIds.has(n.id));
    const visibleIds = new Set(filteredNodes.map(n => n.id));

    // Preserve existing positions for nodes that stay
    const oldPosMap = new Map(simNodes.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));

    simNodes = filteredNodes.map(n => {
      const old = oldPosMap.get(n.id);
      return {
        ...n,
        x: old?.x ?? width / 2 + (Math.random() - 0.5) * 100,
        y: old?.y ?? height / 2 + (Math.random() - 0.5) * 100,
        vx: old?.vx ?? 0,
        vy: old?.vy ?? 0,
        fx: null,
        fy: null,
        _r: nodeSize(n.mention_count) / 2,
      };
    });

    simLinks = params.edges
      .filter(e => visibleIds.has(e.source_id) && visibleIds.has(e.target_id))
      .map(e => ({ source: e.source_id, target: e.target_id, _edge: e }) as unknown as SimLink);

    bindData();
    createSimulation();

    if (frozen && simulation) {
      simulation.stop();
      simNodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
    }
  }

  function resize(w: number, h: number) {
    width = w;
    height = h;
    svg.attr('width', width).attr('height', height);
    if (simulation) {
      const centerForce = simulation.force('center') as d3.ForceCenter<SimNode> | undefined;
      if (centerForce) centerForce.x(width / 2).y(height / 2);
      simulation.alpha(0.1).restart();
    }
  }

  function zoomIn() {
    svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3);
  }

  function zoomOut() {
    svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7);
  }

  function zoomReset() {
    svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
  }

  function freezeGraph() {
    frozen = true;
    if (simulation) simulation.stop();
    simNodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
  }

  function unfreezeGraph() {
    frozen = false;
    simNodes.forEach(n => { n.fx = null; n.fy = null; });
    if (simulation) simulation.alpha(0.3).restart();
  }

  function centerOnNode(nodeId: string) {
    const node = simNodes.find(n => n.id === nodeId);
    if (!node) return;
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(1.5)
      .translate(-node.x, -node.y);
    svg.transition().duration(500).call(zoomBehavior.transform, transform);
  }

  function setExternalHover(nodeId: string | null) {
    if (nodeId) {
      hoveredNodeId = nodeId;
      applyHoverDimming(nodeId);
    } else {
      hoveredNodeId = null;
      clearHoverDimming();
    }
  }

  function destroy() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (simulation) simulation.stop();
    svg.selectAll('*').remove();
    svg.on('.zoom', null);
  }

  return {
    update,
    resize,
    zoomIn,
    zoomOut,
    zoomReset,
    freeze: freezeGraph,
    unfreeze: unfreezeGraph,
    isFrozen: () => frozen,
    centerOnNode,
    setExternalHover,
    destroy,
  };
}
