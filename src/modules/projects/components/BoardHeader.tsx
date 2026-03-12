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

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, LayoutGrid, List, CalendarRange,
  Settings, Calendar, BarChart3, Share2, Search, X, SlidersHorizontal,
} from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import type { ViewMode } from '../types';

const VIEW_OPTIONS: { id: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { id: 'board', icon: LayoutGrid, label: 'Board' },
  { id: 'list', icon: List, label: 'Table' },
  { id: 'timeline', icon: CalendarRange, label: 'Gantt' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
];

export function BoardHeader({ onOpenSettings, onOpenShare, onOpenFields }: {
  onOpenSettings?: () => void;
  onOpenShare?: () => void;
  onOpenFields?: () => void;
}) {
  const title = useProjectsStore((s) => s.activeBoardTitle);
  const activeView = useProjectsStore((s) => s.activeView);
  const setView = useProjectsStore((s) => s.setView);
  const updateBoard = useProjectsStore((s) => s.updateBoard);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const activeBoardPermission = useProjectsStore((s) => s.activeBoardPermission);
  const filters = useProjectsStore((s) => s.filters);
  const setFilters = useProjectsStore((s) => s.setFilters);
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title || '');
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSave = useCallback(() => {
    if (editTitle.trim() && editTitle !== title) {
      updateBoard(activeBoardId!, { title: editTitle.trim() });
    }
    setEditing(false);
  }, [editTitle, title, activeBoardId, updateBoard]);

  const canEdit = activeBoardPermission !== 'view';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => navigate('/projects')}
        style={iconBtnStyle}
        title="Back to boards"
      >
        <ArrowLeft size={16} />
      </button>

      {/* Board title */}
      {editing && canEdit ? (
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 8px',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
      ) : (
        <h2
          onDoubleClick={() => { if (canEdit) { setEditTitle(title || ''); setEditing(true); } }}
          style={{
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            margin: 0,
            cursor: canEdit ? 'default' : 'not-allowed',
          }}
        >
          {title || 'Board'}
        </h2>
      )}

      {activeBoardPermission === 'view' && (
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          background: 'var(--card)',
          padding: '1px 6px',
          borderRadius: 3,
          border: '1px solid var(--border)',
        }}>
          View only
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Board search */}
      {searchOpen ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 8px',
        }}>
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            autoFocus
            type="text"
            placeholder="Search cards..."
            value={filters.search ?? ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
            onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setFilters({ ...filters, search: undefined }); } }}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              width: 160,
            }}
          />
          <button
            onClick={() => { setSearchOpen(false); setFilters({ ...filters, search: undefined }); }}
            style={{ ...iconBtnStyle, padding: 2 }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button onClick={() => setSearchOpen(true)} style={iconBtnStyle} title="Search (/)">
          <Search size={14} />
        </button>
      )}

      {/* View switcher */}
      <div
        style={{
          display: 'flex',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {VIEW_OPTIONS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            title={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: activeView === id ? 'var(--surface-hover)' : 'transparent',
              border: 'none',
              borderBottom: activeView === id ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeView === id ? 'var(--text)' : 'var(--text-dim)',
              fontSize: 11,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Fields */}
      {onOpenFields && canEdit && (
        <button onClick={onOpenFields} style={iconBtnStyle} title="Custom Fields">
          <SlidersHorizontal size={14} />
        </button>
      )}

      {/* Share */}
      {onOpenShare && (
        <button onClick={onOpenShare} style={iconBtnStyle} title="Share">
          <Share2 size={14} />
        </button>
      )}

      {/* Settings */}
      {onOpenSettings && canEdit && (
        <button onClick={onOpenSettings} style={iconBtnStyle} title="Settings">
          <Settings size={14} />
        </button>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 4,
  display: 'flex',
  borderRadius: 4,
};
