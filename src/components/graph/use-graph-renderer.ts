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

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { GraphNode, GraphEdge, GraphColorMode, GraphCommunity } from '@/types/intelligence';
import type {
  GraphRendererInstance,
  GraphRendererCallbacks,
  GraphRendererUpdateParams,
} from './graph-renderer-contract';
import { createD3Graph } from './d3-graph-renderer';
// Import de VALOR seguro: three-contracts es type-only respecto a `three` (no arrastra el chunk).
import { DEFAULT_FOV_3D } from './three-contracts';

export interface UseGraphRendererParams {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colorMode: GraphColorMode;
  communities?: GraphCommunity[];
  highlightNodeIds: Set<string>;
  highlightEdgeIds: Set<string>;
  pathEndpointIds?: Set<string>;
  /** Ego-red: si se pasa, SOLO se muestran estos nodos (∩ categoryFilters). null = grafo completo. */
  egoNodeIds?: Set<string> | null;
  searchQuery: string;
  categoryFilters: Record<string, boolean>;
  onNodeClick: (node: GraphNode, event?: MouseEvent) => void;
  externalHoverNodeId?: string | null;
  selectedNodeId?: string | null;
  width: number;
  height: number;
  hideLabels?: boolean;
  compactLabels?: boolean;
  strengthThreshold?: number;
  is3D: boolean;
  /** El renderer 3D no pudo crearse (WebGL/chunk) — el consumidor decide el fallback. */
  on3DUnavailable?: () => void;
}

/** Snapshot del último render, para hidratar una instancia creada asíncronamente. */
interface LatestRendererParams {
  update: GraphRendererUpdateParams;
  width: number;
  height: number;
  selectedNodeId: string | null;
  externalHoverNodeId: string | null;
}

export function useGraphRenderer(params: UseGraphRendererParams) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<GraphRendererInstance | null>(null);

  // Hover / click overlay state
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredNodePos, setHoveredNodePos] = useState<{ x: number; y: number } | null>(null);
  const [clickedEdge, setClickedEdge] = useState<GraphEdge | null>(null);
  const [clickedEdgePos, setClickedEdgePos] = useState<{ x: number; y: number } | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [showHulls, setShowHulls] = useState(false);
  const [fov, setFovState] = useState(DEFAULT_FOV_3D);

  // Stable callback ref to avoid recreating the renderer when parent re-renders
  const callbacksRef = useRef({
    onNodeClick: params.onNodeClick,
    on3DUnavailable: params.on3DUnavailable,
  });
  callbacksRef.current.onNodeClick = params.onNodeClick;
  callbacksRef.current.on3DUnavailable = params.on3DUnavailable;

  // ── Derived data ──────────────────────────────────────────────────

  const visibleNodeIds = useMemo(() => {
    const ego = params.egoNodeIds ?? null;
    const ids = new Set<string>();
    for (const n of params.nodes) {
      // Categoría (filtros por tipo) ∩ ego-red (si está activa). Los renderers
      // sueltan solas las aristas cuyos extremos no quedan visibles.
      if (params.categoryFilters[n.entity_type] === false) continue;
      if (ego !== null && !ego.has(n.id)) continue;
      ids.add(n.id);
    }
    return ids;
  }, [params.nodes, params.categoryFilters, params.egoNodeIds]);

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

  // Snapshot por render: la creación (asíncrona en 3D) lo lee al resolver, y así
  // una instancia recién montada recibe el estado vigente sin esperar a los effects.
  const latest: LatestRendererParams = {
    update: {
      nodes: params.nodes,
      edges: params.edges,
      colorMode: params.colorMode,
      communities: params.communities,
      showHulls,
      hideLabels: params.hideLabels ?? false,
      compactLabels: params.compactLabels ?? false,
      highlightNodeIds: params.highlightNodeIds,
      highlightEdgeIds: params.highlightEdgeIds,
      pathEndpointIds: params.pathEndpointIds,
      searchMatches,
      visibleNodeIds,
      strengthThreshold: params.strengthThreshold,
    },
    width: params.width,
    height: params.height,
    selectedNodeId: params.selectedNodeId ?? null,
    externalHoverNodeId: params.externalHoverNodeId ?? null,
  };
  const latestParamsRef = useRef(latest);
  latestParamsRef.current = latest;

  // FOV vigente (patrón latest): la instancia 3D creada asíncronamente lo lee al hidratarse.
  const latestFovRef = useRef(fov);
  latestFovRef.current = fov;

  // ── Create / destroy renderer instance (mount + cambio de modo 2D/3D) ─────

  useEffect(() => {
    let cancelled = false;
    let created: GraphRendererInstance | null = null;

    // La instancia nueva arranca siempre sin freeze.
    setFrozen(false);
    // Y sin overlays heredados: el tooltip/popover de la instancia anterior quedaría
    // anclado a coordenadas viejas sobre la vista nueva al alternar 2D/3D.
    setHoveredNode(null);
    setHoveredNodePos(null);
    setClickedEdge(null);
    setClickedEdgePos(null);

    const rendererCallbacks: GraphRendererCallbacks = {
      onNodeClick: (node, event) => {
        callbacksRef.current.onNodeClick(node, event);
      },
      onNodeHover: (node, event) => {
        setHoveredNode(node);
        setHoveredNodePos(event ? { x: event.clientX, y: event.clientY } : null);
      },
      onEdgeClick: (edge, event) => {
        setClickedEdge(edge);
        setClickedEdgePos({ x: event.clientX, y: event.clientY });
      },
    };

    const pushLatest = (instance: GraphRendererInstance) => {
      const snapshot = latestParamsRef.current;
      instance.update(snapshot.update);
      if (snapshot.width > 0 && snapshot.height > 0) {
        instance.resize(snapshot.width, snapshot.height);
      }
      instance.setSelectedNode(snapshot.selectedNodeId);
      instance.setExternalHover(snapshot.externalHoverNodeId);
      // FOV: solo lo implementa el 3D; se re-aplica el vigente si difiere del default.
      if (latestFovRef.current !== DEFAULT_FOV_3D) {
        instance.setFov?.(latestFovRef.current);
      }
    };

    if (params.is3D) {
      const el = containerRef.current;
      if (!el) return;
      // Lazy import: three + 3d-force-graph solo entran al bundle al usar el modo 3D.
      void import('./three-graph-renderer')
        .then(({ createThreeGraph }) => {
          if (cancelled) return;
          try {
            const instance = createThreeGraph({
              containerElement: el,
              heatCanvas: heatCanvasRef.current,
              width: latestParamsRef.current.width || 800,
              height: latestParamsRef.current.height || 600,
              ...rendererCallbacks,
            });
            created = instance;
            instanceRef.current = instance;
            pushLatest(instance);
          } catch (err) {
            // WebGL no disponible → sin instancia; el consumidor vuelve a 2D.
            console.error('[graph] 3D renderer unavailable:', err);
            callbacksRef.current.on3DUnavailable?.();
          }
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error('[graph] failed to load 3D renderer:', err);
          callbacksRef.current.on3DUnavailable?.();
        });
    } else {
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const instance = createD3Graph({
        svgElement: svgEl,
        heatCanvas: heatCanvasRef.current,
        width: latestParamsRef.current.width || 800,
        height: latestParamsRef.current.height || 600,
        ...rendererCallbacks,
      });
      created = instance;
      instanceRef.current = instance;
      pushLatest(instance);
    }

    return () => {
      cancelled = true;
      // Destruye SOLO la instancia creada por este effect (el import 3D puede
      // resolver tarde; `cancelled` evita instanciar tras el cleanup).
      if (created) {
        created.destroy();
        if (instanceRef.current === created) {
          instanceRef.current = null;
        }
        created = null;
      }
    };
  }, [params.is3D]);

  // ── Resize ────────────────────────────────────────────────────────

  useEffect(() => {
    if (params.width > 0 && params.height > 0) {
      instanceRef.current?.resize(params.width, params.height);
    }
  }, [params.width, params.height]);

  // ── Push data updates to the renderer ─────────────────────────────

  useEffect(() => {
    instanceRef.current?.update({
      nodes: params.nodes,
      edges: params.edges,
      colorMode: params.colorMode,
      communities: params.communities,
      showHulls,
      hideLabels: params.hideLabels ?? false,
      compactLabels: params.compactLabels ?? false,
      highlightNodeIds: params.highlightNodeIds,
      highlightEdgeIds: params.highlightEdgeIds,
      pathEndpointIds: params.pathEndpointIds,
      searchMatches,
      visibleNodeIds,
      strengthThreshold: params.strengthThreshold,
    });
  }, [
    params.nodes, params.edges, params.colorMode, params.communities,
    params.highlightNodeIds, params.highlightEdgeIds, params.pathEndpointIds,
    searchMatches, visibleNodeIds, showHulls, params.hideLabels, params.compactLabels,
    params.strengthThreshold,
  ]);

  // ── External hover (from detail panel) ──────────────────────────────

  useEffect(() => {
    instanceRef.current?.setExternalHover(params.externalHoverNodeId ?? null);
  }, [params.externalHoverNodeId]);

  // ── Selected node persistent highlight ─────────────────────────────

  useEffect(() => {
    instanceRef.current?.setSelectedNode(params.selectedNodeId ?? null);
  }, [params.selectedNodeId]);

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

  const setFov = useCallback((v: number) => {
    setFovState(v);
    instanceRef.current?.setFov?.(v);
  }, []);

  const centerOnNode = useCallback((nodeId: string) => {
    instanceRef.current?.centerOnNode(nodeId);
  }, []);

  const closeEdgePopover = useCallback(() => {
    setClickedEdge(null);
    setClickedEdgePos(null);
  }, []);

  return {
    svgRef,
    heatCanvasRef,
    containerRef,
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
    fov,
    setFov,
    centerOnNode,
  };
}
