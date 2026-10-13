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
  CalendarDays, Flag, Palette, ArchiveRestore,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectsStore } from '@/stores/projects.store';
import { CARD_COLORS } from '../utils/design-tokens';
import type { Card } from '../types';

interface MenuState {
  card: Card;
  cardIds: string[];
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
  const archiveCard = useProjectsStore((s) => s.archiveCard);
  const unarchiveCard = useProjectsStore((s) => s.unarchiveCard);
  const multiSelectedIds = useProjectsStore((s) => s.multiSelectedIds);
  const clearMultiSelect = useProjectsStore((s) => s.clearMultiSelect);

  const onCardContextMenu = useCallback((e: React.MouseEvent, card: Card) => {
    e.preventDefault();
    e.stopPropagation();
    const cardIds = multiSelectedIds.has(card.id)
      ? Array.from(multiSelectedIds)
      : [card.id];
    setMenu({ card, cardIds, x: e.clientX, y: e.clientY });
    setSubMenu(null);
    setDateValues({
      start: card.start_date?.split('T')[0] ?? '',
      due: card.due_date?.split('T')[0] ?? '',
    });
  }, [multiSelectedIds]);

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

  const updateSelected = useCallback(async (updates: Record<string, unknown>, finish = true) => {
    if (!menu || !activeBoardId) return;
    await Promise.all(menu.cardIds.map((cardId) => updateCard(activeBoardId, cardId, updates)));
    if (finish) {
      clearMultiSelect();
      close();
    }
  }, [menu, activeBoardId, updateCard, clearMultiSelect, close]);

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
          background: 'var(--glass-40)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '4px 0',
          animation: 'fadeIn 100ms ease',
        }}
      >
        {/* Rename is intentionally single-card only; every command shown for a
            multi-selection must apply to the entire selection. */}
        {menu.cardIds.length === 1 && (
          <MenuItem icon={Pencil} label="Rename" shortcut="F2" onClick={() => { selectCard(menu.card.id); close(); }} />
        )}

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
                const cards = useProjectsStore.getState().cards;
                const isCurrent = menu.cardIds.every((cardId) => cards[cardId]?.column_id === col.id);
                return (
                  <button
                    key={col.id}
                    disabled={isCurrent}
                    onClick={async () => {
                      if (!isCurrent && activeBoardId) {
                        const targetCards = useProjectsStore.getState().columnCardIds[col.id] ?? [];
                        const lastPosition = targetCards.reduce((max, cardId) =>
                          Math.max(max, useProjectsStore.getState().cards[cardId]?.position ?? 0), 0);
                        await Promise.all(menu.cardIds.map((cardId, index) =>
                          moveCard(activeBoardId, cardId, col.id, lastPosition + ((index + 1) * 1000)),
                        ));
                        clearMultiSelect();
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
                    onClick={() => updateSelected({ priority: p === 'none' ? null : p })}
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

        {/* Card accent color */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setSubMenu('color')}
          onMouseLeave={() => setSubMenu(null)}
        >
          <MenuItem icon={Palette} label="Set color" hasSubmenu onClick={() => {}} />
          {subMenu === 'color' && (
            <SubMenuPanel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 24px)', gap: 7, padding: 9 }}>
                <button
                  aria-label="No color"
                  title="No color"
                  onClick={() => updateSelected({ color: null })}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: 'transparent', border: '1px dashed var(--text-muted)', cursor: 'pointer' }}
                />
                {CARD_COLORS.map((color) => (
                  <button
                    key={color}
                    aria-label={`Color ${color}`}
                    title={color}
                    onClick={() => updateSelected({ color })}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: color, cursor: 'pointer',
                      border: menu.card.color === color ? '2px solid var(--text)' : '1px solid var(--border)',
                    }}
                  />
                ))}
                <label title="Custom color" style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input
                    aria-label="Custom card color"
                    type="color"
                    value={menu.card.color ?? '#3b82f6'}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    style={{ width: 32, height: 32, margin: -5, cursor: 'pointer' }}
                  />
                </label>
              </div>
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
                      void updateSelected({ start_date: val || null }, false);
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
                      void updateSelected({ due_date: val || null }, false);
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
          const cards = useProjectsStore.getState().cards;
          await Promise.all(menu.cardIds.map(async (cardId) => {
            const c = cards[cardId];
            if (!c) return;
            await createCard(activeBoardId, {
              column_id: c.column_id,
              title: `${c.title} (copy)`,
              description: c.description,
              priority: c.priority ?? undefined,
              color: c.color,
              due_date: c.due_date?.split('T')[0] ?? null,
              start_date: c.start_date?.split('T')[0] ?? null,
              estimated_hours: c.estimated_hours,
              tags: c.tags,
              checklist: c.checklist,
            });
          }));
          clearMultiSelect();
          toast.success(menu.cardIds.length > 1 ? `${menu.cardIds.length} cards duplicated` : 'Card duplicated');
          close();
        }} />

        {/* Archive */}
        <MenuItem
          icon={menu.card.archived ? ArchiveRestore : Archive}
          label={menu.card.archived ? 'Unarchive' : 'Archive'}
          onClick={async () => {
            if (activeBoardId) {
              await Promise.all(menu.cardIds.map((cardId) => {
                const card = useProjectsStore.getState().cards[cardId];
                return card?.archived
                  ? unarchiveCard(activeBoardId, cardId)
                  : archiveCard(activeBoardId, cardId);
              }));
              clearMultiSelect();
              close();
            }
          }}
        />

        <Separator />

        {/* Delete */}
        <MenuItem icon={Trash2} label="Delete" variant="danger" onClick={async () => {
          if (activeBoardId) {
            await Promise.all(menu.cardIds.map((cardId) => deleteCard(activeBoardId, cardId)));
            clearMultiSelect();
            toast.success(menu.cardIds.length > 1 ? `${menu.cardIds.length} cards deleted` : 'Card deleted');
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
      background: 'var(--glass-95)',
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
