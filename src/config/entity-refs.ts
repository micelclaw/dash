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

import { StickyNote, Calendar, Users, type LucideIcon } from 'lucide-react';

// Single source of truth de los tipos de entidad referenciables desde el chat
// (chips cliqueables que navegan al registro). El backend marca cada tool_call
// con `entity_refs: [{ type, id, title }]` y aquí mapeamos `type` → icono/color/
// ruta. Piloto: solo notas. Al ampliar a otros dominios, añadir una fila
// reusando el icono/color de config/modules.ts y el patrón de ruta `?id=`.

export interface EntityRefDef {
  Icon: LucideIcon;
  /** Color del icono/borde — variable CSS del módulo (ej. var(--mod-notes)). */
  color: string;
  label: string;
  /** Deep-link al registro concreto (NotesPage lo lee con useSearchParams). */
  route: (id: string) => string;
}

export const ENTITY_REF_MAP: Record<string, EntityRefDef> = {
  note: {
    Icon: StickyNote,
    color: 'var(--mod-notes)',
    label: 'Nota',
    route: (id) => `/notes?id=${encodeURIComponent(id)}`,
  },
  event: {
    Icon: Calendar,
    color: 'var(--mod-calendar)',
    label: 'Evento',
    route: (id) => `/calendar?id=${encodeURIComponent(id)}`,
  },
  contact: {
    Icon: Users,
    color: 'var(--mod-contacts)',
    label: 'Contacto',
    route: (id) => `/contacts?id=${encodeURIComponent(id)}`,
  },
};
