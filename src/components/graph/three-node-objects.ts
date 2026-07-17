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

import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import {
  entityTypeColor, entityTypeShape, communityColor, heatColorRGB, wrapLabelLines,
} from './graph-utils';
import type { NodeShape } from './graph-utils';
import { LABEL_MAX_CHARS } from './graph-renderer-contract';
import type {
  CreateNodeObjectFactory,
  NodeInteractionState,
  NodeVisualContext,
  ThreeSimNode,
} from './three-contracts';

// Paridad con labelColor(0.85) del renderer 2D (blanco en oscuro, casi-negro en claro).
const LABEL_COLOR_LIGHT = 'rgba(42,40,36,0.85)';
const LABEL_COLOR_DARK = 'rgba(255,255,255,0.85)';
const SELECTION_COLOR = '#f59e0b'; // stroke ámbar de selección del 2D
const LABEL_TEXT_HEIGHT = 7;
const OUTLINE_SCALE = 1.12;
// Glow (mejora 5) — en claro (NormalBlending) la opacidad baja al 60% de la de oscuro.
const GLOW_LIGHT_OPACITY_FACTOR = 0.6;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Glow/outline/label son decorativos y el Raycaster IGNORA .visible → sin esto crean
// zonas fantasma de hover/click (mismo patrón que three-hulls). Solo 'shape' raycastea.
const noopRaycast = (): void => {};

/** Color del nodo según modo — misma lógica que nonHeatNodeColor del 2D + heat. */
function resolveNodeColor(node: ThreeSimNode, ctx: NodeVisualContext): THREE.Color {
  if (ctx.colorMode === 'heat') {
    const { r, g, b } = heatColorRGB(node.heat_score);
    return new THREE.Color(r / 255, g / 255, b / 255);
  }
  if (ctx.colorMode === 'community') {
    const cid = node.community_id;
    return new THREE.Color(communityColor(cid != null && ctx.significantSet.has(cid) ? cid : null));
  }
  return new THREE.Color(entityTypeColor(node.entity_type));
}

/** En heat el glow ES el heat (∝ score); en type/community, look luminoso uniforme.
 *  Suelo emissive alto en heat (0.55) → hasta los nodos fríos brillan como los anillos
 *  cian vívidos del 2D, no como sólidos apagados. */
function emissiveIntensityFor(node: ThreeSimNode, ctx: NodeVisualContext): number {
  // No-heat: emissive BAJO (0.15) para que la luz direccional sombree las caras y el
  // sólido 3D se lea (antes 0.3 aplanaba el modelo). Heat: alto = el glow ES el heat.
  return ctx.colorMode === 'heat' ? 0.55 + clamp01(node.heat_score) * 0.8 : 0.15;
}

function labelTextFor(node: ThreeSimNode, ctx: NodeVisualContext): string {
  return ctx.compactLabels ? wrapLabelLines(node.name, LABEL_MAX_CHARS, 2).join('\n') : node.name;
}

function labelColorFor(ctx: NodeVisualContext): string {
  return ctx.lightTheme ? LABEL_COLOR_LIGHT : LABEL_COLOR_DARK;
}

function meshByName(group: THREE.Group, name: string): THREE.Mesh | null {
  const obj = group.getObjectByName(name);
  return obj instanceof THREE.Mesh ? obj : null;
}

function labelOf(group: THREE.Group): SpriteText | null {
  const obj = group.getObjectByName('label');
  return obj instanceof SpriteText ? obj : null;
}

function glowOf(group: THREE.Group): THREE.Sprite | null {
  const obj = group.getObjectByName('glow');
  return obj instanceof THREE.Sprite ? obj : null;
}

// ─── LOD de labels (mejora 2) ────────────────────────────────────────────────

/** Estado de label que publica applyState; setLabelLOD lo combina con el LOD. */
interface LabelState {
  hidden: boolean;
  boost: boolean;
  opacity: number;
}

/** Vista tipada de group.userData (three lo declara como registro laxo). */
interface LabelLodUserData {
  labelState?: LabelState;
  __lodVisible?: boolean;
  __lodOpacity?: number;
}

/**
 * Única escritura de label.visible/opacity: combina el labelState de applyState
 * con el LOD cacheado por el renderer (visible = !hidden && (boost || lodVisible);
 * opacity = labelState.opacity * (boost ? 1 : lodOpacity)).
 */
function refreshLabelLOD(group: THREE.Group): void {
  const label = labelOf(group);
  if (!label) return;
  const ud = group.userData as LabelLodUserData;
  const hidden = ud.labelState?.hidden ?? false;
  const boost = ud.labelState?.boost ?? false;
  const baseOpacity = ud.labelState?.opacity ?? 0.85;
  const lodVisible = ud.__lodVisible ?? false;
  const lodOpacity = ud.__lodOpacity ?? 0;
  label.visible = !hidden && (boost || lodVisible);
  label.material.opacity = baseOpacity * (boost ? 1 : lodOpacity);
}

// ─── Billboard y glow (mejoras 1 y 5) ───────────────────────────────────────

/** Billboard (mejora 1): la silueta 2D mira a la cámara en cada frame de órbita. */
function billboard(mesh: THREE.Mesh): void {
  mesh.onBeforeRender = (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera): void => {
    mesh.quaternion.copy(camera.quaternion);
  };
}

/** Gradiente radial blanco (se tinta con material.color) — UNA textura por factory. */
function createGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx2d = canvas.getContext('2d');
  if (ctx2d) {
    // Mismos stops que el splat 2D (renderHeatBackground): (0,1)(0.4,0.5)(1,0).
    // Blanco = solo la FORMA del gradiente; el color lo pone material.color (tinte),
    // así el sprite pinta el heatColor puro con esta alpha → como el rgba() del 2D.
    const gradient = ctx2d.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx2d.fillStyle = gradient;
    ctx2d.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Estilo del glow (mejora 5) — heat: splat permanente ∝ score (los aditivos
 * solapados se funden entre nodos, paridad splats canvas 2D); no-heat: solo hover.
 */
function styleGlow(
  glow: THREE.Sprite,
  node: ThreeSimNode,
  ctx: NodeVisualContext,
  hovered: boolean,
): void {
  const mat = glow.material;
  const themeFactor = ctx.lightTheme ? GLOW_LIGHT_OPACITY_FACTOR : 1;
  if (ctx.colorMode === 'heat') {
    // El campo de calor lo pinta un canvas 2D DETRÁS del WebGL (paridad exacta con el
    // 2D: splats radiales source-over). El sprite-glow por nodo se APAGA para no
    // duplicar ni lavar. No-heat (bloom de hover de 1 nodo) usa blending aditivo.
    glow.visible = false;
    return;
  }
  if (mat.blending !== THREE.AdditiveBlending) {
    mat.blending = THREE.AdditiveBlending;
    mat.needsUpdate = true;
  }
  {
    glow.visible = hovered;
    mat.color.copy(resolveNodeColor(node, ctx));
    glow.scale.setScalar(node._r * 3.4 * 2);
    mat.opacity = 0.5 * themeFactor;
  }
}

/** transparent solo mientras opacity<1 — evita el coste de sorting al restaurar. */
function setMeshOpacity(material: THREE.Material, opacity: number): void {
  material.opacity = opacity;
  material.transparent = opacity < 1;
}

export const createNodeObjectFactory: CreateNodeObjectFactory = () => {
  // Geometrías compartidas entre nodos — clave `${forma}:${bucket}` (radio a 0.5).
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  // Materiales per-nodo (applyState muta opacity/emissive → nunca compartidos) y
  // sprites de label: se registran para liberarlos todos en dispose(). Se PODAN
  // cuando three-forcegraph los dispone al eliminar su nodo — sin poda, los Sets
  // retendrían en heap cada material/canvas hasta destruir el renderer.
  const materials = new Set<THREE.Material>();
  const sprites = new Set<SpriteText>();

  function buildShapeGeometry(shape: NodeShape, r: number): THREE.BufferGeometry {
    // rotateX(π/2): cara plana hacia +Z para que el billboard muestre la silueta 2D.
    switch (shape) {
      case 'square': return new THREE.BoxGeometry(1.6 * r, 1.6 * r, 1.6 * r).rotateX(Math.PI / 2);
      case 'diamond': return new THREE.OctahedronGeometry(r);
      case 'triangle': return new THREE.ConeGeometry(r, 2 * r, 3);
      case 'hexagon': return new THREE.CylinderGeometry(r, r, 0.8 * r, 6).rotateX(Math.PI / 2);
      case 'octagon': return new THREE.CylinderGeometry(r, r, 0.8 * r, 8).rotateX(Math.PI / 2);
      case 'circle':
      default: return new THREE.SphereGeometry(r, 16, 12);
    }
  }

  function getGeometry(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geom = geometryCache.get(key);
    if (!geom) {
      geom = build();
      // three-forcegraph hace dispose() de la geometría de cada nodo al eliminarlo, pero
      // estas están cacheadas y COMPARTIDAS entre nodos vivos → se neutraliza aquí; la
      // liberación real la hace dispose() de la factory vía el prototipo.
      geom.dispose = () => {};
      geometryCache.set(key, geom);
    }
    return geom;
  }

  function shapeGeometry(shape: NodeShape, r: number): THREE.BufferGeometry {
    const bucket = Math.round(r * 2) / 2;
    return getGeometry(`${shape}:${bucket}`, () => buildShapeGeometry(shape, bucket));
  }

  // Textura compartida del glow (mejora 5). three-forcegraph dispone material.map
  // al eliminar cada nodo → dispose neutralizado (misma técnica que las geometrías
  // cacheadas); la liberación real la hace dispose() de la factory vía prototipo.
  const glowTexture = createGlowTexture();
  glowTexture.dispose = () => {};

  function registerMaterial<T extends THREE.Material>(material: T): T {
    materials.add(material);
    material.addEventListener('dispose', () => { materials.delete(material); });
    return material;
  }

  function build(node: ThreeSimNode, ctx: NodeVisualContext): THREE.Group {
    const group = new THREE.Group();
    group.userData.nodeId = node.id;

    const r = node._r;
    const shapeKind = entityTypeShape(node.entity_type);
    const color = resolveNodeColor(node, ctx);
    const geometry = shapeGeometry(shapeKind, r);

    const shape = new THREE.Mesh(geometry, registerMaterial(new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: emissiveIntensityFor(node, ctx),
    })));
    shape.name = 'shape';
    if (shapeKind !== 'circle') billboard(shape); // mejora 1
    group.add(shape);

    // Glow aditivo (mejora 5): sprite tintado per-nodo sobre la textura compartida.
    const glow = new THREE.Sprite(registerMaterial(new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      depthWrite: false,
    })));
    glow.name = 'glow';
    glow.raycast = noopRaycast;
    glow.renderOrder = -1; // detrás del shape
    styleGlow(glow, node, ctx, false);
    group.add(glow);

    // Misma geometría cacheada que el shape, escalada — cáscara ámbar de selección.
    const outline = new THREE.Mesh(geometry, registerMaterial(new THREE.MeshBasicMaterial({
      color: SELECTION_COLOR,
      side: THREE.BackSide,
    })));
    outline.name = 'outline';
    outline.raycast = noopRaycast;
    outline.scale.setScalar(OUTLINE_SCALE);
    outline.visible = false; // solo cuando selected (applyState)
    if (shapeKind !== 'circle') billboard(outline); // mejora 1
    group.add(outline);

    const text = labelTextFor(node, ctx);
    const labelColor = labelColorFor(ctx);
    const label = new SpriteText(text, LABEL_TEXT_HEIGHT, labelColor);
    label.name = 'label';
    label.raycast = noopRaycast;
    label.backgroundColor = false;
    label.position.y = -(r + 9);
    label.userData.labelKey = `${text}\u0000${labelColor}`;
    sprites.add(label);
    // SpriteText crea su material UNA sola vez (los regen solo cambian .map) → cuando
    // la lib lo dispone al eliminar el nodo, podamos el registro y se suelta el canvas.
    label.material.addEventListener('dispose', () => { sprites.delete(label); });
    group.add(label);

    // LOD de labels (mejora 2): la visibilidad final la deciden labelState × LOD.
    // ctx.showLabels solo siembra el LOD hasta el primer pase del renderer.
    const ud = group.userData as LabelLodUserData;
    ud.labelState = { hidden: !ctx.showLabels, boost: false, opacity: 0.85 };
    ud.__lodVisible = ctx.showLabels;
    ud.__lodOpacity = ctx.showLabels ? 1 : 0;
    refreshLabelLOD(group);

    return group;
  }

  function restyle(group: THREE.Group, node: ThreeSimNode, ctx: NodeVisualContext): void {
    const color = resolveNodeColor(node, ctx);

    const shape = meshByName(group, 'shape');
    if (shape) {
      const mat = shape.material as THREE.MeshLambertMaterial;
      mat.color.copy(color);
      mat.emissive.copy(color);
      mat.emissiveIntensity = emissiveIntensityFor(node, ctx);
    }

    const glow = glowOf(group);
    if (glow) styleGlow(glow, node, ctx, false); // applyState refina hover/dim después

    const label = labelOf(group);
    if (label) {
      // Regenerar la textura del sprite es caro → solo si cambió texto o color.
      const text = labelTextFor(node, ctx);
      const labelColor = labelColorFor(ctx);
      const key = `${text}\u0000${labelColor}`;
      if (label.userData.labelKey !== key) {
        label.userData.labelKey = key;
        label.text = text;
        label.color = labelColor;
      }
      refreshLabelLOD(group); // la visibilidad la gobiernan labelState × LOD (mejora 2)
    }
  }

  function applyState(
    group: THREE.Group,
    node: ThreeSimNode,
    state: NodeInteractionState,
    ctx: NodeVisualContext,
  ): void {
    // Factor de atenuación del grupo — paridad 2D: la selección NO exime del dimming
    // (en 2D el nodo seleccionado también baja a 0.85/0.4/0.15; solo conserva el stroke).
    const opacity = state.hovered ? 1
      : state.neighbor ? 0.85
        : state.dimmed ? state.dimLevel
          : 1;

    const shape = meshByName(group, 'shape');
    if (shape) setMeshOpacity(shape.material as THREE.Material, opacity);

    // Glow: visible en hover (bloom) y forzado en los EXTREMOS del camino más corto,
    // tintado de ámbar → resaltado fuerte y luminoso sobre los intermedios.
    const glow = glowOf(group);
    if (glow) {
      styleGlow(glow, node, ctx, state.hovered || state.pathEndpoint);
      if (state.pathEndpoint && ctx.colorMode !== 'heat') {
        glow.material.color.set(SELECTION_COLOR);
      }
    }

    const outline = meshByName(group, 'outline');
    if (outline) {
      // Outline ámbar: nodo seleccionado O extremo del camino (jerarquía: extremo > intermedio).
      outline.visible = state.selected || state.pathEndpoint;
      // El stroke ámbar del 2D también hereda la opacidad del grupo.
      setMeshOpacity(outline.material as THREE.Material, opacity);
    }

    const label = labelOf(group);
    if (label) {
      // labelBoost = label transitoria de vecino en hover con labels ocultas (paridad 2D):
      // 1 sola línea truncada, como el trunc() del hover del 2D.
      const boosted = state.labelBoost && !ctx.showLabels;
      const text = boosted
        ? (node.name.length > LABEL_MAX_CHARS ? node.name.slice(0, LABEL_MAX_CHARS) + '…' : node.name)
        : labelTextFor(node, ctx);
      if (label.text !== text) label.text = text; // regenerar la textura solo si cambia
      // Mejora 2: aquí NO se fija label.visible/opacity — se publica el estado y
      // refreshLabelLOD lo combina con el último LOD cacheado (setLabelLOD).
      // hidden = apagado duro (hideLabels ⇒ !ctx.showLabels; gana también al boost,
      // el LOD no puede reencender la label) o dimming profundo de search/highlight.
      (group.userData as LabelLodUserData).labelState = {
        hidden: !ctx.showLabels || (state.dimmed && state.dimLevel <= 0.15),
        boost: state.labelBoost,
        opacity: state.hovered || state.neighbor ? 0.9 : state.dimmed ? 0.4 : 0.85,
      };
      refreshLabelLOD(group);
    }
  }

  /** LOD de labels (mejora 2): cachea el LOD del renderer y recombina con labelState. */
  function setLabelLOD(group: THREE.Group, lodVisible: boolean, lodOpacity: number): void {
    const ud = group.userData as LabelLodUserData;
    ud.__lodVisible = lodVisible;
    ud.__lodOpacity = lodOpacity;
    refreshLabelLOD(group);
  }

  function dispose(): void {
    // El dispose() de instancia de las cacheadas está neutralizado → liberar vía prototipo.
    for (const geom of geometryCache.values()) THREE.BufferGeometry.prototype.dispose.call(geom);
    geometryCache.clear();
    for (const mat of materials) mat.dispose();
    materials.clear();
    for (const sprite of sprites) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    sprites.clear();
    THREE.Texture.prototype.dispose.call(glowTexture);
  }

  return { build, restyle, applyState, setLabelLOD, dispose };
};
