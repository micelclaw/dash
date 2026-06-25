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

// ─── Lookup icono (string) → componente Lucide ──────────────────────
// Los módulos dinámicos (apps L3) declaran su icono como STRING en el manifest
// (p.ej. "Waypoints"). El dash lo resuelve aquí a su componente Lucide. Fallback
// a `Puzzle` si el nombre no existe (icono genérico de "app").

import * as Lucide from 'lucide-react';
import { Puzzle, type LucideIcon } from 'lucide-react';

const REGISTRY = Lucide as unknown as Record<string, LucideIcon>;

export function lucideLookup(name: string | null | undefined): LucideIcon {
  if (!name) return Puzzle;
  const icon = REGISTRY[name];
  return typeof icon === 'function' || typeof icon === 'object' ? (icon ?? Puzzle) : Puzzle;
}
