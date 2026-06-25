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

// Bundled texture backgrounds served from /public/backgrounds/.
// Shared by Settings → Dash (global background) and Board Settings → Display
// (per-board background). `starfield` recreates the micelclaw splashscreen
// mood (no logo/text).
//
// `theme` indica para qué familia está pensada la textura (oscura vs clara): el
// picker filtra por el tema activo (dark-type → dark, light/blush → light) para
// que el usuario solo vea las que casan con su fondo.

export const BACKGROUND_TEXTURES = [
  // Texturas para temas oscuros
  { id: 'starfield', label: 'Starfield', file: 'starfield.svg', theme: 'dark' },
  { id: 'starfield-ember', label: 'Ember stars', file: 'starfield-ember.svg', theme: 'dark' },
  { id: 'starfield-violet', label: 'Violet stars', file: 'starfield-violet.svg', theme: 'dark' },
  { id: 'nebula', label: 'Nebula', file: 'nebula.svg', theme: 'dark' },
  { id: 'aurora', label: 'Aurora', file: 'aurora.svg', theme: 'dark' },
  { id: 'waves', label: 'Waves', file: 'waves.svg', theme: 'dark' },
  { id: 'mesh', label: 'Mesh', file: 'mesh.svg', theme: 'dark' },
  { id: 'grid-fade', label: 'Grid', file: 'grid-fade.svg', theme: 'dark' },
  { id: 'topo', label: 'Topo', file: 'topo.svg', theme: 'dark' },
  { id: 'topo-emerald', label: 'Topo green', file: 'topo-emerald.svg', theme: 'dark' },
  { id: 'topo-amber', label: 'Topo amber', file: 'topo-amber.svg', theme: 'dark' },
  { id: 'dots', label: 'Dots', file: 'dots.svg', theme: 'dark' },
  // Texturas para temas claros (light, blush)
  { id: 'dots-light', label: 'Dots', file: 'dots-light.svg', theme: 'light' },
  { id: 'grid-light', label: 'Grid', file: 'grid-light.svg', theme: 'light' },
  { id: 'mesh-light', label: 'Pastel', file: 'mesh-light.svg', theme: 'light' },
  { id: 'waves-light', label: 'Waves', file: 'waves-light.svg', theme: 'light' },
  { id: 'topo-light', label: 'Topo', file: 'topo-light.svg', theme: 'light' },
  { id: 'haze-light', label: 'Haze', file: 'haze-light.svg', theme: 'light' },
  { id: 'stripes-light', label: 'Stripes', file: 'stripes-light.svg', theme: 'light' },
  { id: 'rings-light', label: 'Rings', file: 'rings-light.svg', theme: 'light' },
  { id: 'blueprint-light', label: 'Blueprint', file: 'blueprint-light.svg', theme: 'light' },
  { id: 'sunset-light', label: 'Sunset', file: 'sunset-light.svg', theme: 'light' },
  { id: 'mint-light', label: 'Mint', file: 'mint-light.svg', theme: 'light' },
  { id: 'plus-light', label: 'Crosses', file: 'plus-light.svg', theme: 'light' },
] as const;
