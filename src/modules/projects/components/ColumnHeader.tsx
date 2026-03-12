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
import { MoreHorizontal, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import type { Column } from '../types';

interface ColumnHeaderProps {
  column: Column;
  cardCount: number;
}

export function ColumnHeader({ column, cardCount }: ColumnHeaderProps) {
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const updateColumn = useProjectsStore((s) => s.updateColumn);
  const deleteColumn = useProjectsStore((s) => s.deleteColumn);
  const collapseColumn = useProjectsStore((s) => s.collapseColumn);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const wipExceeded = column.wip_limit != null && cardCount > column.wip_limit;

  const handleSaveTitle = useCallback(() => {
    if (title.trim() && title !== column.title) {
      updateColumn(activeBoardId!, column.id, { title: title.trim() });
    }
    setEditing(false);
  }, [title, column, activeBoardId, updateColumn]);

  return (
    <div
      style={{
        padding: '10px 12px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: column.color ? `3px solid ${column.color}` : undefined,
        borderRadius: column.color ? '8px 8px 0 0' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
        <button
          onClick={() => collapseColumn(activeBoardId!, column.id, !column.collapsed)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 0,
            display: 'flex',
            flexShrink: 0,
          }}
          title={column.collapsed ? 'Expand' : 'Collapse'}
        >
          {column.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setTitle(column.title); setEditing(false); } }}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '2px 6px',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              width: '100%',
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            style={{
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {column.title}
          </span>
        )}
        <span
          style={{
            fontSize: 11,
            color: wipExceeded ? 'var(--error)' : 'var(--text-dim)',
            fontWeight: wipExceeded ? 600 : 400,
            flexShrink: 0,
          }}
        >
          {cardCount}{column.wip_limit != null && `/${column.wip_limit}`}
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 2,
            display: 'flex',
            borderRadius: 4,
          }}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 10 }}
              onClick={() => setMenuOpen(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 11,
                background: 'var(--card)',
                backdropFilter: 'blur(25px)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 4,
                minWidth: 140,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <button
                onClick={() => { setEditing(true); setMenuOpen(false); }}
                style={menuItemStyle}
              >
                Rename
              </button>
              <button
                onClick={() => {
                  const lim = prompt('WIP limit (0 to remove):', String(column.wip_limit ?? ''));
                  if (lim !== null) {
                    const n = parseInt(lim, 10);
                    updateColumn(activeBoardId!, column.id, { wip_limit: n > 0 ? n : null });
                  }
                  setMenuOpen(false);
                }}
                style={menuItemStyle}
              >
                Set WIP limit
              </button>
              <button
                onClick={() => {
                  collapseColumn(activeBoardId!, column.id, !column.collapsed);
                  setMenuOpen(false);
                }}
                style={menuItemStyle}
              >
                {column.collapsed ? 'Expand column' : 'Collapse column'}
              </button>
              <button
                onClick={() => {
                  updateColumn(activeBoardId!, column.id, { is_done_column: !column.is_done_column });
                  setMenuOpen(false);
                }}
                style={menuItemStyle}
              >
                {column.is_done_column ? 'Unmark as Done' : 'Mark as Done column'}
              </button>
              <button
                onClick={() => {
                  deleteColumn(activeBoardId!, column.id);
                  setMenuOpen(false);
                }}
                style={{ ...menuItemStyle, color: 'var(--error)' }}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '6px 10px',
  background: 'none',
  border: 'none',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  borderRadius: 4,
  textAlign: 'left',
};
