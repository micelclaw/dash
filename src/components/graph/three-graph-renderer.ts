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

import ForceGraph3D from '3d-force-graph';
import type { ForceGraph3DInstance } from '3d-force-graph';
import { AmbientLight, BufferAttribute, DirectionalLight, Fog, Line, LineDashedMaterial, Vector3 } from 'three';
import type { Group, PerspectiveCamera } from 'three';
import type { GraphColorMode } from '@/types/intelligence';
import type { GraphRendererUpdateParams } from './graph-renderer-contract';
import type {
  CreateThreeGraph,
  HullGroupSpec,
  NodeInteractionState,
  NodeVisualContext,
  ThreeSimLink,
  ThreeSimNode,
} from './three-contracts';
import {
  CHARGE_3D,
  CHARGE_DISTANCE_MAX_3D,
  COMMUNITY_GRID_SPAN_3D,
  DEFAULT_FOV_3D,
  FOV_MAX_3D,
  FOV_MIN_3D,
  HULL_TICK_INTERVAL,
  LABEL_FADE_PX,
  LABEL_LOD_FRAME_SKIP,
  LABEL_MIN_PX,
  LINK_DISTANCE_3D,
  TYPE_RING_RADIUS_3D,
} from './three-contracts';
import { createNodeObjectFactory } from './three-node-objects';
import { createHullManager } from './three-hulls';
import { createStarfield } from './three-starfield';
import {
  communityColor,
  entityTypeColor,
  heatColorRGB,
  linkColor,
  linkStrokeWidth,
  nodeSize,
  significantCommunityIds,
} from './graph-utils';

// ─── Tipado puente con la lib ───────────────────────────────────────
// NodeObject de la lib tipa fx/fy/fz como `number | undefined` (sin null), así que
// ThreeSimNode no satisface la constraint del genérico. Omitiéndolos el tipo queda
// mutuamente asignable con ThreeSimNode (son propiedades opcionales) y la constraint
// se cumple — todo el código de este módulo sigue hablando ThreeSimNode.
type LibSimNode = Omit<ThreeSimNode, 'fx' | 'fy' | 'fz'>;
type Graph3D = ForceGraph3DInstance<LibSimNode, ThreeSimLink>;

/** Tipo de fuerza que acepta d3Force() (ForceFn de la lib, no exportado con nombre). */
type GraphForceFn = NonNullable<Parameters<Graph3D['d3Force']>[1]>;

/** Superficie mínima de OrbitControls que usa el dolly (la lib tipa controls() como object). */
interface OrbitControlsLike {
  target: Vector3;
  update(): void;
}

interface LinkForceLike {
  distance(n: number): LinkForceLike;
  strength(fn: (l: ThreeSimLink) => number): LinkForceLike;
}

interface ChargeForceLike {
  strength(n: number): ChargeForceLike;
  distanceMax(n: number): ChargeForceLike;
}

/** Fuerza posicional custom por eje — equivalente a d3.forceX/Y/Z sin depender de d3-force-3d. */
interface AxisForceLike {
  (alpha: number): void;
  initialize?: (nodes: ThreeSimNode[]) => void;
}

function axisForce(
  axis: 'x' | 'y' | 'z',
  targetFn: (n: ThreeSimNode) => number,
  strengthFn: (n: ThreeSimNode) => number,
): AxisForceLike {
  let nodes: ThreeSimNode[] = [];
  const force: AxisForceLike = (alpha: number) => {
    for (const n of nodes) {
      const k = strengthFn(n) * alpha;
      if (axis === 'x') n.vx = (n.vx ?? 0) + (targetFn(n) - (n.x ?? 0)) * k;
      else if (axis === 'y') n.vy = (n.vy ?? 0) + (targetFn(n) - (n.y ?? 0)) * k;
      else n.vz = (n.vz ?? 0) + (targetFn(n) - (n.z ?? 0)) * k;
    }
  };
  force.initialize = (ns) => { nodes = ns; };
  return force;
}

// Mismo orden radial que el 2D (groupCenterX/Y de d3-graph-renderer).
const TYPE_ORDER = ['person', 'project', 'location', 'topic', 'organization', 'event'];

// Niebla (tema oscuro): los nodos lejanos se difuminan hacia el fondo. Lineal en
// unidades de mundo desde la cámara — near = todo nítido; far = totalmente difuminado.
const FOG_COLOR_DARK = 0x05070c; // ~ fondo oscuro del modal
// Niebla MUY tenue: near/far empujados lejos → solo los nodos MUY lejanos se difuminan
// un poco; la mayoría queda nítida (feedback: "disminuir muchísimo la niebla").
const FOG_NEAR = 1100;
const FOG_FAR = 4600;

/** '#rrggbb' → 'rgba(...)' con el alpha bakeado (linkOpacity global va a 1). */
function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function endpointId(v: string | ThreeSimNode): string {
  return typeof v === 'string' ? v : v.id;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function readLightTheme(): boolean {
  return typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'light';
}

// ─── Factory ────────────────────────────────────────────────────────

export const createThreeGraph: CreateThreeGraph = (config) => {
  const container = config.containerElement;
  const factory = createNodeObjectFactory();

  // Si WebGL no está disponible el constructor lanza → se propaga (fallback 2D en el hook).
  const graph = new ForceGraph3D(container, {
    controlType: 'orbit',
    rendererConfig: { alpha: true, antialias: true },
  }) as unknown as Graph3D;

  // Guardado ANTES de _destructor() para poder liberar el contexto WebGL en destroy().
  const webglRenderer = graph.renderer();
  const hullManager = createHullManager(graph.scene());
  // Fondo de estrellas en el mundo (parallax al orbitar). Solo en tema oscuro.
  const starfield = createStarfield(graph.scene());
  starfield.setVisible(!readLightTheme());

  // ─── Iluminación de la escena ───────────────────────────────────
  // Ambient suave + luz CLAVE direccional + relleno tenue desde el ángulo opuesto →
  // las caras de los sólidos (cubo, cilindros, cono, octaedro) se sombrean por su
  // normal y se distinguen entre sí (antes solo la cara superior se veía distinta).
  const scene3d = graph.scene();
  const ambientLight = new AmbientLight(0xffffff, 0.5);
  const keyLight = new DirectionalLight(0xffffff, 1.15);
  keyLight.position.set(0.6, 1, 0.85);
  const fillLight = new DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(-0.7, -0.45, -0.6);
  graph.lights([ambientLight, keyLight, fillLight]);

  // ─── Niebla (nodos lejanos se difuminan; solo tema oscuro) ──────
  const sceneFog = new Fog(FOG_COLOR_DARK, FOG_NEAR, FOG_FAR);
  const applyFog = (isLight: boolean) => { scene3d.fog = isLight ? null : sceneFog; };
  applyFog(readLightTheme());

  // Campo de calor en canvas 2D detrás del WebGL (paridad EXACTA con el 2D): se
  // proyectan las posiciones 3D a pantalla y se pintan los mismos splats radiales.
  const heatCanvas = config.heatCanvas;
  const heatCtx = heatCanvas?.getContext('2d') ?? null;
  if (heatCanvas) { heatCanvas.width = config.width; heatCanvas.height = config.height; }
  let heatDirty = false;
  // Mismos parámetros que renderHeatBackground del 2D (HEAT_SPLAT_RADIUS 120 + _r*2,
  // heatBase 0.35 oscuro / 0.75 claro). SPLAT_WORLD en unidades de MUNDO → se proyecta
  // a px por el factor de escala de cámara (ppu), así el splat crece/mengua con el zoom.
  const HEAT_SPLAT_WORLD = 90;
  const HEAT_BASE_DARK = 0.35;
  const HEAT_BASE_LIGHT = 0.75;
  const heatTmp = new Vector3();

  function renderHeatOverlay() {
    if (!heatCtx || !heatCanvas) return;
    const w = heatCanvas.width;
    const h = heatCanvas.height;
    heatCtx.clearRect(0, 0, w, h);
    if (!currentHeatMode || simNodes.length === 0) return;

    // Escala px/unidad-de-mundo ISOTRÓPICA (misma fórmula que el LOD): depende solo de
    // la distancia cámara→centro y del FOV, NO del ángulo. Medirla proyectando un eje
    // del mundo (p.ej. X) daba un factor que se escorzaba al orbitar → el radio del
    // splat colapsaba a 0 mirando a lo largo de ese eje y el glow "parpadeaba" 0→1.
    const target = (graph.controls() as unknown as OrbitControlsLike).target;
    const dist = camera.position.distanceTo(target) || 1;
    const halfFovTan = Math.tan(((camera.fov ?? DEFAULT_FOV_3D) * Math.PI) / 360);
    const ppu = h / (2 * dist * halfFovTan) || 1;

    const heatBase = lightTheme ? HEAT_BASE_LIGHT : HEAT_BASE_DARK;
    for (const node of simNodes) {
      heatTmp.set(node.x ?? 0, node.y ?? 0, node.z ?? 0).project(camera);
      if (heatTmp.z > 1 || heatTmp.z < -1) continue; // fuera del frustum en profundidad
      const sx = (heatTmp.x * 0.5 + 0.5) * w;
      const sy = (-heatTmp.y * 0.5 + 0.5) * h;
      // Hover → los demás se apagan (paridad con la mejora que pidió el usuario).
      let dim = 1;
      if (hoverNodeId !== null) {
        dim = node.id === hoverNodeId ? 1
          : (adjacency.get(hoverNodeId)?.has(node.id) ? 0.7 : 0.15);
      }
      const score = Math.max(node.heat_score, 0.05);
      const radius = Math.max(6, (HEAT_SPLAT_WORLD + node._r * 2) * ppu);
      const rgb = heatColorRGB(score);
      const alpha = heatBase * Math.max(0.15, score) * dim;
      const grad = heatCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`);
      grad.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha * 0.5})`);
      grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      heatCtx.fillStyle = grad;
      heatCtx.beginPath();
      heatCtx.arc(sx, sy, radius, 0, Math.PI * 2);
      heatCtx.fill();
    }
  }

  // Cámara perspectiva (controlType 'orbit'; la lib no la sustituye en vida de la
  // instancia). FOV determinista al crear (mejora 3): el slider de la UI parte de
  // DEFAULT_FOV_3D sin tener que leer el estado interno de la lib.
  const camera = graph.camera() as PerspectiveCamera;
  camera.fov = DEFAULT_FOV_3D;
  camera.updateProjectionMatrix();

  // ─── Estado ─────────────────────────────────────────────────────
  let frozen = false;
  let lightTheme = readLightTheme();
  let currentColorMode: GraphColorMode = 'type';
  let currentHeatMode = false;
  let currentShowHulls = false;
  let currentHighlightNodeIds = new Set<string>();
  let currentHighlightEdgeIds = new Set<string>();
  let currentPathEndpointIds = new Set<string>(); // extremos del camino más corto
  let currentSearchMatches: Set<string> | null = null;
  let currentSelectedNodeId: string | null = null;
  let hoverNodeId: string | null = null;

  let simNodes: ThreeSimNode[] = [];
  let simLinks: ThreeSimLink[] = [];
  let nodesById = new Map<string, ThreeSimNode>();
  let adjacency = new Map<string, Set<string>>();
  const groupsById = new Map<string, Group>();

  // Estado community (derivado en cada update, misma lógica que el 2D).
  let significantSet = new Set<number>();
  let communityGridIndex = new Map<number, number>();
  let communityLabels = new Map<number, string>();
  let communityGridCols = 1;
  let communityGridRows = 1;

  let visualCtx: NodeVisualContext = {
    colorMode: 'type',
    lightTheme,
    significantSet,
    showLabels: true,
    compactLabels: false,
  };

  let hullTickCounter = 0;
  let lastPointer = { x: 0, y: 0 };

  // ─── Estados interactivos (paridad 2D exacta) ───────────────────

  function computeState(node: ThreeSimNode): NodeInteractionState {
    const id = node.id;
    const selected = id === currentSelectedNodeId;
    if (hoverNodeId !== null) {
      const hovered = id === hoverNodeId;
      const neighbor = !hovered && (adjacency.get(hoverNodeId)?.has(id) ?? false);
      return {
        hovered,
        neighbor,
        dimmed: !hovered && !neighbor,
        dimLevel: 0.4,
        selected,
        pathEndpoint: currentPathEndpointIds.has(id),
        // Con el LOD (mejora 2) el boost fuerza la label del vecino por encima del
        // umbral proyectado — paridad con la label transitoria de vecinos del 2D.
        // (hideLabels duro sigue ganando: labelState.hidden anula el boost.)
        labelBoost: neighbor,
      };
    }
    const dimmed =
      (currentHighlightNodeIds.size > 0 && !currentHighlightNodeIds.has(id)) ||
      (currentSearchMatches !== null && !currentSearchMatches.has(id));
    return {
      hovered: false, neighbor: false, dimmed, dimLevel: 0.15, selected,
      pathEndpoint: currentPathEndpointIds.has(id), labelBoost: false,
    };
  }

  function applyAllStates() {
    for (const [id, g] of groupsById) {
      const node = nodesById.get(id);
      if (node) factory.applyState(g, node, computeState(node), visualCtx);
    }
  }

  // ─── Links (color con alpha bakeada + width, leen el estado vivo) ─

  function linkAlphaFor(link: ThreeSimLink): number {
    if (hoverNodeId !== null) {
      const incident = endpointId(link.source) === hoverNodeId || endpointId(link.target) === hoverNodeId;
      return incident ? 0.7 : 0.2;
    }
    if (currentHighlightEdgeIds.size > 0) {
      return currentHighlightEdgeIds.has(link._edge.id) ? 0.8 : 0.05;
    }
    return lightTheme ? 0.5 : 0.15;
  }

  function linkColorFor(link: ThreeSimLink): string {
    const edge = link._edge;
    const alpha = linkAlphaFor(link);
    if (currentHighlightEdgeIds.size > 0 && currentHighlightEdgeIds.has(edge.id)) {
      return hexToRgba('#fbbf24', alpha);
    }
    if (currentHeatMode) {
      const rgb = heatColorRGB(edge.heat_edge);
      // heatColor(0) del 2D bakea 0.3 y el SVG lo multiplica por stroke-opacity.
      const zeroFactor = edge.heat_edge === 0 ? 0.3 : 1;
      return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha * zeroFactor})`;
    }
    const target = nodesById.get(endpointId(link.target));
    return hexToRgba(linkColor(edge.link_type, target?.entity_type), alpha);
  }

  function linkWidthFor(link: ThreeSimLink): number {
    const edge = link._edge;
    // 'inferred' SIEMPRE width 0 → la lib crea un Line (no cilindro), único objeto
    // que admite el material discontinuo. Debe ser constante: el tipo de objeto se
    // decide solo al crearlo y no puede alternar Line↔Mesh entre digests.
    if (edge.link_type === 'inferred') return 0;
    if (currentHighlightEdgeIds.size > 0 && currentHighlightEdgeIds.has(edge.id)) return 3;
    if (currentHeatMode) return 0.5 + edge.heat_edge * 3;
    if (edge.link_type === 'structural') return 3;
    return linkStrokeWidth(edge.strength);
  }

  // Links 'inferred' → patrón discontinuo (paridad con linkDashArray del 2D; en heat,
  // como en 2D, van sólidos). Un LineDashedMaterial por link, re-estilado en cada digest.
  const inferredDashMaterials = new WeakMap<ThreeSimLink, LineDashedMaterial>();

  function inferredDashMaterial(link: ThreeSimLink): LineDashedMaterial {
    let mat = inferredDashMaterials.get(link);
    if (!mat) {
      mat = new LineDashedMaterial({ dashSize: 4, gapSize: 3, transparent: true, depthWrite: false });
      inferredDashMaterials.set(link, mat);
    }
    const edge = link._edge;
    const highlighted = currentHighlightEdgeIds.size > 0 && currentHighlightEdgeIds.has(edge.id);
    const target = nodesById.get(endpointId(link.target));
    mat.color.set(highlighted ? '#fbbf24' : linkColor(edge.link_type, target?.entity_type));
    mat.opacity = linkAlphaFor(link);
    return mat;
  }

  /** Re-set del accessor → la lib re-digiere los estilos de todos los links. */
  function refreshLinkStyles() {
    graph.linkColor(graph.linkColor());
  }

  // ─── Focos de agrupación (plano XY). La cámara inicial mira -Z con +Y hacia
  // ARRIBA en pantalla, al revés que el eje y del SVG (crece hacia abajo) → se
  // niega la componente y respecto al 2D para que el layout no salga espejado. ───

  function typeFocus(n: ThreeSimNode): { x: number; y: number } {
    const idx = TYPE_ORDER.indexOf(n.entity_type);
    if (idx < 0) return { x: 0, y: 0 };
    const angle = (Math.PI * 2 * idx) / TYPE_ORDER.length - Math.PI / 2;
    return { x: Math.cos(angle) * TYPE_RING_RADIUS_3D, y: -Math.sin(angle) * TYPE_RING_RADIUS_3D };
  }

  function communityFocus(n: ThreeSimNode): { x: number; y: number } {
    const cid = n.community_id;
    const idx = cid != null ? communityGridIndex.get(cid) : undefined;
    if (idx == null) return { x: 0, y: 0 };
    const col = idx % communityGridCols;
    const row = Math.floor(idx / communityGridCols);
    const cellW = COMMUNITY_GRID_SPAN_3D / communityGridCols;
    const cellH = COMMUNITY_GRID_SPAN_3D / communityGridRows;
    return {
      x: -COMMUNITY_GRID_SPAN_3D / 2 + cellW * (col + 0.5),
      // Fila 0 (comunidad mayor) arriba, como en el 2D (+y de WebGL es arriba).
      y: COMMUNITY_GRID_SPAN_3D / 2 - cellH * (row + 0.5),
    };
  }

  function communityFocusStrength(n: ThreeSimNode): number {
    const cid = n.community_id;
    return cid != null && significantSet.has(cid) ? 0.20 : 0.05;
  }

  /** Los focos dependen del modo y del grid vigente → se re-registra en cada update(). */
  function registerAxisForces() {
    const communityMode = currentColorMode === 'community';
    const strengthFn = communityMode ? communityFocusStrength : () => 0.10;
    const focusFn = communityMode ? communityFocus : typeFocus;
    graph.d3Force('x', axisForce('x', (n) => focusFn(n).x, strengthFn) as unknown as GraphForceFn);
    graph.d3Force('y', axisForce('y', (n) => focusFn(n).y, strengthFn) as unknown as GraphForceFn);
    graph.d3Force('z', axisForce('z', () => 0, strengthFn) as unknown as GraphForceFn);
  }

  // ─── Hulls (mismas reglas 2D: heat nunca, community siempre, type con toggle) ─

  function computeHullSpecs(): HullGroupSpec[] {
    if (currentHeatMode) return [];
    const communityMode = currentColorMode === 'community';
    if (!communityMode && !currentShowHulls) return [];

    const specs: HullGroupSpec[] = [];
    const points = (members: ThreeSimNode[]): Array<[number, number, number]> =>
      members.map((n): [number, number, number] => [n.x ?? 0, n.y ?? 0, n.z ?? 0]);

    if (communityMode) {
      const byCid = new Map<number, ThreeSimNode[]>();
      for (const n of simNodes) {
        const cid = n.community_id;
        if (cid == null || !significantSet.has(cid)) continue;
        const bucket = byCid.get(cid);
        if (bucket) bucket.push(n); else byCid.set(cid, [n]);
      }
      byCid.forEach((members, cid) => {
        if (members.length < 3) return;
        const label = communityLabels.get(cid) ?? `Comunidad ${cid}`;
        specs.push({
          key: `c${cid}`,
          color: communityColor(cid),
          label: label.length > 22 ? label.slice(0, 22) + '…' : label,
          points: points(members),
          emphasized: true,
        });
      });
    } else {
      const byType = new Map<string, ThreeSimNode[]>();
      for (const n of simNodes) {
        const bucket = byType.get(n.entity_type);
        if (bucket) bucket.push(n); else byType.set(n.entity_type, [n]);
      }
      byType.forEach((members, type) => {
        if (members.length < 5) return;
        specs.push({
          key: type,
          color: entityTypeColor(type),
          label: type.toUpperCase(),
          points: points(members),
          emphasized: false,
        });
      });
    }
    return specs;
  }

  // ─── Configuración de la instancia ──────────────────────────────

  graph
    .width(config.width)
    .height(config.height)
    .backgroundColor('rgba(0,0,0,0)')
    .showNavInfo(false)
    .enableNodeDrag(true)
    .linkOpacity(1)
    // Anula el tooltip nativo de la lib (nodeLabel default 'name'): el hook ya
    // muestra el GraphNodeTooltip custom y saldrían dos tooltips por hover.
    .nodeLabel(() => '')
    .warmupTicks(0)
    .cooldownTime(15000)
    .nodeThreeObject((node) => {
      const g = factory.build(node, visualCtx);
      groupsById.set(node.id, g);
      // Estado aplicado en el build (el digest de la lib puede ser asíncrono al update()).
      factory.applyState(g, node, computeState(node), visualCtx);
      return g;
    })
    .linkColor((link) => linkColorFor(link))
    .linkWidth((link) => linkWidthFor(link))
    .linkMaterial((link) =>
      link._edge.link_type === 'inferred' && !currentHeatMode ? inferredDashMaterial(link) : null)
    .linkPositionUpdate((obj, { start, end }, link) => {
      // Solo los Line de 'inferred': hay que recalcular lineDistances tras mover la
      // geometría (sin él LineDashedMaterial pinta sólido). El resto (return false)
      // sigue el update de posición default de la lib.
      if (link._edge.link_type !== 'inferred' || !(obj instanceof Line)) return false;
      const pos = obj.geometry.getAttribute('position');
      if (!(pos instanceof BufferAttribute)) return false;
      pos.setXYZ(0, start.x, start.y || 0, start.z || 0);
      pos.setXYZ(1, end.x, end.y || 0, end.z || 0);
      pos.needsUpdate = true;
      obj.geometry.computeBoundingSphere();
      obj.computeLineDistances();
      return true;
    })
    .onNodeClick((node, event) => { config.onNodeClick(node, event); })
    .onLinkClick((link, event) => { config.onEdgeClick(link._edge, event); })
    .onNodeHover((node) => {
      const id = node ? node.id : null;
      if (id === hoverNodeId) return;
      hoverNodeId = id;
      heatDirty = true; // el hover apaga/enciende splats del campo de calor
      applyAllStates();
      refreshLinkStyles();
      if (node) {
        // La lib no da MouseEvent en hover → se sintetiza desde el último pointermove
        // (el tooltip del hook solo lee clientX/clientY).
        const synthetic = { clientX: lastPointer.x, clientY: lastPointer.y } as unknown as MouseEvent;
        config.onNodeHover(node, synthetic);
      } else {
        config.onNodeHover(null, null);
      }
    })
    .onNodeDragEnd((node) => {
      // Paridad 2D: al soltar, el nodo solo queda fijado si el grafo está congelado.
      if (!frozen) {
        const n: ThreeSimNode = node;
        n.fx = null; n.fy = null; n.fz = null;
      }
    })
    .onEngineTick(() => {
      heatDirty = true; // nodos en movimiento → recalcular el campo de calor
      hullTickCounter += 1;
      if (hullTickCounter % HULL_TICK_INTERVAL !== 0) return;
      hullManager.update(computeHullSpecs(), lightTheme);
    });

  // Fuerzas built-in (sin d3-force-3d: se configuran las de la lib vía interfaces mínimas).
  const linkForce = graph.d3Force('link') as unknown as LinkForceLike | undefined;
  linkForce?.distance(LINK_DISTANCE_3D).strength((l) => l._edge.strength ?? 0.3);
  const chargeForce = graph.d3Force('charge') as unknown as ChargeForceLike | undefined;
  chargeForce?.strength(CHARGE_3D).distanceMax(CHARGE_DISTANCE_MAX_3D);
  registerAxisForces();

  // Última posición del puntero para el tooltip; salir del contenedor limpia el hover.
  const onPointerMove = (ev: PointerEvent) => {
    lastPointer = { x: ev.clientX, y: ev.clientY };
  };
  const onPointerLeave = () => {
    // La lib conserva su pointerPos/hoverObj internos al salir del canvas: si el
    // grafo está asentado, reentrar sobre el mismo nodo no re-dispararía el hover.
    // Se simula un pointermove fuera de rango para que su raycast resuelva null
    // (la propia lib inicializa pointerPos "off canvas" con la misma idea).
    webglRenderer.domElement.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: -1e4, clientY: -1e4 }),
    );
    if (hoverNodeId === null) return;
    hoverNodeId = null;
    heatDirty = true;
    applyAllStates();
    refreshLinkStyles();
    config.onNodeHover(null, null);
  };
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerleave', onPointerLeave);

  // Órbita/dolly mueven la cámara → reproyectar el campo de calor.
  const controls = graph.controls() as unknown as {
    addEventListener(type: string, fn: () => void): void;
    removeEventListener(type: string, fn: () => void): void;
  };
  const onControlsChange = () => { heatDirty = true; };
  controls.addEventListener('change', onControlsChange);

  // ─── LOD de labels (mejora 2) — visibilidad por altura proyectada ─
  // Sustituye en 3D al umbral duro de 400 nodos: solo se ven las labels cuya altura
  // en pantalla alcanza LABEL_MIN_PX, con fade lineal hasta LABEL_FADE_PX. Bucle rAF
  // propio (la lib no expone hook por frame de render) que se cancela en destroy().

  // textHeight del SpriteText en unidades de mundo (LABEL_TEXT_HEIGHT de
  // three-node-objects — la factory no lo exporta; mantener en sincronía).
  const LABEL_TEXT_HEIGHT_WORLD = 7;
  const lodTmp = new Vector3(); // temporal reutilizado — cero allocations por nodo
  let lodFrame = 0;
  let lodParity = 0;
  let lodRafId = 0;

  function labelLODPass() {
    const viewportH = container.clientHeight;
    if (viewportH <= 0) return; // contenedor colapsado (layout transitorio) — no apagar labels
    const halfFovTan = Math.tan(((camera.fov ?? DEFAULT_FOV_3D) * Math.PI) / 360);
    // PERF: con >1500 grupos una pasada completa (setLabelLOD toca visibilidad y
    // opacity de sprites) compite con el propio render → se procesa la MITAD por
    // pasada alternando por paridad de índice; cada label se refresca igualmente
    // cada ~2·LABEL_LOD_FRAME_SKIP frames, imperceptible en órbita.
    const halved = groupsById.size > 1500;
    let index = 0;
    for (const group of groupsById.values()) {
      const skip = halved && index % 2 !== lodParity;
      index += 1;
      if (skip || !group.visible) continue;
      const dist = lodTmp.copy(group.position).sub(camera.position).length();
      // Altura proyectada del texto en px: h_world * viewportH / (2 * d * tan(fov/2)).
      const px = (LABEL_TEXT_HEIGHT_WORLD * viewportH) / (2 * dist * halfFovTan);
      const lodVisible = px >= LABEL_MIN_PX;
      const lodOpacity = clamp01((px - LABEL_MIN_PX) / (LABEL_FADE_PX - LABEL_MIN_PX));
      factory.setLabelLOD(group, lodVisible, lodOpacity);
    }
    if (halved) lodParity = 1 - lodParity;
  }

  const lodLoop = () => {
    lodRafId = requestAnimationFrame(lodLoop);
    // Campo de calor: repintar solo cuando algo cambió (cámara/sim/hover/update) →
    // en reposo no consume; renderHeatOverlay se auto-anula si no es modo heat.
    if (heatDirty) { renderHeatOverlay(); heatDirty = false; }
    lodFrame += 1;
    if (lodFrame % LABEL_LOD_FRAME_SKIP === 0) labelLODPass(); // throttle: 1 de cada N frames
  };
  lodRafId = requestAnimationFrame(lodLoop);

  // ─── API pública (contrato GraphRendererInstance) ───────────────

  function update(params: GraphRendererUpdateParams) {
    lightTheme = readLightTheme();
    starfield.setVisible(!lightTheme); // estrellas solo en tema oscuro
    applyFog(lightTheme);              // niebla solo en tema oscuro
    const prevColorMode = currentColorMode;
    currentColorMode = params.colorMode;
    currentHeatMode = params.colorMode === 'heat';
    currentShowHulls = params.showHulls;
    currentHighlightNodeIds = params.highlightNodeIds;
    currentPathEndpointIds = params.pathEndpointIds ?? new Set();
    currentHighlightEdgeIds = params.highlightEdgeIds;
    currentSearchMatches = params.searchMatches;
    const strengthThreshold = params.strengthThreshold ?? 0;

    const filteredNodes = params.nodes.filter((n) => params.visibleNodeIds.has(n.id));

    // ── Derivar estado de comunidades (top-K islas + grid + labels, como el 2D) ──
    const communities = params.communities ?? [];
    let sizeEntries: Array<{ community_id: number; size: number; label: string | null }>;
    if (communities.length > 0) {
      sizeEntries = communities.map((c) => ({ community_id: c.community_id, size: c.size, label: c.label }));
    } else {
      const counts = new Map<number, number>();
      for (const n of filteredNodes) {
        if (n.community_id != null) counts.set(n.community_id, (counts.get(n.community_id) ?? 0) + 1);
      }
      sizeEntries = [...counts.entries()].map(([community_id, size]) => ({ community_id, size, label: null }));
    }
    significantSet = significantCommunityIds(sizeEntries);
    communityLabels = new Map(
      sizeEntries.filter((e) => e.label).map((e) => [e.community_id, e.label as string]),
    );
    const ordered = sizeEntries
      .filter((e) => significantSet.has(e.community_id))
      .sort((a, b) => b.size - a.size);
    communityGridIndex = new Map(ordered.map((e, i) => [e.community_id, i]));
    const k = Math.max(1, ordered.length);
    communityGridCols = Math.ceil(Math.sqrt(k));
    communityGridRows = Math.ceil(k / communityGridCols);

    // ── Nodos: preservar la MISMA instancia de los que permanecen (la lib conserva
    // su Group → no se regenera la escena) además de x/y/z y velocidades. ──
    const prevById = nodesById;
    // Nodos preservados cuyo color por datos (heat_score/community) quedó obsoleto
    // sin disparar ctxChanged → restyle puntual tras el graphData.
    const staleColorIds: string[] = [];
    simNodes = filteredNodes.map((n) => {
      const prev = prevById.get(n.id);
      const r = nodeSize(n.mention_count) / 2;
      if (prev) {
        if (r !== prev._r) {
          // Radio cambiado → instancia NUEVA para que el digest de la lib regenere
          // el Group (geometría + label a la escala correcta), conservando posición
          // y velocidad como hace el 2D en cada re-bind.
          return {
            ...n,
            _r: r,
            x: prev.x, y: prev.y, z: prev.z,
            vx: prev.vx, vy: prev.vy, vz: prev.vz,
          };
        }
        if (prev.heat_score !== n.heat_score || prev.community_id !== n.community_id) {
          staleColorIds.push(n.id);
        }
        Object.assign(prev, n);
        prev._r = r;
        if (!frozen) { prev.fx = null; prev.fy = null; prev.fz = null; }
        return prev;
      }
      return { ...n, _r: r };
    });
    nodesById = new Map(simNodes.map((n) => [n.id, n]));

    // Links: preservar también la MISMA instancia de los que permanecen — el digest
    // de la lib se clava por identidad de objeto, y recrearlos destruiría/recrearía
    // TODAS las mallas (geometrías + materiales GPU) en cada pulsación de búsqueda
    // o paso del slider.
    const prevLinksByEdgeId = new Map(simLinks.map((l) => [l._edge.id, l]));
    simLinks = params.edges
      .filter((e) =>
        nodesById.has(e.source_id) && nodesById.has(e.target_id)
        && (e.strength ?? 0) >= strengthThreshold)
      .map((e) => {
        const prev = prevLinksByEdgeId.get(e.id);
        if (prev && endpointId(prev.source) === e.source_id && endpointId(prev.target) === e.target_id) {
          prev._edge = e;
          // Re-anclar a las instancias vigentes (un endpoint puede haberse regenerado).
          prev.source = nodesById.get(e.source_id) ?? e.source_id;
          prev.target = nodesById.get(e.target_id) ?? e.target_id;
          return prev;
        }
        return { source: e.source_id, target: e.target_id, _edge: e };
      });

    // Adjacency para el dimming de hover.
    adjacency = new Map();
    for (const l of simLinks) {
      const e = l._edge;
      let s = adjacency.get(e.source_id);
      if (!s) { s = new Set(); adjacency.set(e.source_id, s); }
      s.add(e.target_id);
      let t = adjacency.get(e.target_id);
      if (!t) { t = new Set(); adjacency.set(e.target_id, t); }
      t.add(e.source_id);
    }

    // Purga de Groups de nodos que desaparecen.
    for (const id of [...groupsById.keys()]) {
      if (!nodesById.has(id)) groupsById.delete(id);
    }

    // ── Contexto visual: restyle (sin regenerar) solo si cambió ──
    const newCtx: NodeVisualContext = {
      colorMode: currentColorMode,
      lightTheme,
      significantSet,
      // Apagado DURO únicamente (hideLabels ⇒ labelState.hidden en la factory); la
      // visibilidad real por nodo la decide el LOD proyectado (mejora 2), que
      // sustituye en 3D al umbral de LABEL_HIDE_THRESHOLD nodos del 2D.
      showLabels: !params.hideLabels,
      compactLabels: params.compactLabels,
    };
    const ctxChanged =
      visualCtx.colorMode !== newCtx.colorMode ||
      visualCtx.lightTheme !== newCtx.lightTheme ||
      visualCtx.showLabels !== newCtx.showLabels ||
      visualCtx.compactLabels !== newCtx.compactLabels ||
      !sameSet(visualCtx.significantSet, newCtx.significantSet);
    visualCtx = newCtx;

    registerAxisForces();
    if (currentColorMode !== prevColorMode) graph.d3ReheatSimulation();

    graph.graphData({ nodes: simNodes, links: simLinks });

    if (frozen) {
      for (const n of simNodes) { n.fx = n.x; n.fy = n.y; n.fz = n.z; }
    }

    if (ctxChanged) {
      for (const [id, g] of groupsById) {
        const n = nodesById.get(id);
        if (n) factory.restyle(g, n, visualCtx);
      }
    } else {
      for (const id of staleColorIds) {
        const g = groupsById.get(id);
        const n = nodesById.get(id);
        if (g && n) factory.restyle(g, n, visualCtx);
      }
    }
    applyAllStates();

    // Refresco inmediato de hulls (los toggles pueden cambiar sin que la sim reheat).
    hullManager.update(computeHullSpecs(), lightTheme);
    // Repintar el campo de calor (cambió el modo, los datos, el tema o el hover).
    heatDirty = true;
  }

  function resize(w: number, h: number) {
    graph.width(w).height(h);
    if (heatCanvas) { heatCanvas.width = w; heatCanvas.height = h; }
    heatDirty = true;
  }

  /** Dolly de cámara hacia el target de los OrbitControls (0.7 acerca / 1.4 aleja). */
  function dolly(factor: number) {
    const controls = graph.controls() as unknown as OrbitControlsLike;
    const cam = graph.cameraPosition();
    const t = controls.target;
    graph.cameraPosition(
      {
        x: t.x + (cam.x - t.x) * factor,
        y: t.y + (cam.y - t.y) * factor,
        z: t.z + (cam.z - t.z) * factor,
      },
      { x: t.x, y: t.y, z: t.z },
      300,
    );
  }

  function zoomIn() { dolly(0.7); }
  function zoomOut() { dolly(1.4); }
  function zoomReset() { graph.zoomToFit(400); }

  function freeze() {
    frozen = true;
    for (const n of simNodes) { n.fx = n.x; n.fy = n.y; n.fz = n.z; }
  }

  function unfreeze() {
    frozen = false;
    for (const n of simNodes) { n.fx = null; n.fy = null; n.fz = null; }
    graph.d3ReheatSimulation();
  }

  function centerOnNode(nodeId: string) {
    const n = nodesById.get(nodeId);
    if (!n) return;
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    const z = (n.z ?? 0) || 1e-3;
    const distancia = 40 + 60 * (n._r / 10);
    const distRatio = 1 + distancia / Math.hypot(x, y, z);
    graph.cameraPosition(
      { x: x * distRatio, y: y * distRatio, z: z * distRatio },
      { x, y, z: n.z ?? 0 },
      800,
    );
  }

  function setExternalHover(nodeId: string | null) {
    if (nodeId === hoverNodeId) return;
    hoverNodeId = nodeId;
    heatDirty = true;
    applyAllStates();
    refreshLinkStyles();
  }

  function setSelectedNode(nodeId: string | null) {
    currentSelectedNodeId = nodeId;
    applyAllStates();
  }

  /** FOV de la cámara en grados (mejora 3) — clamp FOV_MIN_3D..FOV_MAX_3D. */
  function setFov(fov: number) {
    camera.fov = Math.min(FOV_MAX_3D, Math.max(FOV_MIN_3D, fov));
    camera.updateProjectionMatrix();
  }

  function destroy() {
    cancelAnimationFrame(lodRafId);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerleave', onPointerLeave);
    controls.removeEventListener('change', onControlsChange);
    if (heatCtx && heatCanvas) heatCtx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
    starfield.dispose();
    hullManager.dispose();
    factory.dispose();
    graph.pauseAnimation();
    graph._destructor();
    try {
      webglRenderer.dispose();
      webglRenderer.forceContextLoss();
    } catch {
      // El contexto puede estar ya perdido — nada que liberar.
    }
    groupsById.clear();
    container.replaceChildren();
  }

  return {
    update,
    resize,
    zoomIn,
    zoomOut,
    zoomReset,
    freeze,
    unfreeze,
    isFrozen: () => frozen,
    centerOnNode,
    setExternalHover,
    setSelectedNode,
    setFov,
    destroy,
  };
};
