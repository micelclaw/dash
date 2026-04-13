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

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Pencil, Trash2, ArrowRightLeft, Copy, Archive,
  CalendarDays, Flag, CheckSquare, ArchiveRestore,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectsStore } from '@/stores/projects.store';
import type { Card } from '../types';

interface MenuState {
  card: Card;
  x: number;
  y: number;
}

const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low', 'none'] as const;
const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', none: '#6b7280',
};

export function useCardContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const [dateValues, setDateValues] = useState({ start: '', due: '' });

  const columns = useProjectsStore((s) => s.columns);
  const boardColumnIds = useProjectsStore((s) => s.boardColumnIds);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const createCard = useProjectsStore((s) => s.createCard);
  const deleteCard = useProjectsStore((s) => s.deleteCard);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const moveCard = useProjectsStore((s) => s.moveCard);

  const onCardContextMenu = useCallback((e: React.MouseEvent, card: Card) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ card, x: e.clientX, y: e.clientY });
    setSubMenu(null);
    setDateValues({
      start: card.start_date?.split('T')[0] ?? '',
      due: card.due_date?.split('T')[0] ?? '',
    });
  }, []);

  const close = useCallback(() => {
    setMenu(null);
    setSubMenu(null);
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!menu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menu, close]);

  // Adjust position to stay in viewport
  useEffect(() => {
    if (!menu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = menu.x;
    let y = menu.y;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y < 8) y = 8;
    if (x < 8) x = 8;
    if (x !== menu.x || y !== menu.y) setMenu({ ...menu, x, y });
  }, [menu?.card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get sorted columns for the "Move to" submenu
  const sortedColumns = activeBoardId
    ? (boardColumnIds[activeBoardId] ?? []).map(id => columns[id]).filter(Boolean)
    : [];

  // Find done column
  const doneColumn = sortedColumns.find(c => c?.is_done_column);

  const contextMenuPortal = menu ? createPortal(
    <>
      {/* Backdrop */}
      <div
        onMouseDown={(e) => { e.stopPropagation(); close(); }}
        onContextMenu={(e) => { e.preventDefault(); close(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
      />
      {/* Menu */}
      <div
        ref={menuRef}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: menu.x,
          top: menu.y,
          zIndex: 9999,
          minWidth: 200,
          background: 'rgba(17, 17, 24, 0.4)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '4px 0',
          animation: 'fadeIn 100ms ease',
        }}
      >
        {/* Rename */}
        <MenuItem icon={Pencil} label="Rename" shortcut="F2" onClick={() => { selectCard(menu.card.id); close(); }} />

        {/* Move to column */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setSubMenu('move')}
          onMouseLeave={() => setSubMenu(null)}
        >
          <MenuItem icon={ArrowRightLeft} label="Move to..." hasSubmenu onClick={() => {}} />
          {subMenu === 'move' && (
            <SubMenuPanel>
              {sortedColumns.map(col => {
                if (!col) return null;
                const isCurrent = col.id === menu.card.column_id;
                return (
                  <button
                    key={col.id}
                    disabled={isCurrent}
                    onClick={() => {
                      if (!isCurrent && activeBoardId) {
                        moveCard(activeBoardId, menu.card.id, col.id, 0);
                        close();
                      }
                    }}
                    style={{
                      ...subItemStyle,
                      color: isCurrent ? 'var(--text-muted)' : 'var(--text)',
                      opacity: isCurrent ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {col.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />}
                    <span style={{ flex: 1 }}>{col.title}</span>
                    {isCurrent && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>current</span>}
                  </button>
                );
              })}
            </SubMenuPanel>
          )}
        </div>

        {/* Set priority */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setSubMenu('priority')}
          onMouseLeave={() => setSubMenu(null)}
        >
          <MenuItem icon={Flag} label="Set priority" hasSubmenu onClick={() => {}} />
          {subMenu === 'priority' && (
            <SubMenuPanel>
              {PRIORITY_OPTIONS.map(p => {
                const isCurrent = (menu.card.priority ?? 'none') === p;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      if (activeBoardId) {
                        updateCard(activeBoardId, menu.card.id, { priority: p === 'none' ? null : p });
                        close();
                      }
                    }}
                    style={{
                      ...subItemStyle,
                      color: isCurrent ? 'var(--amber)' : 'var(--text)',
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: PRIORITY_COLORS[p],
                    }} />
                    <span style={{ flex: 1, textTransform: 'capitalize' }}>{p}</span>
                  </button>
                );
              })}
            </SubMenuPanel>
          )}
        </div>

        <Separator />

        {/* Set dates — inline date pickers */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setSubMenu('dates')}
          onMouseLeave={() => setSubMenu(null)}
        >
          <MenuItem icon={CalendarDays} label="Set dates" hasSubmenu onClick={() => {}} />
          {subMenu === 'dates' && (
            <SubMenuPanel>
              <div style={{ padding: '8px 12px' }} onClick={(e) => e.stopPropagation()}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Start Date</label>
                <input
                  type="date"
                  value={dateValues.start}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDateValues(prev => ({ ...prev, start: val }));
                    if (activeBoardId) {
                      updateCard(activeBoardId, menu.card.id, { start_date: val || null });
                    }
                  }}
                  style={dateInputStyle}
                />
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, marginTop: 8, fontWeight: 600 }}>Due Date</label>
                <input
                  type="date"
                  value={dateValues.due}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDateValues(prev => ({ ...prev, due: val }));
                    if (activeBoardId) {
                      updateCard(activeBoardId, menu.card.id, { due_date: val || null });
                    }
                  }}
                  style={dateInputStyle}
                />
              </div>
            </SubMenuPanel>
          )}
        </div>

        {/* Duplicate */}
        <MenuItem icon={Copy} label="Duplicate" onClick={async () => {
          if (!activeBoardId) return;
          const c = menu.card;
          await createCard(activeBoardId, {
            column_id: c.column_id,
            title: `${c.title} (copy)`,
            description: c.description,
            priority: c.priority,
            color: c.color,
            due_date: c.due_date?.split('T')[0] ?? null,
            start_date: c.start_date?.split('T')[0] ?? null,
            estimated_hours: c.estimated_hours,
            tags: c.tags,
            checklist: c.checklist,
          });
          toast.success('Card duplicated');
          close();
        }} />

        {/* Mark complete = move to Done column */}
        {doneColumn && menu.card.column_id !== doneColumn.id && (
          <MenuItem icon={CheckSquare} label="Mark complete" onClick={() => {
            if (activeBoardId && doneColumn) {
              moveCard(activeBoardId, menu.card.id, doneColumn.id, 0);
              updateCard(activeBoardId, menu.card.id, { completed_at: new Date().toISOString() });
              toast.success('Moved to Done');
              close();
            }
          }} />
        )}

        {/* If already in Done column, allow marking incomplete = move back */}
        {doneColumn && menu.card.column_id === doneColumn.id && sortedColumns.length > 1 && (
          <MenuItem icon={CheckSquare} label="Mark incomplete" onClick={() => {
            if (activeBoardId) {
              // Move to the first non-done column (typically Backlog or This Week)
              const target = sortedColumns.find(c => c && !c.is_done_column);
              if (target) {
                moveCard(activeBoardId, menu.card.id, target.id, 0);
                updateCard(activeBoardId, menu.card.id, { completed_at: null });
                toast.success(`Moved to ${target.title}`);
              }
              close();
            }
          }} />
        )}

        {/* Archive */}
        <MenuItem
          icon={menu.card.archived ? ArchiveRestore : Archive}
          label={menu.card.archived ? 'Unarchive' : 'Archive'}
          onClick={() => {
            if (activeBoardId) {
              updateCard(activeBoardId, menu.card.id, { archived: !menu.card.archived });
              toast.success(menu.card.archived ? 'Card restored' : 'Card archived');
              close();
            }
          }}
        />

        <Separator />

        {/* Delete */}
        <MenuItem icon={Trash2} label="Delete" variant="danger" onClick={() => {
          if (activeBoardId) {
            deleteCard(activeBoardId, menu.card.id);
            toast.success('Card deleted');
            close();
          }
        }} />
      </div>
    </>,
    document.body,
  ) : null;

  return { onCardContextMenu, contextMenuPortal };
}

// ─── Sub-components ─────────────────────────────────

function MenuItem({ icon: Icon, label, shortcut, variant, hasSubmenu, onClick }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  shortcut?: string;
  variant?: 'danger';
  hasSubmenu?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={hasSubmenu ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        height: 30,
        padding: '0 12px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: variant === 'danger' ? 'var(--error)' : 'var(--text)',
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={14} />
      <span style={{ flex: 1 }}>{label}</span>
      {hasSubmenu && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▶</span>}
      {shortcut && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shortcut}</span>}
    </button>
  );
}

function SubMenuPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute',
      left: '100%',
      top: 0,
      minWidth: 160,
      background: 'rgba(17, 17, 24, 0.95)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      padding: '4px 0',
      zIndex: 1,
    }}>
      {children}
    </div>
  );
}

function Separator() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
}

const subItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  height: 30,
  padding: '0 12px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  textAlign: 'left',
};

const dateInputStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 8px',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  colorScheme: 'dark',
  width: '100%',
};
