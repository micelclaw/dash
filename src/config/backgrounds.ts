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

export const BACKGROUND_TEXTURES = [
  { id: 'starfield', label: 'Starfield', file: 'starfield.svg' },
  { id: 'starfield-ember', label: 'Ember stars', file: 'starfield-ember.svg' },
  { id: 'starfield-violet', label: 'Violet stars', file: 'starfield-violet.svg' },
  { id: 'nebula', label: 'Nebula', file: 'nebula.svg' },
  { id: 'aurora', label: 'Aurora', file: 'aurora.svg' },
  { id: 'waves', label: 'Waves', file: 'waves.svg' },
  { id: 'mesh', label: 'Mesh', file: 'mesh.svg' },
  { id: 'grid-fade', label: 'Grid', file: 'grid-fade.svg' },
  { id: 'topo', label: 'Topo', file: 'topo.svg' },
  { id: 'topo-emerald', label: 'Topo green', file: 'topo-emerald.svg' },
  { id: 'topo-amber', label: 'Topo amber', file: 'topo-amber.svg' },
] as const;
