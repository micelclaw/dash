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

/**
 * Campo de estrellas de fondo para la vista 3D, EN EL MUNDO (no pegado a la cámara):
 * al orbitar, los OrbitControls giran la vista y las estrellas se desplazan por
 * parallax → "fondo lejano" sin bucle de animación. Se añade a graph.scene() y persiste
 * (el digest de la lib solo gestiona los objetos de nodo).
 *
 * VARIEDAD tipo "cielo real": un PointsMaterial tiene UN único tamaño por objeto, así
 * que se combinan VARIAS capas (Points) con tamaños/opacidades distintos — muchas
 * diminutas y tenues, algunas medianas, pocas grandes y brillantes. El brillo por
 * estrella DENTRO de cada capa varía vía vertexColors.
 */

/** Radio del cascarón (muy por fuera del grafo, ~±500) → se sienten lejanas. */
const STAR_RADIUS = 6000;
/** Grosor del cascarón: radio en [R*STAR_SHELL, R]. */
const STAR_SHELL = 0.55;

interface StarLayer {
  count: number;
  /** Tamaño en px (sizeAttenuation:false → constante). */
  size: number;
  opacity: number;
  /** Rango de brillo por estrella dentro de la capa (gris, aditivo). */
  bMin: number;
  bMax: number;
}

// De diminutas+tenues (muchas) a grandes+brillantes (pocas) → aspecto de cielo real.
// Los TAMAÑOS se mantienen; se sube brillo (opacity + rango b) para que brillen más.
const STAR_LAYERS: StarLayer[] = [
  { count: 2400, size: 1.0, opacity: 0.72, bMin: 0.30, bMax: 0.62 }, // polvo de fondo
  { count: 950,  size: 1.7, opacity: 0.95, bMin: 0.58, bMax: 0.88 }, // pequeñas
  { count: 380,  size: 2.7, opacity: 1.0,  bMin: 0.82, bMax: 1.0 },  // medianas
  { count: 110,  size: 4.4, opacity: 1.0,  bMin: 1.0,  bMax: 1.0 },  // grandes y brillantes
];

export interface Starfield {
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** Punto redondo suave (gradiente radial) para que las estrellas no sean cuadraditos. */
function createStarTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

export const createStarfield = (scene: THREE.Scene): Starfield => {
  // Semilla determinista (Math.random no está disponible en algunos entornos del
  // harness; además así el campo es estable entre recreaciones).
  const rand = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const texture = createStarTexture();
  const built: Array<{ points: THREE.Points; geometry: THREE.BufferGeometry; material: THREE.PointsMaterial }> = [];

  STAR_LAYERS.forEach((layer, li) => {
    const seed0 = (li + 1) * 100003; // capas con distribuciones distintas (no solapan)
    const positions = new Float32Array(layer.count * 3);
    const colors = new Float32Array(layer.count * 3);
    for (let i = 0; i < layer.count; i++) {
      const s = seed0 + i;
      // Dirección uniforme sobre la esfera (evita acumulación en polos).
      const u = rand(s * 3 + 1);
      const v = rand(s * 3 + 2);
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = STAR_RADIUS * (STAR_SHELL + (1 - STAR_SHELL) * rand(s * 3 + 3));
      const sinPhi = Math.sin(phi);
      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const b = layer.bMin + (layer.bMax - layer.bMin) * rand(s * 7 + 5);
      colors[i * 3] = b;
      colors[i * 3 + 1] = b;
      colors[i * 3 + 2] = b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: layer.size,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: layer.opacity,
      sizeAttenuation: false, // tamaño en px constante — no crecen con el dolly
      depthWrite: false,
      fog: false, // están a radio 6000; sin esto la niebla de la escena las borraría
      blending: THREE.AdditiveBlending, // se funden con el fondo oscuro, nunca tapan
    });

    const points = new THREE.Points(geometry, material);
    points.raycast = () => {}; // decorativo: nunca intercepta hover/click
    points.renderOrder = -2; // detrás de todo (nodos/links/glow)
    scene.add(points);
    built.push({ points, geometry, material });
  });

  return {
    setVisible(visible: boolean) {
      for (const l of built) l.points.visible = visible;
    },
    dispose() {
      for (const l of built) {
        scene.remove(l.points);
        l.geometry.dispose();
        l.material.dispose();
      }
      texture.dispose();
      built.length = 0;
    },
  };
};
