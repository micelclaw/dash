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

import type { GraphEdge } from '@/types/intelligence';

export interface ShortestPathResult {
  /** Nodos del camino en orden: [inicio, ...intermedios, fin]. */
  nodeIds: string[];
  /** Aristas atravesadas (edge.id), en orden. */
  edgeIds: string[];
}

/**
 * Camino más corto (menor nº de saltos) entre dos nodos por BFS no ponderado sobre
 * el subgrafo cargado. El grafo es NO dirigido (cada arista conecta source↔target).
 * Devuelve null si no hay camino en el subgrafo (nodos desconectados) o si falta
 * algún extremo. start === end devuelve el camino trivial de un nodo.
 */
export function shortestPath(
  edges: GraphEdge[],
  startId: string,
  endId: string,
): ShortestPathResult | null {
  if (startId === endId) return { nodeIds: [startId], edgeIds: [] };

  // Adyacencia no dirigida: nodo → [(vecino, edgeId)]. Se conserva el edge.id para
  // poder resaltar exactamente las aristas atravesadas.
  const adj = new Map<string, Array<{ to: string; edgeId: string }>>();
  const add = (a: string, b: string, edgeId: string) => {
    let list = adj.get(a);
    if (!list) { list = []; adj.set(a, list); }
    list.push({ to: b, edgeId });
  };
  for (const e of edges) {
    add(e.source_id, e.target_id, e.id);
    add(e.target_id, e.source_id, e.id);
  }

  if (!adj.has(startId) || !adj.has(endId)) return null;

  // BFS con padre + arista de llegada para reconstruir el camino.
  const parent = new Map<string, { node: string; edgeId: string }>();
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (cur === endId) break;
    for (const { to, edgeId } of adj.get(cur) ?? []) {
      if (visited.has(to)) continue;
      visited.add(to);
      parent.set(to, { node: cur, edgeId });
      queue.push(to);
    }
  }

  if (!visited.has(endId)) return null;

  // Reconstrucción desde el fin hacia el inicio.
  const nodeIds: string[] = [endId];
  const edgeIds: string[] = [];
  let cur = endId;
  while (cur !== startId) {
    const p = parent.get(cur);
    if (!p) return null; // no debería ocurrir si visited.has(endId)
    edgeIds.push(p.edgeId);
    nodeIds.push(p.node);
    cur = p.node;
  }
  nodeIds.reverse();
  edgeIds.reverse();
  return { nodeIds, edgeIds };
}

/**
 * Ego-red: conjunto de nodos alcanzables desde `centerId` en ≤ `degree` saltos por
 * BFS no dirigido sobre el subgrafo cargado (incluye el propio centro). `degree<=0` o
 * centro sin aristas → solo el centro. Para el filtro cliente de "nodo + vecindario".
 */
export function egoWithinDegree(
  edges: GraphEdge[],
  centerId: string,
  degree: number,
): Set<string> {
  const reached = new Set<string>([centerId]);
  if (degree <= 0) return reached;

  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    let list = adj.get(a);
    if (!list) { list = []; adj.set(a, list); }
    list.push(b);
  };
  for (const e of edges) {
    add(e.source_id, e.target_id);
    add(e.target_id, e.source_id);
  }

  // BFS por niveles hasta `degree`.
  let frontier: string[] = [centerId];
  for (let d = 0; d < degree && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const nb of adj.get(cur) ?? []) {
        if (reached.has(nb)) continue;
        reached.add(nb);
        next.push(nb);
      }
    }
    frontier = next;
  }
  return reached;
}
