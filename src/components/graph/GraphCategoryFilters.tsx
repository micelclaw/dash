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

import {
  User, Briefcase, MapPin, Hash, Building2, Calendar,
  StickyNote, Mail, FolderOpen, BookOpen,
} from 'lucide-react';
import { entityTypeColor } from './graph-utils';
import type { LucideIcon } from 'lucide-react';

interface GraphCategoryFiltersProps {
  enabled: Record<string, boolean>;
  onToggle: (type: string) => void;
  mode?: 'entities' | 'records';
}

const ENTITY_CATEGORIES: { type: string; label: string; icon: LucideIcon }[] = [
  { type: 'person', label: 'People', icon: User },
  { type: 'project', label: 'Projects', icon: Briefcase },
  { type: 'location', label: 'Locations', icon: MapPin },
  { type: 'topic', label: 'Topics', icon: Hash },
  { type: 'organization', label: 'Orgs', icon: Building2 },
  { type: 'event', label: 'Events', icon: Calendar },
];

const RECORD_CATEGORIES: { type: string; label: string; icon: LucideIcon }[] = [
  { type: 'contact', label: 'Contacts', icon: User },
  { type: 'note', label: 'Notes', icon: StickyNote },
  { type: 'email', label: 'Emails', icon: Mail },
  { type: 'event', label: 'Events', icon: Calendar },
  { type: 'file', label: 'Files', icon: FolderOpen },
  { type: 'diary', label: 'Diary', icon: BookOpen },
];

export function GraphCategoryFilters({ enabled, onToggle, mode = 'entities' }: GraphCategoryFiltersProps) {
  const categories = mode === 'records' ? RECORD_CATEGORIES : ENTITY_CATEGORIES;

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {categories.map(({ type, label, icon: Icon }) => {
        const isOn = enabled[type] !== false; // default true
        const color = entityTypeColor(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            title={`${isOn ? 'Hide' : 'Show'} ${label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${isOn ? color : 'var(--border)'}`,
              background: isOn ? `${color}15` : 'transparent',
              color: isOn ? color : 'var(--text-muted)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              opacity: isOn ? 1 : 0.5,
              transition: 'all var(--transition-fast)',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
