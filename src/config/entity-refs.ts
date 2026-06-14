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

import { StickyNote, Calendar, Users, Mail, BookOpen, Kanban, SquareCheckBig, Boxes, FolderOpen, Bookmark, Rss, Newspaper, Image, Images, type LucideIcon } from 'lucide-react';

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
  email: {
    Icon: Mail,
    color: 'var(--mod-mail)',
    label: 'Email',
    route: (id) => `/mail?id=${encodeURIComponent(id)}`,
  },
  diary: {
    Icon: BookOpen,
    color: 'var(--mod-diary)',
    label: 'Diario',
    route: (id) => `/diary?id=${encodeURIComponent(id)}`,
  },
  file: {
    Icon: FolderOpen,
    color: 'var(--mod-drive)',
    label: 'Archivo',
    // Refs del ÍNDICE (uuid) → módulo Drive por ?id=. Refs del VFS (path, empieza
    // por "/", de files_search/browse) → File Explorer por ?path= (es el navegador
    // por-path; el módulo Drive es por-id).
    route: (id) => id.startsWith('/')
      ? `/explorer?path=${encodeURIComponent(id)}`
      : `/drive?id=${encodeURIComponent(id)}`,
  },
  // Proyectos e inventario: las páginas aún no leen `?id=` (aterrizan en el
  // módulo); se usa la convención igualmente para que lo adopten sin tocar esto.
  kanban_board: {
    Icon: Kanban,
    color: 'var(--mod-projects)',
    label: 'Tablero',
    route: (id) => `/projects?id=${encodeURIComponent(id)}`,
  },
  kanban_card: {
    Icon: SquareCheckBig,
    color: 'var(--mod-projects)',
    label: 'Tarjeta',
    route: (id) => `/projects?card=${encodeURIComponent(id)}`,
  },
  inventory: {
    Icon: Boxes,
    color: 'var(--mod-inventory)',
    label: 'Inventario',
    route: (id) => `/inventory?id=${encodeURIComponent(id)}`,
  },
  bookmark: {
    Icon: Bookmark,
    color: 'var(--mod-bookmarks)',
    label: 'Bookmark',
    route: (id) => `/bookmarks?id=${encodeURIComponent(id)}`,
  },
  // feeds: dos tipos. La suscripción (feed) abre su lista; el artículo abre el
  // lector. FeedsPage lee `?feed=`/`?article=` en el effect de montaje.
  feed: {
    Icon: Rss,
    color: 'var(--mod-feeds)',
    label: 'Feed',
    route: (id) => `/feeds?feed=${encodeURIComponent(id)}`,
  },
  article: {
    Icon: Newspaper,
    color: 'var(--mod-feeds)',
    label: 'Artículo',
    route: (id) => `/feeds?article=${encodeURIComponent(id)}`,
  },
  // photos: dos tipos. El álbum abre su detalle (?album=); la foto abre el lightbox
  // (?id=, deep-link que PhotosPage ya soporta).
  album: {
    Icon: Images,
    color: 'var(--mod-photos)',
    label: 'Álbum',
    route: (id) => `/photos?album=${encodeURIComponent(id)}`,
  },
  photo: {
    Icon: Image,
    color: 'var(--mod-photos)',
    label: 'Foto',
    route: (id) => `/photos?id=${encodeURIComponent(id)}`,
  },
};

/** Dominios buscables para el dropdown de menciones `@` del editor de notas. */
export const MENTION_DOMAINS = ['note', 'event', 'contact', 'email', 'diary', 'inventory', 'kanban_board', 'kanban_card'] as const;
