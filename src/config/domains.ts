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
 * Single source of truth for the data domains the dash knows about.
 *
 * Both PermissionsSection (which records can each agent see) and
 * DigestSection (which domains feed into the daily digest) read from
 * here so adding a new domain only requires editing this file.
 *
 * `hasTagSupport` controls whether the domain's records have a tags
 * column the user can filter by.
 */

import type { LucideIcon } from 'lucide-react';
import {
  StickyNote, Users, BookOpen, Calendar, Mail, FolderOpen,
  Image, Columns, Bookmark, DollarSign,
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
  { id: 'photos',    label: 'Photos',    icon: Image,      hasTagSupport: false },
  { id: 'kanban',    label: 'Projects',  icon: Columns,    hasTagSupport: true  },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark,   hasTagSupport: false },
  { id: 'finance',   label: 'Finance',   icon: DollarSign, hasTagSupport: false },
];

export const ALL_DOMAIN_IDS = DATA_DOMAINS.map((d) => d.id);
