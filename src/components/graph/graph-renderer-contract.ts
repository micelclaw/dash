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

/**
 * Contrato compartido entre los renderers del Knowledge Graph (2D SVG/d3-force y
 * 3D WebGL/3d-force-graph). `use-graph-renderer` habla SOLO este contrato; la
 * factory concreta (createD3Graph / createThreeGraph) es intercambiable.
 */

export interface GraphRendererUpdateParams {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colorMode: GraphColorMode;
  communities?: GraphCommunity[];
  showHulls: boolean;
  hideLabels: boolean;
  compactLabels: boolean;
  highlightNodeIds: Set<string>;
  highlightEdgeIds: Set<string>;
  /** Extremos del camino más corto (inicio + fin): resaltado reforzado sobre los
   *  intermedios (que van solo en highlightNodeIds). Subconjunto de highlightNodeIds. */
  pathEndpointIds?: Set<string>;
  searchMatches: Set<string> | null;
  visibleNodeIds: Set<string>;
  strengthThreshold?: number;
}

export interface GraphRendererInstance {
  update(params: GraphRendererUpdateParams): void;
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
  /** Solo 3D: campo de visión de la cámara en grados (clamp interno). El 2D no lo implementa. */
  setFov?(fov: number): void;
}

/** Callbacks de interacción comunes a ambos renderers (el hook los provee). */
export interface GraphRendererCallbacks {
  /** `event` (cuando el renderer lo aporta) permite leer modificadores (Shift/Ctrl/Cmd)
   *  para el gesto de "camino más corto". Ambos renderers lo tienen disponible. */
  onNodeClick: (node: GraphNode, event?: MouseEvent) => void;
  onNodeHover: (node: GraphNode | null, event: MouseEvent | null) => void;
  onEdgeClick: (edge: GraphEdge, event: MouseEvent) => void;
}

/** Umbrales visuales compartidos (paridad 2D↔3D). */
export const LABEL_HIDE_THRESHOLD = 400;
export const LABEL_MAX_CHARS = 18;
