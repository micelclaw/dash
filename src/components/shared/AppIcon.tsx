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

// ─── AppIcon — render ÚNICO del icono de una app/skill (SSOT display, Fase E) ──
// El backend expone un DISPLAY unificado por app/skill: `{ icon, icon_kind, color? }`.
//   • icon_kind === 'lucide' → `icon` es el NOMBRE de un icono Lucide (p.ej. "Waypoints"),
//     que se resuelve con el helper canónico `lucideLookup` (fallback `Puzzle`).
//   • en cualquier otro caso (emoji o ausente) → `icon` se pinta CRUDO como texto.
// Ningún otro componente debe re-resolver iconos de app a mano: pasa por aquí.

import { createElement } from 'react';
import { lucideLookup } from '@/config/lucide-lookup';
import type { AppManifest } from '@/types/apps';

export interface AppIconProps {
  icon: string;
  icon_kind?: 'emoji' | 'lucide';
  color?: string;
  size?: number;
  className?: string;
}

export function AppIcon({ icon, icon_kind, color, size = 20, className }: AppIconProps) {
  if (icon_kind === 'lucide') {
    // createElement (no JSX con variable Capitalizada) evita el warning
    // "Cannot create components during render" del linter de React.
    return createElement(lucideLookup(icon), {
      size,
      className,
      style: color ? { color } : undefined,
    });
  }
  // Emoji (o icon_kind ausente): texto crudo con fontSize acorde a `size`.
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block', ...(color ? { color } : {}) }}
      aria-hidden
    >
      {icon}
    </span>
  );
}

/**
 * Resuelve el icono a pintar desde el `manifest` de una app. Prioridad:
 *   1. `icon_kind` explícito (apps sintéticas ya resueltas contra el display unificado).
 *   2. `icon` del manifest → tratado como EMOJI.
 *   3. `ui.module.icon` → tratado como NOMBRE Lucide (así lo declaran los .claw).
 *   4. fallback 📦.
 */
export function resolveManifestIcon(
  manifest?: Partial<AppManifest> | null,
): { icon: string; icon_kind: 'emoji' | 'lucide'; color?: string } {
  if (manifest?.icon_kind) {
    return { icon: manifest.icon ?? '📦', icon_kind: manifest.icon_kind, color: manifest.color };
  }
  if (manifest?.icon) {
    return { icon: manifest.icon, icon_kind: 'emoji', color: manifest.color };
  }
  const lucide = manifest?.ui?.module?.icon;
  if (lucide) {
    return { icon: lucide, icon_kind: 'lucide', color: manifest.color };
  }
  return { icon: '📦', icon_kind: 'emoji' };
}
