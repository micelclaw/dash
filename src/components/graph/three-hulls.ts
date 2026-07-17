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
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import SpriteText from 'three-spritetext';
import { HULL_PADDING_3D } from './three-contracts';
import type { CreateHullManager, HullGroupSpec } from './three-contracts';

/**
 * Hulls 3D: envolventes convexas translúcidas por grupo (community/type) con
 * label flotante — paridad con los hulls SVG del renderer 2D. Ver HullManager
 * en three-contracts.ts (el JSDoc de ahí es la spec).
 */

/** Elevación de la label sobre el punto más alto del grupo. */
const LABEL_LIFT_Y = 18;
/** Por encima de las meshes translúcidas para que ningún hull tape la label. */
const LABEL_RENDER_ORDER = 10;

interface HullEntry {
  mesh: THREE.Mesh;
  label: SpriteText;
}

/** Los hulls son decorativos: no deben robar el hover de los nodos a la lib. */
const noopRaycast = (): void => {
  /* sin intersecciones */
};

/** Sobre fondo claro las alphas del tema oscuro se lavan → se suben. */
function hullOpacity(emphasized: boolean, lightTheme: boolean): number {
  if (lightTheme) return emphasized ? 0.16 : 0.08;
  return emphasized ? 0.10 : 0.05;
}

function disposeEntry(scene: THREE.Scene, entry: HullEntry): void {
  scene.remove(entry.mesh);
  scene.remove(entry.label);
  entry.mesh.geometry.dispose();
  (entry.mesh.material as THREE.Material).dispose();
  // La geometría del Sprite es compartida por three — solo textura + material.
  entry.label.material.map?.dispose();
  entry.label.material.dispose();
}

/** Grosor del prisma sintético para grupos de 3 puntos (siempre coplanares). */
const TRIANGLE_HULL_THICKNESS = 4;

/**
 * Inflado radial (mejora 4): expande cada punto desde el centroide del grupo
 * (p' = p + normalize(p - centroide) * HULL_PADDING_3D) para que el hull
 * ENVUELVA los nodos con margen — paridad con expandPolygon del 2D — en vez
 * de pasar por sus centros. Un punto EN el centroide (|p - c| < 1e-6) se
 * desplaza un épsilon determinista por índice para no generar NaN y engordar
 * también ese punto.
 */
function inflatePoints(points: Array<[number, number, number]>): Array<[number, number, number]> {
  if (points.length === 0) return points;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const [x, y, z] of points) {
    cx += x;
    cy += y;
    cz += z;
  }
  cx /= points.length;
  cy /= points.length;
  cz /= points.length;
  const pad = HULL_PADDING_3D;
  return points.map(([x, y, z], i): [number, number, number] => {
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) {
      // Offset unitario rotando ejes según i%6: [±pad,0,0]/[0,±pad,0]/[0,0,±pad].
      switch (i % 6) {
        case 0: return [x + pad, y, z];
        case 1: return [x - pad, y, z];
        case 2: return [x, y + pad, z];
        case 3: return [x, y - pad, z];
        case 4: return [x, y, z + pad];
        default: return [x, y, z - pad];
      }
    }
    const k = pad / len;
    return [x + dx * k, y + dy * k, z + dz * k];
  });
}

/**
 * ConvexGeometry exige ≥4 puntos no coplanares; QuickHull lanza con puntos
 * degenerados → null = omitir el hull este tick. Paridad 2D: una comunidad de
 * 3 nodos SÍ pinta blob (d3.polygonHull acepta triángulos) → se extruye el
 * triángulo ±grosor a lo largo de su normal para darle el volumen mínimo.
 * Recibe los puntos YA inflados (inflatePoints) — también el caso 3-puntos
 * infla ANTES de extruir.
 */
function buildHullGeometry(points: Array<[number, number, number]>): ConvexGeometry | null {
  if (points.length < 3) return null;
  let vectors = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  if (points.length === 3) {
    const [a, b, c] = vectors as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    // Colineales este tick → sin normal fiable (normalize daría NaN).
    if (normal.lengthSq() < 1e-6) return null;
    normal.normalize().multiplyScalar(TRIANGLE_HULL_THICKNESS / 2);
    vectors = vectors.flatMap((v) => [v.clone().add(normal), v.clone().sub(normal)]);
  }
  try {
    return new ConvexGeometry(vectors);
  } catch {
    return null;
  }
}

/** Centroide XZ del grupo, elevada sobre su punto más alto para flotar encima. */
function placeLabel(label: SpriteText, points: Array<[number, number, number]>): void {
  let cx = 0;
  let cz = 0;
  let maxY = -Infinity;
  for (const [x, y, z] of points) {
    cx += x;
    cz += z;
    if (y > maxY) maxY = y;
  }
  label.position.set(cx / points.length, maxY + LABEL_LIFT_Y, cz / points.length);
}

export const createHullManager: CreateHullManager = (scene) => {
  const entries = new Map<string, HullEntry>();

  const remove = (key: string): void => {
    const entry = entries.get(key);
    if (!entry) return;
    disposeEntry(scene, entry);
    entries.delete(key);
  };

  const applySpec = (spec: HullGroupSpec, lightTheme: boolean): void => {
    // Inflar UNA vez: geometría y label comparten los mismos puntos expandidos.
    const inflated = inflatePoints(spec.points);
    const geometry = buildHullGeometry(inflated);
    if (!geometry) {
      // Grupo degradado (<4 puntos o QuickHull falló) → sin hull este tick.
      remove(spec.key);
      return;
    }

    let entry = entries.get(spec.key);
    if (entry) {
      entry.mesh.geometry.dispose();
      entry.mesh.geometry = geometry;
    } else {
      const material = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: hullOpacity(spec.emphasized, lightTheme),
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.raycast = noopRaycast;
      const label = new SpriteText(spec.label);
      label.raycast = noopRaycast;
      label.renderOrder = LABEL_RENDER_ORDER;
      scene.add(mesh);
      scene.add(label);
      entry = { mesh, label };
      entries.set(spec.key, entry);
    }

    const material = entry.mesh.material as THREE.MeshBasicMaterial;
    material.color.set(spec.color);
    material.opacity = hullOpacity(spec.emphasized, lightTheme);

    // Los setters de SpriteText regeneran la textura → solo tocar si cambian.
    const { label } = entry;
    if (label.text !== spec.label) label.text = spec.label;
    const textHeight = spec.emphasized ? 11 : 9;
    if (label.textHeight !== textHeight) label.textHeight = textHeight;
    const labelColor = `${spec.color}${spec.emphasized ? 'cc' : '66'}`;
    if (label.color !== labelColor) label.color = labelColor;
    // Puntos inflados: la label flota sobre el hull real que se ve.
    placeLabel(label, inflated);
  };

  const clear = (): void => {
    for (const entry of entries.values()) disposeEntry(scene, entry);
    entries.clear();
  };

  return {
    update(specs, lightTheme) {
      const incoming = new Set(specs.map((s) => s.key));
      for (const key of [...entries.keys()]) {
        if (!incoming.has(key)) remove(key);
      }
      for (const spec of specs) applySpec(spec, lightTheme);
    },
    clear,
    dispose: clear,
  };
};
