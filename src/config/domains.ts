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

/**
 * Single source of truth for the domains the dash knows about.
 *
 * - DATA_DOMAINS: dominios de DATOS con registros (tags filtrables). Alimentan
 *   tanto PermissionsSection como DigestSection.
 * - CAPABILITY_DOMAINS: dominios de CAPACIDAD migrados a la fachada MCP en Fase 4.2
 *   (sensors, feeds, diagrams, office, flows, graph, insights, hal). Se gobiernan en
 *   Agent Permissions (concesión de scope por-agente) pero NO entran en el Digest.
 *   Añadidos al cerrar el gap de concesión (2026-06-01).
 *
 * `hasTagSupport` controla si el dominio tiene columna de tags para filtrar.
 */

import type { LucideIcon } from 'lucide-react';
import {
  StickyNote, Users, BookOpen, Calendar, Mail, FolderOpen,
  Image, Columns, Bookmark, DollarSign,
  Rss, GitBranch, FileText, Workflow, Cpu, Music, Clapperboard, Library,
} from 'lucide-react';

export interface DataDomain {
  id: string;
  label: string;
  icon: LucideIcon;
  hasTagSupport: boolean;
}

export const DATA_DOMAINS: DataDomain[] = [
  { id: 'notes',     label: 'Notes',     icon: StickyNote, hasTagSupport: true  },
  { id: 'contacts',  label: 'Contacts',  icon: Users,      hasTagSupport: true  },
  { id: 'diary',     label: 'Diary',     icon: BookOpen,   hasTagSupport: true  },
  { id: 'events',    label: 'Calendar',  icon: Calendar,   hasTagSupport: true  },
  { id: 'emails',    label: 'Email',     icon: Mail,       hasTagSupport: true  },
  { id: 'files',     label: 'Files',     icon: FolderOpen, hasTagSupport: true  },
  { id: 'photos',    label: 'Photos',    icon: Image,      hasTagSupport: true  },
  { id: 'kanban',    label: 'Projects',  icon: Columns,    hasTagSupport: true  },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark,   hasTagSupport: true  },
  { id: 'finance',   label: 'Finance',   icon: DollarSign, hasTagSupport: false },
];

/** Dominios de capacidad (Fase 4.2) — gobernables en Permissions, fuera del Digest. */
export const CAPABILITY_DOMAINS: DataDomain[] = [
  // sensors/graph/insights retirados 2026-06-05 (dominios eliminados del backend).
  { id: 'feeds',    label: 'Feeds',    icon: Rss,       hasTagSupport: false },
  { id: 'diagrams', label: 'Diagrams', icon: GitBranch, hasTagSupport: false },
  { id: 'office',   label: 'Office',   icon: FileText,  hasTagSupport: false },
  { id: 'flows',    label: 'Flows',    icon: Workflow,  hasTagSupport: false },
  { id: 'hal',      label: 'Hardware', icon: Cpu,       hasTagSupport: false },
  // Música (2026-06-12): biblioteca Navidrome vía tools music_* — sin tags ni Digest.
  { id: 'music',    label: 'Music',    icon: Music,     hasTagSupport: false },
  // Vídeo (2026-06-12): videoteca Jellyfin + peticiones Jellyseerr vía tools
  // video_* — sin tags ni Digest.
  { id: 'video',    label: 'Video',    icon: Clapperboard, hasTagSupport: false },
  // Books (2026-06-12): ebooks EPUB + audiolibros Audiobookshelf vía tools
  // books_* — sin tags ni Digest.
  { id: 'books',    label: 'Books',    icon: Library,   hasTagSupport: false },
];

// Digest solo sobre dominios de datos.
export const ALL_DOMAIN_IDS = DATA_DOMAINS.map((d) => d.id);

// Permissions gobierna datos + capacidad.
export const PERMISSION_DOMAINS: DataDomain[] = [...DATA_DOMAINS, ...CAPABILITY_DOMAINS];
export const ALL_PERMISSION_DOMAIN_IDS = PERMISSION_DOMAINS.map((d) => d.id);
