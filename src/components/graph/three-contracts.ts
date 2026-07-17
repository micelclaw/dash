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

import type { Group, Scene } from 'three';
import type { GraphNode, GraphEdge, GraphColorMode } from '@/types/intelligence';
import type { GraphRendererCallbacks, GraphRendererInstance } from './graph-renderer-contract';

/**
 * Contratos INTERNOS del renderer 3D (three-graph-renderer + three-node-objects +
 * three-hulls). Solo tipos y constantes — el código vive en sus módulos. Este
 * fichero es type-only respecto a `three` (import type) → no arrastra el chunk.
 *
 * Paridad visual: el 3D reutiliza los helpers de graph-utils.ts (entityTypeColor,
 * entityTypeShape, heatColorRGB, communityColor, significantCommunityIds,
 * wrapLabelLines, nodeSize, linkColor, linkStrokeWidth) — NO se duplican tablas
 * de color ni de formas.
 */

// ─── Datos en la simulación 3D (three-forcegraph muta estos objetos) ────────

export interface ThreeSimNode extends GraphNode {
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
  fx?: number | null; fy?: number | null; fz?: number | null;
  /** Radio visual = nodeSize(mention_count) / 2 — mismo cálculo que el 2D. */
  _r: number;
}

export interface ThreeSimLink {
  source: string | ThreeSimNode;
  target: string | ThreeSimNode;
  _edge: GraphEdge;
}

// ─── three-node-objects.ts ──────────────────────────────────────────────────

/** Contexto visual vigente (se recalcula en cada update()). */
export interface NodeVisualContext {
  colorMode: GraphColorMode;
  lightTheme: boolean;
  /** community_ids significativas — significantCommunityIds() de graph-utils. */
  significantSet: Set<number>;
  /** Apagado duro de labels: !hideLabels (⇒ labelState.hidden en la factory). La
   *  visibilidad real por nodo la decide el LOD proyectado del renderer (mejora 2),
   *  que sustituye en 3D al umbral de LABEL_HIDE_THRESHOLD nodos del 2D. */
  showLabels: boolean;
  /** true en modo records → wrapLabelLines(name, LABEL_MAX_CHARS, 2) unido con '\n'. */
  compactLabels: boolean;
}

/** Estado interactivo de un nodo (hover/dim/selección/label transitoria). */
export interface NodeInteractionState {
  hovered: boolean;
  /** Vecino directo del nodo en hover (opacidad 0.85, como el 2D). */
  neighbor: boolean;
  /** Atenuado — hover en otro nodo (0.4) o search/highlight sin match (0.15). */
  dimmed: boolean;
  /** Nivel de atenuación cuando dimmed: 0.4 (hover) | 0.15 (search/highlight). */
  dimLevel: number;
  selected: boolean;
  /** Extremo del camino más corto (inicio/fin): resaltado reforzado (outline ámbar +
   *  glow) sobre los nodos intermedios del camino (que solo van sin dimming). */
  pathEndpoint: boolean;
  /** Forzar label visible aunque showLabels sea false (vecinos en hover). */
  labelBoost: boolean;
}

/**
 * Factory de objetos de nodo. El Group devuelto por build() lleva children con
 * `name` fijo (el renderer y applyState los localizan con getObjectByName):
 *  - 'shape'   Mesh — geometría según entityTypeShape(node.entity_type):
 *              circle→Sphere(r,16,12) · square→Box(1.6r) · diamond→Octahedron(r)
 *              triangle→Cone(r, 2r, 3) · hexagon→Cylinder(r,r,0.8r,6)
 *              octagon→Cylinder(r,r,0.8r,8).
 *              BILLBOARD (mejora 1): las formas NO esféricas miran SIEMPRE a la
 *              cámara — la silueta 2D (hexágono, rombo…) se lee desde cualquier
 *              ángulo de órbita. Cylinders/Box: geometry.rotateX(π/2) al construir
 *              (cara plana hacia +Z) y en runtime mesh.onBeforeRender copia
 *              camera.quaternion al mesh (shape y outline; el cono NO se aplana:
 *              con quaternion de cámara su eje Y queda en el plano de pantalla y
 *              la silueta es el triángulo). Sphere: sin billboard.
 *              Material MeshLambert; color según modo (mismos helpers 2D); en
 *              heat: emissive = heatColorRGB(heat_score), intensity ∝ score.
 *  - 'glow'    THREE.Sprite con la TEXTURA COMPARTIDA de gradiente radial de la
 *              factory (mejora 5 — reemplaza a la esfera 'halo'): SpriteMaterial
 *              per-nodo tintado (color del nodo, o heatColorRGB en heat),
 *              AdditiveBlending en oscuro / NormalBlending en claro, depthWrite
 *              false. Los glows aditivos solapados SE FUNDEN entre nodos (paridad
 *              con los splats canvas del 2D). Visible: heat → SIEMPRE con
 *              scale = (HEAT_GLOW_BASE_3D + _r*2.5) y opacity 0.28+heat*0.45;
 *              no-heat → solo hovered, color del nodo, scale _r*3.4, opacity 0.5.
 *  - 'outline' Mesh escala 1.12 del shape, MeshBasic #f59e0b side:BackSide,
 *              visible solo cuando selected (stroke ámbar 2D). Billboard igual
 *              que el shape.
 *  - 'label'   SpriteText (three-spritetext) bajo el nodo (y = -(r+8)),
 *              textHeight ≈ 7, color labelColor del tema; multi-línea con '\n'.
 *              LOD (mejora 2): la visibilidad FINAL la decide el renderer por
 *              tamaño proyectado en pantalla vía setLabelLOD — applyState ya NO
 *              fija label.visible; escribe group.userData.labelState =
 *              { hidden, boost, opacity } y llama a setLabelLOD con el último
 *              LOD cacheado en userData (lodVisible/lodOpacity, default false).
 * Geometrías cacheadas por (shape, bucket de radio 0.5). Materiales POR NODO
 * (applyState muta opacity/emissive per-nodo → no compartir); la textura del
 * gradiente radial es UNA para toda la factory. La factory registra todo
 * recurso creado y dispose() lo libera al destruir el renderer.
 */
export interface NodeObjectFactory {
  build(node: ThreeSimNode, ctx: NodeVisualContext): Group;
  /** Re-estila un Group vivo tras cambiar colorMode/tema — sin recrear geometrías. */
  restyle(group: Group, node: ThreeSimNode, ctx: NodeVisualContext): void;
  /** Aplica estado interactivo (opacidades, glow, outline, labelState). */
  applyState(group: Group, node: ThreeSimNode, state: NodeInteractionState, ctx: NodeVisualContext): void;
  /**
   * LOD de label (mejora 2): combina el labelState de applyState con el LOD del
   * renderer. visible final = !hidden && (boost || lodVisible); opacity final =
   * labelState.opacity * (boost ? 1 : lodOpacity). Cachea lodVisible/lodOpacity
   * en userData para que applyState re-aplique sin esperar al siguiente frame.
   */
  setLabelLOD(group: Group, lodVisible: boolean, lodOpacity: number): void;
  /** Libera todas las geometrías/materiales/texturas cacheadas. */
  dispose(): void;
}

export type CreateNodeObjectFactory = () => NodeObjectFactory;

// ─── three-hulls.ts ─────────────────────────────────────────────────────────

/** Spec de un hull: envolvente convexa de las posiciones de sus miembros. */
export interface HullGroupSpec {
  key: string;
  /** Color hex (communityColor(cid) o entityTypeColor(type)). */
  color: string;
  label: string;
  /** Posiciones [x,y,z] de los nodos miembros (≥4 no coplanares para ConvexGeometry;
   *  el manager degrada a nada si <4 puntos).
   *  INFLADO (mejora 4): el manager EXPANDE cada punto radialmente desde el
   *  centroide del grupo (p' = p + normalize(p - centroide) * HULL_PADDING_3D)
   *  ANTES de construir la ConvexGeometry — el hull ENVUELVE los nodos con
   *  margen (paridad con expandPolygon del 2D) en vez de pasar por sus centros.
   *  Aplica también al prisma del caso 3-puntos. */
  points: Array<[number, number, number]>;
  /** Modo community → relleno/borde más marcados (paridad alphas 2D 1f/0a). */
  emphasized: boolean;
}

/**
 * Gestiona las meshes de hulls dentro de la escena. update() reemplaza el set
 * completo (diff por key). Materiales translúcidos: opacity ~0.10 (emphasized)
 * / ~0.05, DoubleSide, depthWrite:false. Label = SpriteText en el centroide,
 * elevada sobre el hull. Llamado THROTTLED (cada ~10 engine ticks).
 */
export interface HullManager {
  update(specs: HullGroupSpec[], lightTheme: boolean): void;
  clear(): void;
  dispose(): void;
}

export type CreateHullManager = (scene: Scene) => HullManager;

// ─── three-graph-renderer.ts ────────────────────────────────────────────────

export interface ThreeGraphConfig extends GraphRendererCallbacks {
  /** Contenedor vacío; el renderer crea/destruye dentro su canvas WebGL. */
  containerElement: HTMLDivElement;
  /** Canvas 2D DETRÁS del WebGL para el campo de calor (mejora: paridad exacta con el
   *  2D). El renderer proyecta las posiciones 3D a pantalla y pinta los MISMOS splats
   *  radiales (source-over) que renderHeatBackground del 2D → mismo look vívido. */
  heatCanvas: HTMLCanvasElement | null;
  width: number;
  height: number;
}

/**
 * Factory del renderer 3D — devuelve el MISMO contrato que createD3Graph.
 *
 * Decisiones fijadas (paridad + implementación):
 *  - `new ForceGraph3D(container, { controlType: 'orbit', rendererConfig:
 *    { alpha: true, antialias: true } })`, backgroundColor 'rgba(0,0,0,0)'
 *    (el fondo lo pone el modal → temas claro/oscuro gratis), showNavInfo(false).
 *  - Fuerzas (constantes abajo): link distance LINK_DISTANCE_3D con strength =
 *    edge.strength ?? 0.3; charge CHARGE_3D con distanceMax CHARGE_DISTANCE_MAX_3D;
 *    agrupación en el plano XY con la componente Y NEGADA respecto a las fórmulas
 *    del 2D (SVG: +y hacia abajo; WebGL: +y hacia arriba → sin negar, el layout
 *    sale espejado verticalmente):
 *    modo type → focos en círculo de radio TYPE_RING_RADIUS_3D (mismo TYPE_ORDER
 *    del 2D: person,project,location,topic,organization,event; strength 0.10);
 *    modo community → grid de focos XY por comunidad significativa ordenada por
 *    tamaño (strength 0.20 isla / 0.05 long-tail); forceZ→0 con la misma strength
 *    (aplana suavemente sin matar la profundidad).
 *  - Links: linkOpacity(1) global y alpha BAKEADA en rgba desde el accessor
 *    linkColor (base 0.15 oscuro / 0.5 claro; hover incidente 0.7, resto 0.2;
 *    highlight #fbbf24 0.8, resto 0.05; heat → heatColor(heat_edge)). Width:
 *    highlight 3 · heat 0.5+heat*3 · structural 3 · resto linkStrokeWidth().
 *    Para refrescar estilos de link: re-set del accessor (linkColor(linkColor())).
 *  - Hover: onNodeHover de la lib no da MouseEvent → listener 'pointermove' en
 *    el contenedor guarda la última posición y se sintetiza para el tooltip.
 *    Dimming por adjacency map (Map<string, Set<string>>) precomputado en update().
 *  - update(params): filtra por visibleNodeIds + strengthThreshold (como el 2D),
 *    preserva posiciones x/y/z/velocidades de nodos que permanecen (map por id),
 *    deriva significantSet/grid/labels de comunidades (misma lógica del 2D),
 *    graphData({nodes, links}) y restyle de Groups vivos si cambió el contexto.
 *  - freeze(): fx/fy/fz = x/y/z de todos; unfreeze(): null + d3ReheatSimulation().
 *  - zoomIn/zoomOut: dolly de cámara hacia controls.target (factor 0.7 / 1.4);
 *    zoomReset(): zoomToFit(400); centerOnNode(): cameraPosition(pos, node, 800).
 *  - resize(w,h): graph.width(w).height(h).
 *  - Hulls: onEngineTick throttled (HULL_TICK_INTERVAL) → HullGroupSpec[] con las
 *    MISMAS reglas 2D: heat→ninguno; community→siempre (significativas con ≥3
 *    presentes); type→solo si showHulls (grupos ≥5).
 *  - LOD de labels (mejora 2): bucle rAF propio del renderer (throttle: 1 de cada
 *    LABEL_LOD_FRAME_SKIP frames) que, por Group vivo, calcula la altura del
 *    texto proyectada en pantalla: px = LABEL_TEXT_HEIGHT_WORLD * viewportH /
 *    (2 * dist(camera, nodo) * tan(fov/2)). visible si px >= LABEL_MIN_PX, con
 *    fade lineal hasta LABEL_FADE_PX. Aplica vía factory.setLabelLOD. Este LOD
 *    SUSTITUYE en 3D al umbral duro de 400 nodos (los cercanos se leen aunque
 *    haya miles); hideLabels=true sigue siendo apagado duro. El bucle se cancela
 *    en destroy().
 *  - setFov(fov) (mejora 3): clamp FOV_MIN_3D..FOV_MAX_3D sobre graph.camera()
 *    (PerspectiveCamera) + updateProjectionMatrix(). Al crear, fija
 *    camera.fov = DEFAULT_FOV_3D (determinista para la UI del slider).
 *  - destroy(): pauseAnimation, _destructor(), dispose de factory/hulls/listeners,
 *    renderer.forceContextLoss() si el contexto sigue vivo, vaciar contenedor.
 *  - Si WebGL no está disponible (constructor lanza), createThreeGraph propaga el
 *    throw — el hook hace fallback a 2D.
 */
export type CreateThreeGraph = (config: ThreeGraphConfig) => GraphRendererInstance;

// ─── Constantes de tuning 3D (punto de partida; se afinan en verificación) ──

export const LINK_DISTANCE_3D = 120;
export const CHARGE_3D = -300;
export const CHARGE_DISTANCE_MAX_3D = 1200;
export const TYPE_RING_RADIUS_3D = 320;
export const COMMUNITY_GRID_SPAN_3D = 900;
export const HULL_TICK_INTERVAL = 10;
/** Inflado radial de hulls desde el centroide (mejora 4 — paridad expandPolygon 2D). */
export const HULL_PADDING_3D = 26;
/** LOD de labels (mejora 2). */
export const LABEL_MIN_PX = 7;
export const LABEL_FADE_PX = 11;
export const LABEL_LOD_FRAME_SKIP = 3;
/** FOV (mejora 3). */
export const DEFAULT_FOV_3D = 50;
export const FOV_MIN_3D = 25;
export const FOV_MAX_3D = 100;
/** Glow aditivo (mejora 5 — splats del 2D: HEAT_SPLAT_RADIUS 120px + r*2). */
export const HEAT_GLOW_BASE_3D = 55;
