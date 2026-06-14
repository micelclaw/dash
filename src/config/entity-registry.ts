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

// FUENTE ÚNICA (SSOT) para resolver un registro → { Icon, color, label, route }.
// Une las dos fuentes canónicas existentes:
//   - ENTITY_REF_MAP (entity-refs.ts): metadata por dominio (note/event/.../kanban/
//     music/video/book…). Ya consumido por chips del chat y menciones de notas.
//   - getFileIconEntry (FileIcon.tsx): metadata visual de archivos por mime. Ya
//     consumido por Drive y File Explorer.
// Para el dominio `file`/`photo` se sub-tipa por mime (un xlsx abre en ONLYOFFICE,
// un pdf en el visor, una imagen en el lightbox, etc.). Todos los consumidores
// (search, command palette, paneles related/similar/relate, graph) llaman aquí en
// vez de mantener su propio mapa → añadir un tipo = UNA edición (en ENTITY_REF_MAP
// para dominios, en FileIcon.MIME_ICONS para mimes).

import type { LucideIcon } from 'lucide-react';
import { File as FileIconLucide } from 'lucide-react';
import { ENTITY_REF_MAP } from './entity-refs';
import { getFileIconEntry } from '@/components/shared/FileIcon';
import { getMimeLabel } from '@/lib/file-utils';

export interface ResolvedEntity {
  Icon: LucideIcon;
  color: string;
  label: string;
  /** URL de navegación ya construida (o null si el tipo no es navegable). */
  route: string | null;
}

/** Alias de dominio (plural/variantes) → dominio canónico de ENTITY_REF_MAP. */
const DOMAIN_ALIASES: Record<string, string> = {
  notes: 'note',
  events: 'event',
  contacts: 'contact',
  emails: 'email',
  diary_entries: 'diary',
  diaries: 'diary',
  files: 'file',
  photos: 'photo',
  kanban_boards: 'kanban_board',
  kanban_cards: 'kanban_card',
  inventory_item: 'inventory',
  inventory_items: 'inventory',
  bookmarks: 'bookmark',
  feeds: 'feed',
  articles: 'article',
  albums: 'album',
  conversations: 'conversation',
  messages: 'message',
  tracks: 'music',
  albums_music: 'music',
  videos: 'video',
  movies: 'video',
  series: 'video',
  books: 'book',
  ebooks: 'book',
};

/** Normaliza un dominio del backend/UI a la clave canónica de ENTITY_REF_MAP. */
export function normalizeDomain(domain: string): string {
  return DOMAIN_ALIASES[domain] ?? domain;
}

type Rec = Record<string, unknown> | null | undefined;

function str(rec: Rec, key: string): string | undefined {
  const v = rec?.[key];
  return typeof v === 'string' && v ? v : undefined;
}

/** Ruta de apertura de un ARCHIVO según su mime (y si es del índice o del VFS). */
function fileRoute(id: string, rec: Rec): string {
  const filepath = str(rec, 'filepath');
  // Archivos del VFS (File Explorer, por path) → abrir su propia ruta.
  if (str(rec, 'source') === 'vfs' && filepath) {
    return `/explorer?path=${encodeURIComponent(filepath)}`;
  }
  const mime = str(rec, 'mime_type') ?? '';
  if (mime === 'application/pdf') return `/office/pdf/${encodeURIComponent(id)}`;
  // Word/Excel/PowerPoint (y ODF/CSV) → editor ONLYOFFICE (detecta el tipo).
  if (
    mime.includes('wordprocessing') || mime.includes('spreadsheet') ||
    mime.includes('presentation') || mime.includes('msword') ||
    mime.includes('ms-excel') || mime.includes('ms-powerpoint') ||
    mime.includes('opendocument') || mime === 'application/rtf' || mime === 'text/csv'
  ) {
    return `/office/edit/${encodeURIComponent(id)}`;
  }
  if (mime.startsWith('image/')) return `/photos?id=${encodeURIComponent(id)}`;
  // Audio/vídeo/epub/texto/zip/otros → inspector de Drive (previsualiza/repro/descarga).
  return `/drive?id=${encodeURIComponent(id)}`;
}

/** Ruta fina de la biblioteca multimedia según `media_type` del record. */
function mediaRoute(domain: string, id: string, rec: Rec): string {
  const t = (str(rec, 'media_type') ?? '').toLowerCase();
  const eid = encodeURIComponent(id);
  if (domain === 'music') {
    if (t === 'track' || t === 'song') return `/music?track=${eid}`;
    if (t === 'artist') return `/music?artist=${eid}`;
    return `/music?album=${eid}`;
  }
  if (domain === 'video') return `/video?item=${eid}`;
  return `/books?book=${eid}`; // domain === 'book'
}

/** Enriquecimiento de fecha para event/diary (conserva el comportamiento previo). */
function dateOf(rec: Rec, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = str(rec, k);
    if (v) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }
  return null;
}

/**
 * Resuelve un registro a su metadata visual + ruta de navegación.
 * @param domain dominio del backend (acepta alias/plurales).
 * @param id record_id del registro (para kanban_card debe venir "<boardId>/<cardId>";
 *   los consumidores que tengan board_id en el record lo componen antes — ver search).
 * @param record fila completa del registro (para sub-tipar archivos/media y fechas).
 */
export function resolveEntity(domain: string, id?: string, record?: Rec): ResolvedEntity {
  const d = normalizeDomain(domain);
  const rid = id ?? '';

  // Archivos: visual por mime (getFileIconEntry) + ruta por mime.
  if (d === 'file' || d === 'photo') {
    const mime = str(record, 'mime_type') ?? (d === 'photo' ? 'image/' : '');
    // Sin mime (p.ej. un nodo del grafo o un panel que no aporta el record): usar la
    // identidad de Drive (FolderOpen + --mod-drive) en vez del File/gris genérico.
    if (!mime) {
      const def = ENTITY_REF_MAP['file']!;
      return { Icon: def.Icon, color: def.color, label: def.label, route: rid ? fileRoute(rid, record) : null };
    }
    const [Icon, color] = getFileIconEntry(mime, false);
    return {
      Icon,
      color,
      label: getMimeLabel(mime),
      route: rid ? fileRoute(rid, record) : null,
    };
  }

  const def = ENTITY_REF_MAP[d];
  if (!def) {
    // Dominio desconocido → no romper: icono/gris neutros, sin navegación.
    return { Icon: FileIconLucide, color: 'var(--text-dim)', label: domain, route: null };
  }

  // kanban_card: abrir el CardDetailPanel necesita el boardId. Si el id no viene
  // ya compuesto ("<boardId>/<cardId>") pero el record trae board_id, componerlo.
  let effectiveId = rid;
  if (d === 'kanban_card' && rid && !rid.includes('/')) {
    const boardId = str(record, 'board_id');
    if (boardId) effectiveId = `${boardId}/${rid}`;
  }

  // Ruta: casos enriquecidos (media por media_type, event/diary por fecha), si no la del map.
  let route: string | null = effectiveId ? def.route(effectiveId) : null;
  if (rid) {
    if (d === 'music' || d === 'video' || d === 'book') {
      route = mediaRoute(d, rid, record);
    } else if (d === 'event') {
      const iso = dateOf(record, 'start_at', 'start_date', 'starts_at', 'created_at');
      route = iso ? `/calendar?id=${encodeURIComponent(rid)}&date=${iso}&view=day` : `/calendar?id=${encodeURIComponent(rid)}`;
    } else if (d === 'diary') {
      const iso = dateOf(record, 'entry_date', 'date', 'created_at');
      if (iso) route = `/diary?date=${iso}`;
    }
  }

  return { Icon: def.Icon, color: def.color, label: def.label, route };
}
