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

import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphColorMode, GraphCommunity } from '@/types/intelligence';
import {
  entityTypeColor, entityTypeShape, nodeSize, heatColor, heatColorRGB, communityColor,
  linkColor, linkDashArray, linkStrokeWidth, expandPolygon, significantCommunityIds, wrapLabelLines,
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
  heatCanvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  onNodeClick: (node: SimNode) => void;
  onNodeHover: (node: SimNode | null, event: MouseEvent | null) => void;
  onEdgeClick: (edge: GraphEdge, event: MouseEvent) => void;
}

export interface D3GraphUpdateParams {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colorMode: GraphColorMode;
  communities?: GraphCommunity[];
  showHulls: boolean;
  hideLabels: boolean;
  compactLabels: boolean;
  highlightNodeIds: Set<string>;
  highlightEdgeIds: Set<string>;
  searchMatches: Set<string> | null;
  visibleNodeIds: Set<string>;
  strengthThreshold?: number;
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
  setSelectedNode(nodeId: string | null): void;
  destroy(): void;
}

// ─── Constants ──────────────────────────────────────────────────────

const LABEL_HIDE_THRESHOLD = 400;
const LABEL_MAX_CHARS = 18; // ancho de línea para labels (incl. modo compacto 2 líneas)
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
  let simulation: d3.Simulation<SimNode, SimLink> | null = null;
  let frozen = false;
  let frameId: number | null = null;
  let currentHeatMode = false;
  let currentColorMode: GraphColorMode = 'type';
  let currentShowHulls = false;
  let currentHideLabels = false;
  let currentCompactLabels = false; // records → labels truncadas a 2 líneas (tspans)
  let currentHighlightNodeIds = new Set<string>();
  let currentHighlightEdgeIds = new Set<string>();
  let currentSearchMatches: Set<string> | null = null;
  let currentSelectedNodeId: string | null = null;
  let currentStrengthThreshold = 0;

  // ─── Community-mode state (derived each update) ────────────────
  let currentSignificantSet = new Set<number>();          // community_ids con color/foco propio
  let currentCommunityGridIndex = new Map<number, number>(); // community_id → celda del grid
  let currentCommunityLabels = new Map<number, string>();   // community_id → label (para hulls)
  let currentCommunityGridCols = 1;
  let currentCommunityGridRows = 1;

  // ─── Heat canvas state ────────────────────────────────────────
  const heatCanvas = config.heatCanvas;
  const heatCtx = heatCanvas?.getContext('2d') ?? null;
  let currentZoomTransform = d3.zoomIdentity;
  let heatRenderThrottleId: number | null = null;
  const HEAT_SPLAT_RADIUS = 120;
  const HEAT_BASE_OPACITY = 0.35;

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
      currentZoomTransform = event.transform;
      if (currentHeatMode) scheduleHeatRender();
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

  // ─── Community group centers (re-cluster layout, modo community) ─
  // Cada comunidad significativa ocupa una celda de un grid repartido por el
  // canvas → islas espaciales. El long-tail (gris) cae al centro con fuerza floja.
  const COMMUNITY_GRID_MARGIN = 0.12;

  function communityFocusX(d: SimNode): number {
    const cid = d.community_id;
    const idx = cid != null ? currentCommunityGridIndex.get(cid) : undefined;
    if (idx == null) return width / 2;
    const col = idx % currentCommunityGridCols;
    const usableW = width * (1 - 2 * COMMUNITY_GRID_MARGIN);
    const cellW = usableW / currentCommunityGridCols;
    return width * COMMUNITY_GRID_MARGIN + cellW * (col + 0.5);
  }

  function communityFocusY(d: SimNode): number {
    const cid = d.community_id;
    const idx = cid != null ? currentCommunityGridIndex.get(cid) : undefined;
    if (idx == null) return height / 2;
    const row = Math.floor(idx / currentCommunityGridCols);
    const usableH = height * (1 - 2 * COMMUNITY_GRID_MARGIN);
    const cellH = usableH / currentCommunityGridRows;
    return height * COMMUNITY_GRID_MARGIN + cellH * (row + 0.5);
  }

  // Islas cohesionadas (0.20) vs cola gris floja (0.05) → islas destacan, gris difumina.
  function communityFocusStrength(d: SimNode): number {
    const cid = d.community_id;
    return (cid != null && currentSignificantSet.has(cid)) ? 0.20 : 0.05;
  }

  // ─── Node fill/stroke base color (no-heat) ──────────────────────
  // En modo community: color de la comunidad solo si es significativa; si no, gris.
  function nonHeatNodeColor(d: SimNode): string {
    if (currentColorMode === 'community') {
      const cid = d.community_id;
      return communityColor(cid != null && currentSignificantSet.has(cid) ? cid : null);
    }
    return entityTypeColor(d.entity_type);
  }

  // ─── Simulation ─────────────────────────────────────────────────

  function createSimulation() {
    if (simulation) simulation.stop();

    const nodeCount = simNodes.length;
    const communityMode = currentColorMode === 'community';

    simulation = d3.forceSimulation<SimNode, SimLink>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
        .id(d => d.id)
        .distance(180)
        .strength(d => d._edge.strength ?? 0.3)
      )
      .force('charge', d3.forceManyBody<SimNode>()
        .strength(-800)
        .distanceMax(800)
      )
      .force('collision', d3.forceCollide<SimNode>()
        .radius(d => d._r + 25)
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      // Modo community → re-cluster por comunidad (islas); resto → agrupar por tipo.
      .force('x', d3.forceX<SimNode>()
        .x(d => communityMode ? communityFocusX(d) : groupCenterX(d.entity_type))
        .strength(d => communityMode ? communityFocusStrength(d) : 0.10))
      .force('y', d3.forceY<SimNode>()
        .y(d => communityMode ? communityFocusY(d) : groupCenterY(d.entity_type))
        .strength(d => communityMode ? communityFocusStrength(d) : 0.10))
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

  // ─── Heat background renderer ──────────────────────────────────

  function scheduleHeatRender() {
    if (heatRenderThrottleId !== null) return;
    heatRenderThrottleId = requestAnimationFrame(() => {
      renderHeatBackground();
      heatRenderThrottleId = null;
    });
  }

  function renderHeatBackground() {
    if (!heatCtx || !heatCanvas) return;

    const w = heatCanvas.width;
    const h = heatCanvas.height;

    heatCtx.clearRect(0, 0, w, h);

    if (!currentHeatMode || simNodes.length === 0) return;

    const { x: tx, y: ty, k } = currentZoomTransform;
    heatCtx.save();
    heatCtx.setTransform(k, 0, 0, k, tx, ty);

    for (const node of simNodes) {
      const score = Math.max(node.heat_score, 0.05); // minimum glow for cold nodes

      const splatRadius = HEAT_SPLAT_RADIUS + node._r * 2;
      const rgb = heatColorRGB(score);
      const alpha = HEAT_BASE_OPACITY * Math.max(0.15, score);

      const gradient = heatCtx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, splatRadius,
      );
      gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`);
      gradient.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

      heatCtx.fillStyle = gradient;
      heatCtx.beginPath();
      heatCtx.arc(node.x, node.y, splatRadius, 0, Math.PI * 2);
      heatCtx.fill();
    }

    heatCtx.restore();
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

    // Update label positions. `y` ancla la 1ª línea en el <text>; cada <tspan> lleva su
    // propio `x` (centrado por línea), así que se actualiza por tick.
    labelGroup.selectAll<SVGTextElement, SimNode>('.node-label')
      .attr('y', d => d.y + d._r + 12)
      .each(function (d) {
        d3.select(this).selectAll<SVGTSpanElement, unknown>('tspan').attr('x', d.x);
      });

    // Update hulls (skip if settled)
    if (simulation && simulation.alpha() > 0.001) {
      computeHulls();
    }

    // Update heat background (already inside rAF, call directly)
    if (currentHeatMode) renderHeatBackground();
  }

  // ─── Hull computation ───────────────────────────────────────────

  function computeHulls() {
    const communityMode = currentColorMode === 'community';
    // En modo community los blobs SON la feature → se muestran siempre (ignoran el
    // toggle de hulls). En modo tipo, gobierna el toggle. Heat nunca pinta hulls.
    const shouldShow = currentHeatMode ? false : (communityMode || currentShowHulls);
    if (!shouldShow) {
      hullGroup.selectAll('.cluster-hull').remove();
      hullLabelGroup.selectAll('.hull-label').remove();
      return;
    }

    type HullDatum = { key: string; color: string; label: string; points: [number, number][] };
    const hullData: HullDatum[] = [];

    if (communityMode) {
      // Agrupar por comunidad significativa (≥3 nodos presentes → forma una isla).
      const islandNodes = simNodes.filter(
        n => n.community_id != null && currentSignificantSet.has(n.community_id),
      );
      const groups = d3.group(islandNodes, d => d.community_id as number);
      groups.forEach((groupNodes, cid) => {
        if (groupNodes.length < 3) return;
        const pts: [number, number][] = groupNodes.map(n => [n.x, n.y]);
        const hull = d3.polygonHull(pts);
        if (hull) {
          const label = currentCommunityLabels.get(cid) ?? `Comunidad ${cid}`;
          hullData.push({
            key: `c${cid}`,
            color: communityColor(cid),
            label: label.length > 22 ? label.slice(0, 22) + '…' : label,
            points: expandPolygon(hull, HULL_PADDING),
          });
        }
      });
    } else {
      const groups = d3.group(simNodes, d => d.entity_type);
      groups.forEach((groupNodes, type) => {
        if (groupNodes.length < 5) return;
        const pts: [number, number][] = groupNodes.map(n => [n.x, n.y]);
        const hull = d3.polygonHull(pts);
        if (hull) {
          hullData.push({
            key: type,
            color: entityTypeColor(type),
            label: type.toUpperCase(),
            points: expandPolygon(hull, HULL_PADDING),
          });
        }
      });
    }

    // Blobs más marcados en modo community (relleno/borde sólido) que los hulls de tipo.
    const fillAlpha = communityMode ? '1f' : '0a';
    const strokeAlpha = communityMode ? '66' : '33';
    const labelAlpha = communityMode ? 'cc' : '40';

    // Hulls
    const hullSel = hullGroup.selectAll<SVGPathElement, HullDatum>('.cluster-hull')
      .data(hullData, d => d.key);
    hullSel.exit().remove();
    const hullLine = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed);
    hullSel.enter().append('path').attr('class', 'cluster-hull')
      .merge(hullSel)
      .attr('d', d => hullLine(d.points))
      .attr('fill', d => d.color + fillAlpha)
      .attr('stroke', d => d.color + strokeAlpha)
      .attr('stroke-dasharray', communityMode ? null : '6 4')
      .attr('stroke-width', communityMode ? 1.5 : 1);

    // Hull labels
    const labelSel = hullLabelGroup.selectAll<SVGTextElement, HullDatum>('.hull-label')
      .data(hullData, d => d.key);
    labelSel.exit().remove();
    labelSel.enter().append('text').attr('class', 'hull-label')
      .merge(labelSel)
      .attr('x', d => d3.mean(d.points, p => p[0]) ?? 0)
      .attr('y', d => (d3.min(d.points, p => p[1]) ?? 0) - 12)
      .text(d => d.label)
      .attr('fill', d => d.color + labelAlpha)
      .attr('font-size', communityMode ? '11px' : '10px')
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
        applyHoverDimming(d.id);
        config.onNodeHover(d, event);
      })
      .on('mouseleave', () => {
        clearHoverDimming();
        config.onNodeHover(null, null);
      });

    // Build node visuals
    nodeEnter.each(function (d) {
      const g = d3.select(this);
      const r = d._r;
      // La FORMA siempre refleja el tipo (cuadrado=nota, triángulo=evento…), también en
      // modo Calor (ahí el COLOR es el heat, pero la forma sigue diciendo qué tipo es).
      const shape: NodeShape = entityTypeShape(d.entity_type);

      // In heat mode, use rgba() directly (heatColor returns rgb() which can't take hex alpha suffix)
      let color: string;
      let fill: string;
      let haloFill: string;
      if (currentHeatMode) {
        const rgb = heatColorRGB(d.heat_score);
        color = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        fill = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
        haloFill = `rgba(${rgb.r},${rgb.g},${rgb.b},0.03)`;
      } else {
        color = nonHeatNodeColor(d);
        fill = color + '18';
        haloFill = color + '08';
      }

      // Solid background to occlude edges behind node (skip in heat mode for transparency)
      if (!currentHeatMode) {
        const bgPath = svgShapePath(shape, r);
        if (bgPath) {
          g.append('path').attr('class', 'node-bg').attr('d', bgPath).attr('fill', '#0c0c10');
        } else {
          g.append('circle').attr('class', 'node-bg').attr('r', r).attr('fill', '#0c0c10');
        }
      }

      // Halo
      const dPath = svgShapePath(shape, r + 6);
      if (dPath) {
        g.append('path').attr('class', 'node-halo')
          .attr('d', dPath).attr('fill', haloFill).attr('stroke', 'none');
      } else {
        g.append('circle').attr('class', 'node-halo')
          .attr('r', r + 6).attr('fill', haloFill).attr('stroke', 'none');
      }

      // Main shape
      const mainPath = svgShapePath(shape, r);
      if (mainPath) {
        g.append('path').attr('class', 'node-shape')
          .attr('d', mainPath).attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
      } else {
        g.append('circle').attr('class', 'node-shape')
          .attr('r', r).attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
      }
    });

    // Update existing node colors (for heat map toggle / highlight changes)
    nodeSel.each(function (d) {
      const g = d3.select(this);
      const r = d._r;
      // La FORMA siempre refleja el tipo (cuadrado=nota, triángulo=evento…), también en
      // modo Calor (ahí el COLOR es el heat, pero la forma sigue diciendo qué tipo es).
      const shape: NodeShape = entityTypeShape(d.entity_type);

      let color: string;
      let fill: string;
      let haloFill: string;
      if (currentHeatMode) {
        const rgb = heatColorRGB(d.heat_score);
        color = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        fill = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
        haloFill = `rgba(${rgb.r},${rgb.g},${rgb.b},0.03)`;
      } else {
        color = nonHeatNodeColor(d);
        fill = color + '18';
        haloFill = color + '08';
      }

      // Rebuild bg + halo + shape on mode change
      g.selectAll('.node-bg, .node-halo, .node-shape').remove();

      // Solid background (skip in heat mode for transparency)
      if (!currentHeatMode) {
        const bgPath = svgShapePath(shape, r);
        if (bgPath) {
          g.append('path').attr('class', 'node-bg').attr('d', bgPath).attr('fill', '#0c0c10');
        } else {
          g.append('circle').attr('class', 'node-bg').attr('r', r).attr('fill', '#0c0c10');
        }
      }

      const dPath = svgShapePath(shape, r + 6);
      if (dPath) {
        g.append('path').attr('class', 'node-halo')
          .attr('d', dPath).attr('fill', haloFill).attr('stroke', 'none');
      } else {
        g.append('circle').attr('class', 'node-halo')
          .attr('r', r + 6).attr('fill', haloFill).attr('stroke', 'none');
      }

      const mainPath = svgShapePath(shape, r);
      if (mainPath) {
        g.append('path').attr('class', 'node-shape')
          .attr('d', mainPath).attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
      } else {
        g.append('circle').attr('class', 'node-shape')
          .attr('r', r).attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
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
        if (currentHeatMode) return 'url(#glow)';
        if (d.id === currentSelectedNodeId) return 'url(#glow)';
        return 'none';
      });

    // Re-apply selected node stroke after node rebuild
    applySelectedHighlight();

    // ── Labels ──
    const nodeCount = simNodes.length;
    const showLabels = !currentHideLabels && nodeCount <= LABEL_HIDE_THRESHOLD;

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
      // Modo compacto (records): título en ≤2 líneas truncadas (tspans). Resto: 1 línea, nombre completo.
      // Reconstruir tspans SOLO si cambia el texto (cache en el elemento) → barato en updates.
      .each(function (d) {
        const lines = currentCompactLabels ? wrapLabelLines(d.name, LABEL_MAX_CHARS, 2) : [d.name];
        const key = lines.join('');
        const el = this as SVGTextElement & { __lblKey?: string };
        if (el.__lblKey === key) return;
        el.__lblKey = key;
        const textEl = d3.select(el);
        textEl.selectAll('tspan').remove();
        lines.forEach((ln, i) => {
          textEl.append('tspan')
            .attr('x', d.x)
            .attr('dy', i === 0 ? '0' : '1.1em')
            .text(ln);
        });
      })
      .attr('fill', d => {
        if (currentSearchMatches !== null && !currentSearchMatches.has(d.id)) return 'rgba(255,255,255,0.15)';
        return 'rgba(255,255,255,0.7)';
      })
      .attr('opacity', d => {
        if (!showLabels) return 0;
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
      .attr('opacity', d => {
        if (currentHideLabels || simNodes.length > LABEL_HIDE_THRESHOLD) return 0;
        return connectedIds.has(d.id) ? 0.9 : 0.1;
      });

    // Show temp labels for hovered node + connections when labels are hidden
    if (currentHideLabels || simNodes.length > LABEL_HIDE_THRESHOLD) {
      // Labels de hover = 1 línea siempre (transitorias), truncadas al mismo ancho que las fijas.
      const trunc = (s: string) => s.length > LABEL_MAX_CHARS ? s.slice(0, LABEL_MAX_CHARS) + '…' : s;
      // Only show labels for connected nodes (hovered node already has tooltip)
      {
        for (const id of connectedIds) {
          if (id === nodeId) continue;
          const n = simNodes.find(nn => nn.id === id);
          if (n) {
            labelGroup.append('text')
              .attr('class', 'node-label-hover')
              .attr('x', n.x).attr('y', n.y + n._r + 12)
              .text(trunc(n.name))
              .attr('text-anchor', 'middle')
              .attr('font-size', '10px')
              .attr('font-family', 'var(--font-sans)')
              .attr('fill', 'rgba(255,255,255,0.5)')
              .attr('pointer-events', 'none');
          }
        }
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
        if (currentHideLabels) return 0;
        if (currentHighlightNodeIds.size > 0 && !currentHighlightNodeIds.has(d.id)) return 0.15;
        return 1;
      });

    // Re-apply selected node highlight after clearing hover
    applySelectedHighlight();
  }

  // ─── Selected node persistent highlight ────────────────────────

  function applySelectedHighlight() {
    nodeGroup.selectAll<SVGGElement, SimNode>('.graph-node').each(function (d) {
      const el = d3.select(this).select('.node-shape');
      if (d.id === currentSelectedNodeId) {
        el.attr('stroke', '#f59e0b').attr('stroke-width', 2.5);
      } else {
        const color = currentHeatMode
          ? (() => { const rgb = heatColorRGB(d.heat_score); return `rgb(${rgb.r},${rgb.g},${rgb.b})`; })()
          : nonHeatNodeColor(d);
        el.attr('stroke', color).attr('stroke-width', 1.5);
      }
    });
  }

  function setSelectedNode(nodeId: string | null) {
    currentSelectedNodeId = nodeId;
    applySelectedHighlight();
  }

  // ─── Public API ─────────────────────────────────────────────────

  function update(params: D3GraphUpdateParams) {
    const prevHeatMode = currentHeatMode;
    currentColorMode = params.colorMode;
    currentHeatMode = params.colorMode === 'heat';
    currentShowHulls = params.showHulls;
    currentHideLabels = params.hideLabels;
    currentCompactLabels = params.compactLabels;
    currentHighlightNodeIds = params.highlightNodeIds;
    currentHighlightEdgeIds = params.highlightEdgeIds;
    currentSearchMatches = params.searchMatches;
    currentStrengthThreshold = params.strengthThreshold ?? 0;

    // Build filtered node list
    const filteredNodes = params.nodes.filter(n => params.visibleNodeIds.has(n.id));

    // ── Derive community layout state (top-K islas + grid + labels) ──
    // Fuente de tamaños: la lista /graph/communities; si no llegó, contar por nodos
    // (community mode sigue funcionando solo con el subgrafo).
    const communities = params.communities ?? [];
    let sizeEntries: Array<{ community_id: number; size: number; label: string | null }>;
    if (communities.length > 0) {
      sizeEntries = communities.map(c => ({ community_id: c.community_id, size: c.size, label: c.label }));
    } else {
      const counts = new Map<number, number>();
      for (const n of filteredNodes) {
        if (n.community_id != null) counts.set(n.community_id, (counts.get(n.community_id) ?? 0) + 1);
      }
      sizeEntries = [...counts.entries()].map(([community_id, size]) => ({ community_id, size, label: null }));
    }
    currentSignificantSet = significantCommunityIds(sizeEntries);
    currentCommunityLabels = new Map(
      sizeEntries.filter(e => e.label).map(e => [e.community_id, e.label as string]),
    );
    // Asignar celda de grid a cada significativa, ordenadas por tamaño (mayor = primera celda).
    const ordered = sizeEntries
      .filter(e => currentSignificantSet.has(e.community_id))
      .sort((a, b) => b.size - a.size);
    currentCommunityGridIndex = new Map(ordered.map((e, i) => [e.community_id, i]));
    const k = Math.max(1, ordered.length);
    currentCommunityGridCols = Math.ceil(Math.sqrt(k));
    currentCommunityGridRows = Math.ceil(k / currentCommunityGridCols);
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
      .filter(e => visibleIds.has(e.source_id) && visibleIds.has(e.target_id)
        && (e.strength ?? 0) >= currentStrengthThreshold)
      .map(e => ({ source: e.source_id, target: e.target_id, _edge: e }) as unknown as SimLink);

    bindData();
    createSimulation();

    if (frozen && simulation) {
      simulation.stop();
      simNodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
    }

    // Heat background: clear when toggled off, render when on
    if (!currentHeatMode && prevHeatMode && heatCtx && heatCanvas) {
      heatCtx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
    }
    if (currentHeatMode) scheduleHeatRender();
  }

  function resize(w: number, h: number) {
    width = w;
    height = h;
    svg.attr('width', width).attr('height', height);
    if (heatCanvas) {
      heatCanvas.width = w;
      heatCanvas.height = h;
      if (currentHeatMode) scheduleHeatRender();
    }
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
      applyHoverDimming(nodeId);
    } else {
      clearHoverDimming();
    }
  }

  function destroy() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (heatRenderThrottleId !== null) cancelAnimationFrame(heatRenderThrottleId);
    if (simulation) simulation.stop();
    if (heatCtx && heatCanvas) {
      heatCtx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
    }
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
    setSelectedNode,
    destroy,
  };
}
