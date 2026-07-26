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

import { useMemo, useState, useCallback, useLayoutEffect, useRef } from 'react';
import { ChevronLeft, ZoomIn, ZoomOut, Maximize2, RotateCcw, MousePointer2 } from 'lucide-react';
import { AgentTreeNode } from './AgentTreeNode';
import { AgentDetail } from './AgentDetail';
import type { ManagedAgent } from './types';

interface AgentTreeProps {
  agents: ManagedAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isMobile?: boolean;
  onAgentChanged?: () => void;
  onBrowseFiles?: (agentId: string) => void;
}

interface TreeNode {
  agent: ManagedAgent;
  children: TreeNode[];
  x: number;
  y: number;
  height: number;
}

interface BracketEdge {
  parentX: number;
  parentY: number;
  children: { x: number; y: number; id: string }[];
  color: string;
  parentId: string;
}

const NODE_WIDTH = 360;
const LEVEL_HEIGHT = 320;
const H_GAP = 56;
const BRACKET_OFFSET = 36;
const CORNER_RADIUS = 10;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.08;

// Estimación de filas de chips de skills empaquetando por ANCHO aproximado
// (antes se asumían 3 por fila y nombres largos como "Reverse Proxy" envolvían
// en más filas → la tarjeta real era más alta que la estimada y el badge de
// modelo quedaba recortado por el foreignObject).
function estimateSkillRows(agent: ManagedAgent): number {
  const chips = agent.skills.slice(0, 6);
  if (chips.length === 0) return 1;
  const budget = 300; // 340 de tarjeta − 40 de padding
  let rows = 1;
  let x = 0;
  for (const s of chips) {
    const w = Math.min(220, 42 + (s.name?.length ?? 6) * 6.5); // icono+padding + ~6.5px/carácter
    if (x > 0 && x + w > budget) { rows++; x = w + 6; } else { x += w + 6; }
  }
  return rows;
}

function computeCardHeight(agent: ManagedAgent, childCount: number, isOwner: boolean): number {
  if (isOwner) return 90;
  let h = 40;   // padding (20 + 20)
  h += 32;      // header row
  h += 14;      // gap
  h += 22;      // role description
  h += 14;      // gap
  h += estimateSkillRows(agent) * 32; // skill tag rows
  h += 14;      // gap
  h += 54;      // footer: badge de modelo a ancho completo (icono 28 + 2 líneas)
  if (childCount > 0) {
    h += 14;    // gap + marginTop
    h += 34;    // toggle (paddingTop + borderTop + content)
  }
  return h;
}

const OWNER_AGENT: ManagedAgent = {
  id: 'owner',
  name: 'paco',
  display_name: 'Paco',
  role: 'Owner',
  avatar: '👤',
  model: '',
  color: '#d4a017',
  is_chief: true,
  parent_agent_id: null,
  skills: [],
  workspace_path: '',
  status: 'active',
  last_active_at: null,
  sessions_today: 0,
  tokens_today: 0,
  created_at: '',
};

// ─── Tree building ────────────────────────────────────────────────

function buildTree(agents: ManagedAgent[]): TreeNode {
  const rootChildren = agents.filter(a => a.parent_agent_id === null);
  const childCounts = new Map<string, number>();
  for (const a of agents) {
    if (a.parent_agent_id) {
      childCounts.set(a.parent_agent_id, (childCounts.get(a.parent_agent_id) || 0) + 1);
    }
  }

  function buildChildren(parentId: string, depth: number): TreeNode[] {
    const kids = agents.filter(a => a.parent_agent_id === parentId);
    return kids.map(agent => {
      const cc = childCounts.get(agent.id) || 0;
      const node: TreeNode = {
        agent,
        children: [],
        x: 0,
        y: depth * LEVEL_HEIGHT,
        height: computeCardHeight(agent, cc, false),
      };
      node.children = buildChildren(agent.id, depth + 1);
      return node;
    });
  }

  const ownerChildCount = rootChildren.length;
  const ownerNode: TreeNode = {
    agent: OWNER_AGENT,
    children: rootChildren.map(agent => {
      const cc = childCounts.get(agent.id) || 0;
      const node: TreeNode = {
        agent,
        children: [],
        x: 0,
        y: LEVEL_HEIGHT,
        height: computeCardHeight(agent, cc, false),
      };
      node.children = buildChildren(agent.id, 2);
      return node;
    }),
    x: 0,
    y: 0,
    height: computeCardHeight(OWNER_AGENT, ownerChildCount, true),
  };

  return ownerNode;
}

// ─── Layout helpers ───────────────────────────────────────────────

function computeSubtreeWidth(node: TreeNode, collapsed: Set<string>): number {
  if (node.children.length === 0 || collapsed.has(node.agent.id)) return NODE_WIDTH;

  const childrenWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child, collapsed),
    0,
  );
  const gapsWidth = H_GAP * (node.children.length - 1);
  return Math.max(NODE_WIDTH, childrenWidth + gapsWidth);
}

function layoutTree(node: TreeNode, left: number, depth: number, collapsed: Set<string>): void {
  const subtreeWidth = computeSubtreeWidth(node, collapsed);
  node.x = left + subtreeWidth / 2 - NODE_WIDTH / 2;
  node.y = depth * LEVEL_HEIGHT;

  if (node.children.length === 0 || collapsed.has(node.agent.id)) return;

  const childrenTotalWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child, collapsed),
    0,
  ) + H_GAP * (node.children.length - 1);

  let childLeft = left + (subtreeWidth - childrenTotalWidth) / 2;

  for (const child of node.children) {
    const childWidth = computeSubtreeWidth(child, collapsed);
    layoutTree(child, childLeft, depth + 1, collapsed);
    childLeft += childWidth + H_GAP;
  }
}

function flattenNodes(node: TreeNode, collapsed: Set<string>): TreeNode[] {
  const result: TreeNode[] = [node];
  if (!collapsed.has(node.agent.id)) {
    for (const child of node.children) {
      result.push(...flattenNodes(child, collapsed));
    }
  }
  return result;
}

// ─── Edge collection (bracket-style) ─────────────────────────────

function collectBracketEdges(node: TreeNode, collapsed: Set<string>): BracketEdge[] {
  const edges: BracketEdge[] = [];
  if (node.children.length > 0 && !collapsed.has(node.agent.id)) {
    edges.push({
      parentX: node.x + NODE_WIDTH / 2,
      parentY: node.y + node.height,
      children: node.children.map(c => ({
        x: c.x + NODE_WIDTH / 2,
        y: c.y,
        id: c.agent.id,
      })),
      color: node.agent.color || 'var(--border)',
      parentId: node.agent.id,
    });
    for (const child of node.children) {
      edges.push(...collectBracketEdges(child, collapsed));
    }
  }
  return edges;
}

function renderBracketPaths(edge: BracketEdge): string[] {
  const { parentX, parentY, children } = edge;
  const bracketY = parentY + BRACKET_OFFSET;
  const r = CORNER_RADIUS;

  return children.map(child => {
    const dx = child.x - parentX;
    if (Math.abs(dx) < 1) {
      return `M ${parentX} ${parentY} L ${parentX} ${child.y}`;
    }
    const dir = dx > 0 ? 1 : -1;
    const absDx = Math.abs(dx);
    const clampedR = Math.min(r, absDx, Math.abs(child.y - bracketY));
    return [
      `M ${parentX} ${parentY}`,
      `L ${parentX} ${bracketY - clampedR}`,
      `Q ${parentX} ${bracketY}, ${parentX + dir * clampedR} ${bracketY}`,
      `L ${child.x - dir * clampedR} ${bracketY}`,
      `Q ${child.x} ${bracketY}, ${child.x} ${bracketY + clampedR}`,
      `L ${child.x} ${child.y}`,
    ].join(' ');
  });
}

// ─── Child count helper ──────────────────────────────────────────

function buildChildCountMap(agents: ManagedAgent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const agent of agents) {
    if (agent.parent_agent_id) {
      map.set(agent.parent_agent_id, (map.get(agent.parent_agent_id) || 0) + 1);
    }
  }
  return map;
}

// ─── Main component ───────────────────────────────────────────────

export function AgentTree({ agents, selectedId, onSelect, isMobile, onAgentChanged, onBrowseFiles }: AgentTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.85);
  const containerRef = useRef<HTMLDivElement>(null);
  // Wrapper DIMENSIONADO del contenido escalado (ver render): su rect es la
  // referencia para anclar el zoom al cursor sin asumir paddings/márgenes.
  const contentRef = useRef<HTMLDivElement>(null);
  // Ancla pendiente de un cambio de zoom: punto del viewport (clientX/Y) que
  // debe seguir sobre el mismo punto del CONTENIDO (cx/cy, coords sin escalar).
  const pendingAnchor = useRef<{ clientX: number; clientY: number; cx: number; cy: number } | null>(null);

  // Aplica el ancla DESPUÉS de que React pinte el nuevo scale: se mide el rect
  // REAL del contenido (recoge el margin:auto y el padding ya recalculados) y
  // se corrige el scroll para que el punto siga bajo el cursor. El enfoque
  // anterior (predecir el scroll con coords derivadas del scroll previo)
  // ignoraba el padding del contenedor y el auto-centrado → deriva lateral.
  useLayoutEffect(() => {
    const a = pendingAnchor.current;
    const content = contentRef.current;
    const container = containerRef.current;
    if (!a || !content || !container) return;
    pendingAnchor.current = null;
    const rect = content.getBoundingClientRect();
    container.scrollLeft += (rect.left + a.cx * zoom) - a.clientX;
    container.scrollTop += (rect.top + a.cy * zoom) - a.clientY;
  }, [zoom]);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  // Drag-to-pan: arrastrar el FONDO del lienzo mueve el scroll. Se ignora si el
  // mousedown cae sobre una card ([data-agent-card]) para no romper su click.
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const handlePanDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-agent-card]')) return; // click de card, no pan
    const container = containerRef.current;
    if (!container) return;
    panRef.current = { x: e.clientX, y: e.clientY, left: container.scrollLeft, top: container.scrollTop };
    setPanning(true);
  }, []);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    const p = panRef.current;
    const container = containerRef.current;
    if (!p || !container) return;
    container.scrollLeft = p.left - (e.clientX - p.x);
    container.scrollTop = p.top - (e.clientY - p.y);
  }, []);

  const endPan = useCallback(() => {
    if (!panRef.current) return;
    panRef.current = null;
    setPanning(false);
  }, []);

  const toggleExpand = useCallback((agentId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  // Rueda = zoom. Listener NATIVO con { passive: false }: React registra
  // onWheel como pasivo → su e.preventDefault() no hace nada ("Unable to
  // preventDefault inside passive event listener") y el contenedor scrolleaba
  // nativamente ADEMÁS del ajuste de ancla → deriva al hacer zoom.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // no interferir con el zoom del navegador
      e.preventDefault();

      const content = contentRef.current;
      if (!content) return;

      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const { clientX, clientY } = e;

      setZoom(prev => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
        if (newZoom === prev) return prev;
        // Punto del contenido bajo el cursor, en coords SIN escalar, medido
        // sobre el rect real del wrapper (independiente de padding/márgenes).
        const rect = content.getBoundingClientRect();
        pendingAnchor.current = {
          clientX,
          clientY,
          cx: (clientX - rect.left) / prev,
          cy: (clientY - rect.top) / prev,
        };
        return newZoom;
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
    // Deps: en móvil con detalle abierto el early-return no monta el
    // contenedor; al volver al árbol hay que re-enganchar el listener.
  }, [isMobile, selectedId]);

  const childCountMap = useMemo(() => buildChildCountMap(agents), [agents]);

  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const root = buildTree(agents);
    const totalWidth = computeSubtreeWidth(root, collapsed);
    layoutTree(root, 0, 0, collapsed);

    const allNodes = flattenNodes(root, collapsed);
    const allEdges = collectBracketEdges(root, collapsed);

    const maxX = allNodes.reduce((max, n) => Math.max(max, n.x + NODE_WIDTH), 0);
    const maxY = allNodes.reduce((max, n) => Math.max(max, n.y + n.height), 0);

    return {
      nodes: allNodes,
      edges: allEdges,
      svgWidth: Math.max(totalWidth, maxX) + 80,
      svgHeight: maxY + 60,
    };
  }, [agents, collapsed]);

  // Zoom centrado en el viewport (para los botones +/−): ancla el punto
  // central de la vista con el mismo mecanismo que la rueda.
  const setZoomCentered = useCallback((updater: (z: number) => number) => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      setZoom(prev => clampZoom(updater(prev)));
      return;
    }
    const vrect = container.getBoundingClientRect();
    const clientX = vrect.left + vrect.width / 2;
    const clientY = vrect.top + vrect.height / 2;
    setZoom(prev => {
      const newZoom = clampZoom(updater(prev));
      if (newZoom === prev) return prev;
      const rect = content.getBoundingClientRect();
      pendingAnchor.current = {
        clientX,
        clientY,
        cx: (clientX - rect.left) / prev,
        cy: (clientY - rect.top) / prev,
      };
      return newZoom;
    });
  }, []);

  // Ajustar todo el árbol al viewport ("fit to view") y centrarlo.
  const fitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const padding = 64;
    const z = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((rect.width - padding) / svgWidth, (rect.height - padding) / svgHeight)),
    );
    setZoom(z);
    requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, (svgWidth * z - rect.width) / 2);
      container.scrollTop = 0;
    });
  }, [svgWidth, svgHeight]);

  const showDetail = selectedId && selectedId !== 'owner';

  // Mobile: fullscreen detail view with back button
  if (isMobile && showDetail) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => onSelect('')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-dim)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} />
          Back to tree
        </button>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AgentDetail
            agentId={selectedId}
            agents={agents}
            onSelect={onSelect}
            onAgentChanged={onAgentChanged}
            onBrowseFiles={onBrowseFiles}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Tree area */}
      <div
        ref={containerRef}
        onMouseDown={handlePanDown}
        onMouseMove={panning ? handlePanMove : undefined}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: isMobile ? 16 : 32,
          position: 'relative',
          cursor: panning ? 'grabbing' : 'grab',
          userSelect: panning ? 'none' : undefined,
        }}
      >
        {/* Controles de zoom + hint de interacción */}
        <div style={{
          position: 'sticky',
          top: 0,
          left: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 3,
            pointerEvents: 'auto',
            userSelect: 'none',
          }}>
            <ZoomBtn title="Alejar" onClick={() => setZoomCentered(z => z - ZOOM_STEP * 2)} disabled={zoom <= MIN_ZOOM + 0.001}>
              <ZoomOut size={14} />
            </ZoomBtn>
            <button
              onClick={() => setZoomCentered(() => 1)}
              title="Restablecer al 100%"
              style={{
                minWidth: 46, textAlign: 'center',
                background: 'transparent', border: 'none', color: 'var(--text)',
                fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                cursor: 'pointer', padding: '4px 2px',
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <ZoomBtn title="Acercar" onClick={() => setZoomCentered(z => z + ZOOM_STEP * 2)} disabled={zoom >= MAX_ZOOM - 0.001}>
              <ZoomIn size={14} />
            </ZoomBtn>
            <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
            <ZoomBtn title="Ajustar a la vista" onClick={fitToView}>
              <Maximize2 size={13} />
            </ZoomBtn>
            <ZoomBtn title="Restablecer al 100%" onClick={() => setZoomCentered(() => 1)}>
              <RotateCcw size={13} />
            </ZoomBtn>
          </div>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: '0.6875rem', color: 'var(--text-muted)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '4px 9px',
            pointerEvents: 'auto', userSelect: 'none',
          }}>
            <MousePointer2 size={11} />
            Rueda para zoom · arrastra el fondo para mover
          </span>
        </div>

        {/* Wrapper DIMENSIONADO al tamaño visual (svg × zoom): el transform no
            cambia el layout, así que sin esto el área de scroll no coincidía
            con lo visible (deriva lateral al hacer zoom + clamping raro). El
            margin auto centra el árbol cuando cabe entero en el viewport. */}
        <div
          ref={contentRef}
          style={{
            width: svgWidth * zoom,
            height: svgHeight * zoom,
            margin: '0 auto',
          }}
        >
          <div style={{
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            width: svgWidth,
            height: svgHeight,
          }}>
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: 'block' }}
          >
            {/* Connection edges */}
            {edges.map(edge => {
              const paths = renderBracketPaths(edge);
              return (
                <g key={`bracket-${edge.parentId}`}>
                  {paths.map((d, i) => (
                    <path
                      key={`${edge.parentId}-${edge.children[i]?.id ?? i}`}
                      d={d}
                      fill="none"
                      stroke={edge.color || 'var(--border)'}
                      strokeWidth={2}
                      strokeOpacity={0.35}
                    />
                  ))}
                </g>
              );
            })}

            {/* Agent nodes */}
            {nodes.map(node => (
              <foreignObject
                key={node.agent.id}
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={node.height + 12}
              >
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: 4,
                  }}
                >
                  <AgentTreeNode
                    agent={node.agent}
                    selected={selectedId === node.agent.id}
                    onClick={() => onSelect(node.agent.id)}
                    isOwner={node.agent.id === 'owner'}
                    childCount={childCountMap.get(node.agent.id) || 0}
                    expanded={!collapsed.has(node.agent.id)}
                    onToggleExpand={() => toggleExpand(node.agent.id)}
                  />
                </div>
              </foreignObject>
            ))}
          </svg>
          </div>
        </div>
      </div>

      {/* Detail panel (desktop only) */}
      {!isMobile && showDetail && (
        <div style={{
          width: 540,
          minWidth: 540,
          borderLeft: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <AgentDetail
            agentId={selectedId}
            agents={agents}
            onSelect={onSelect}
            onAgentChanged={onAgentChanged}
            onBrowseFiles={onBrowseFiles}
          />
        </div>
      )}
    </div>
  );
}

// ─── Botón de la barra de zoom ────────────────────────────────────

function ZoomBtn({ onClick, title, disabled, children }: {
  onClick: () => void; title: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 26, background: 'transparent', border: 'none',
        borderRadius: 'var(--radius-sm)', color: disabled ? 'var(--text-muted)' : 'var(--text-dim)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'var(--transition-fast)',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = disabled ? 'var(--text-muted)' : 'var(--text-dim)'; }}
    >
      {children}
    </button>
  );
}
