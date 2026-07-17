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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Maximize2, Network, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useIntelligenceStore } from '@/stores/intelligence.store';
import { shortestPath, egoWithinDegree } from './graph-path';
import { GraphCanvas } from './GraphCanvas';
import { GraphDetailPanel } from './GraphDetailPanel';
import { GraphSearchInput } from './GraphSearchInput';
import { GraphCategoryFilters } from './GraphCategoryFilters';
import { GraphColorModeToggle } from './GraphColorModeToggle';
import { GraphDimensionToggle } from './GraphDimensionToggle';
import { GRAPH_RECORD_DOMAIN_BY_TYPE } from '@/config/graph-domains';
import type { GraphNode, GraphEdge, GraphColorMode, GraphCommunity } from '@/types/intelligence';

type GraphMode = 'entities' | 'records';

/** Set vacío estable (identidad constante) para no romper memos/effects sin camino. */
const EMPTY_ID_SET: Set<string> = new Set();

/** Grado máximo de la ego-red (el label se mantiene sano; el BFS satura en el componente). */
const MAX_EGO_DEGREE = 6;

/** Camino más corto activo entre dos nodos (o no-encontrado). */
interface PathState {
  start: GraphNode;
  end: GraphNode;
  nodes: GraphNode[];      // ordenados inicio→fin; vacío si no encontrado
  edgeIds: Set<string>;
  found: boolean;
}

// type (resolveEntity) → domain backend (center_record_type). SSOT del grafo.
const RECORD_DOMAIN: Record<string, string> = GRAPH_RECORD_DOMAIN_BY_TYPE;

interface GraphViewModalProps {
  open: boolean;
  onClose: () => void;
  centerEntityId?: string;
}

export function GraphViewModal({ open, onClose, centerEntityId }: GraphViewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchSubgraph = useIntelligenceStore(s => s.fetchSubgraph);
  const fetchRecordSubgraph = useIntelligenceStore(s => s.fetchRecordSubgraph);
  const fetchCommunities = useIntelligenceStore(s => s.fetchCommunities);

  // Data
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ entities: number; edges: number }>({ entities: 0, edges: 0 });

  // UI state
  const [graphMode, setGraphMode] = useState<GraphMode>('entities');
  const [nodeLimit, setNodeLimit] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [colorMode, setColorMode] = useState<GraphColorMode>('type');
  const [view3D, setView3D] = useState(() => {
    // localStorage puede lanzar (storage bloqueado); no romper el render por una preferencia
    try {
      return localStorage.getItem('dash.graph.view3d') === '1';
    } catch {
      return false;
    }
  });
  const [communities, setCommunities] = useState<GraphCommunity[]>([]);
  const [strengthThreshold, setStrengthThreshold] = useState(0);
  // Camino más corto: pathState = camino activo; pathAnchor = inicio armado desde el
  // panel esperando el click del nodo final. Los highlight sets se DERIVAN de pathState.
  const [pathState, setPathState] = useState<PathState | null>(null);
  const [pathAnchor, setPathAnchor] = useState<GraphNode | null>(null);
  const highlightNodeIds = useMemo(
    () => (pathState?.found ? new Set(pathState.nodes.map(n => n.id)) : EMPTY_ID_SET),
    [pathState],
  );
  const highlightEdgeIds = useMemo(
    () => (pathState?.found ? pathState.edgeIds : EMPTY_ID_SET),
    [pathState],
  );
  const pathEndpointIds = useMemo(
    () => (pathState?.found ? new Set([pathState.start.id, pathState.end.id]) : EMPTY_ID_SET),
    [pathState],
  );
  // Ego-red por grados: egoDegree=0 → grafo completo; egoAnchorId = nodo centro.
  const [egoDegree, setEgoDegree] = useState(0);
  const [egoAnchorId, setEgoAnchorId] = useState<string | null>(null);
  const egoNodeIds = useMemo(
    () => (egoDegree > 0 && egoAnchorId ? egoWithinDegree(edges, egoAnchorId, egoDegree) : null),
    [egoDegree, egoAnchorId, edges],
  );
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
    // El subgrafo cambia (centro/límite/modo) → camino y ego previos quedan obsoletos.
    setPathState(null);
    setPathAnchor(null);
    setEgoDegree(0);
    setEgoAnchorId(null);

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

  // Comunidades (para colorear + leyenda en modo "community")
  useEffect(() => {
    if (!open) return;
    fetchCommunities().then(setCommunities).catch(() => setCommunities([]));
  }, [open, fetchCommunities]);

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

  // Calcula el camino más corto (BFS sobre el subgrafo cargado) y lo activa.
  const computePath = useCallback((start: GraphNode, end: GraphNode) => {
    setPathAnchor(null);
    // Ego y camino son excluyentes: calcular un camino sale del modo ego.
    setEgoDegree(0);
    setEgoAnchorId(null);
    if (start.id === end.id) return;
    const res = shortestPath(edges, start.id, end.id);
    if (res) {
      const byId = new Map(nodes.map(n => [n.id, n]));
      const orderedNodes = res.nodeIds
        .map(id => byId.get(id))
        .filter((n): n is GraphNode => !!n);
      setPathState({ start, end, nodes: orderedNodes, edgeIds: new Set(res.edgeIds), found: true });
    } else {
      setPathState({ start, end, nodes: [], edgeIds: new Set(), found: false });
    }
  }, [edges, nodes]);

  const handleNodeClick = useCallback((node: GraphNode, event?: MouseEvent) => {
    const modifier = !!(event && (event.shiftKey || event.ctrlKey || event.metaKey));
    // Gesto de camino: (a) inicio armado desde el panel, o (b) Shift/Ctrl+click con un
    // nodo ya seleccionado. En ambos casos NO se re-centra (mantener el subgrafo).
    if (pathAnchor && node.id !== pathAnchor.id) {
      computePath(pathAnchor, node);
      return;
    }
    if (modifier && selectedNode && node.id !== selectedNode.id) {
      computePath(selectedNode, node);
      return;
    }
    // Click normal: SOLO seleccionar (ya NO re-centra ni re-fetch). Así el subgrafo
    // cargado NO cambia y se puede Shift+click en cualquier nodo visible, aunque esté
    // lejos del seleccionado. Explorar la vecindad de un nodo pasa a un botón explícito
    // del panel (handleExplore). Se limpia camino y ego (se sale al grafo completo; luego
    // + re-engancha la ego-red en el nuevo nodo = "caminar" el grafo).
    setPathState(null);
    setPathAnchor(null);
    setEgoDegree(0);
    setEgoAnchorId(null);
    setSelectedNode(node);
  }, [pathAnchor, selectedNode, computePath]);

  // Explorar la vecindad: re-carga el subgrafo centrado en el nodo (lo que antes hacía
  // el click). Ahora explícito → seleccionar no encoge la vista.
  const handleExplore = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setCenterId(node.id);
    setCenterType(node.entity_type);
  }, []);

  const handleClearPath = useCallback(() => {
    setPathState(null);
    setPathAnchor(null);
  }, []);

  // Ego-red +/−. Con nodo seleccionado y grado 0, cualquiera de +/− engancha a grado 1
  // (ancla = nodo seleccionado). Ya enganchado: + sube, − baja (0 = grafo completo).
  // Excluyente con el camino más corto (lo limpia al enganchar).
  const handleEgoPlus = useCallback(() => {
    if (egoDegree === 0) {
      if (!selectedNode) return;
      setPathState(null);
      setPathAnchor(null);
      setEgoAnchorId(selectedNode.id);
      setEgoDegree(1);
    } else {
      setEgoDegree(d => Math.min(d + 1, MAX_EGO_DEGREE));
    }
  }, [egoDegree, selectedNode]);

  const handleEgoMinus = useCallback(() => {
    if (egoDegree === 0) {
      if (!selectedNode) return;
      setPathState(null);
      setPathAnchor(null);
      setEgoAnchorId(selectedNode.id);
      setEgoDegree(1);
    } else {
      setEgoDegree(d => {
        const next = d - 1;
        if (next <= 0) { setEgoAnchorId(null); return 0; } // 0 = grafo completo
        return next;
      });
    }
  }, [egoDegree, selectedNode]);

  // Botón "Trazar camino desde aquí" del panel: arma el nodo como inicio.
  const handleStartPath = useCallback((node: GraphNode) => {
    setPathState(null);
    setPathAnchor(node);
  }, []);

  const handleResetGraph = useCallback(() => {
    setCenterId(null);
    setCenterType(null);
  }, []);

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

  // Persistir la preferencia 2D/3D entre sesiones
  const setView3DPersist = useCallback((v: boolean) => {
    setView3D(v);
    // setItem puede lanzar (Safari privado / cuota agotada); si falla, no propagar:
    // el fallback 3D→2D debe llegar al toast y no disparar on3DUnavailable dos veces
    try {
      localStorage.setItem('dash.graph.view3d', v ? '1' : '0');
    } catch {
      // preferencia no persistida; el estado en memoria ya está aplicado
    }
  }, []);

  const handle3DUnavailable = useCallback(() => {
    setView3DPersist(false);
    toast.error('WebGL no disponible — usando la vista 2D');
  }, [setView3DPersist]);

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
        <GraphColorModeToggle mode={colorMode} onChange={setColorMode} />
        <GraphDimensionToggle is3D={view3D} onChange={setView3DPersist} />

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
              colorMode={colorMode}
              communities={communities}
              highlightNodeIds={highlightNodeIds}
              highlightEdgeIds={highlightEdgeIds}
              pathEndpointIds={pathEndpointIds}
              egoNodeIds={egoNodeIds}
              egoDegree={egoDegree}
              egoEnabled={!!selectedNode}
              onEgoPlus={handleEgoPlus}
              onEgoMinus={handleEgoMinus}
              searchQuery={searchQuery}
              categoryFilters={categoryFilters}
              onNodeClick={handleNodeClick}
              onResetGraph={handleResetGraph}
              externalHoverNodeId={detailHoverEntityId}
              selectedNodeId={selectedNode?.id ?? null}
              strengthThreshold={graphMode === 'records' ? strengthThreshold : undefined}
              width={dimensions.width}
              height={dimensions.height}
              mode={graphMode}
              is3D={view3D}
              on3DUnavailable={handle3DUnavailable}
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
          pathNodes={pathState?.found ? pathState.nodes : null}
          pathNotFound={pathState && !pathState.found
            ? { startName: pathState.start.name, endName: pathState.end.name }
            : null}
          pathArmingName={pathAnchor?.name ?? null}
          onStartPath={handleStartPath}
          onClearPath={handleClearPath}
          onExplore={handleExplore}
          onFocusPathNode={setSelectedNode}
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
        {colorMode === 'heat' && <span style={{ color: '#f43f5e' }}>Heat map</span>}
        {colorMode === 'community' && <span style={{ color: '#a78bfa' }}>{communities.length} comunidades</span>}

        {graphMode === 'records' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.625rem' }}>
            <span>Strength:</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={strengthThreshold * 100}
              onChange={e => setStrengthThreshold(Number(e.target.value) / 100)}
              style={{ width: 80, accentColor: 'var(--amber)', cursor: 'pointer' }}
            />
            <span style={{ minWidth: 28, textAlign: 'right' }}>{Math.round(strengthThreshold * 100)}%</span>
          </div>
        )}

        <div style={{ marginLeft: graphMode === 'records' ? 8 : 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
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
