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

import { useState, useCallback, useEffect, useRef } from 'react';
import { MoreHorizontal, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { SEMANTICAS, etiquetaSemantica, colorSemantica } from '../utils/status-semantic';
import { useProjectsStore } from '@/stores/projects.store';
import type { Column } from '../types';

const COLUMN_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'] as const;
const COLUMN_MENU_OPEN_EVENT = 'micelclaw:column-menu-open';

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
  const menuRootRef = useRef<HTMLDivElement>(null);

  // Cada cabecera es una instancia distinta: si su estado queda aislado, tres
  // columnas pueden mantener tres menús abiertos a la vez. El evento coordina
  // las instancias y el listener de documento cubre cualquier clic exterior,
  // incluso cuando dnd-kit crea contextos de apilado distintos por columna.
  useEffect(() => {
    const closeWhenAnotherOpens = (event: Event) => {
      const openedColumnId = (event as CustomEvent<{ columnId: string }>).detail?.columnId;
      if (openedColumnId !== column.id) setMenuOpen(false);
    };
    window.addEventListener(COLUMN_MENU_OPEN_EVENT, closeWhenAnotherOpens);
    return () => window.removeEventListener(COLUMN_MENU_OPEN_EVENT, closeWhenAnotherOpens);
  }, [column.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [menuOpen]);

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

        {/* Lo que entiende el mundo exterior. Si nadie lo ha declarado se AVISA:
            descubrirlo cuando algo no aparece en el móvil es mucho peor. */}
        {column.status_semantic ? (
          <span
            title={`Fuera, esta columna equivale a «${etiquetaSemantica(column.status_semantic)}»`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: colorSemantica(column.status_semantic), flexShrink: 0 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: colorSemantica(column.status_semantic) }} />
            {etiquetaSemantica(column.status_semantic)?.toLowerCase()}
          </span>
        ) : (
          <span
            title="Esta columna no dice a qué estado equivale. Al sincronizar, sus tareas se verán como «por hacer»."
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-dim)', flexShrink: 0, opacity: 0.7 }}
          >
            ⚠ sin definir
          </span>
        )}
      </div>

      <div ref={menuRootRef} style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (!menuOpen) {
              window.dispatchEvent(new CustomEvent(COLUMN_MENU_OPEN_EVENT, {
                detail: { columnId: column.id },
              }));
            }
            setMenuOpen(!menuOpen);
          }}
          aria-label={`Column options: ${column.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
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

              {/* Qué significa esta columna para el mundo exterior. Las columnas
                  se llaman como uno quiera; fuera solo existen cuatro estados. */}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}>
                <div style={{ padding: '0 8px 4px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                  Significado
                </div>
                {SEMANTICAS.map((sem) => (
                  <button
                    key={sem.valor}
                    onClick={() => { updateColumn(activeBoardId!, column.id, { status_semantic: sem.valor }); setMenuOpen(false); }}
                    style={{ ...menuItemStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: column.status_semantic === sem.valor ? sem.color : 'transparent', border: `1px solid ${sem.color}` }} />
                    {sem.etiqueta}
                  </button>
                ))}
                <button
                  onClick={() => { updateColumn(activeBoardId!, column.id, { status_semantic: null }); setMenuOpen(false); }}
                  title="Esta columna no equivale a ningún estado del estándar. Al sincronizar, sus tareas se verán como «por hacer»."
                  style={{ ...menuItemStyle, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: column.status_semantic == null ? 'var(--text-dim)' : 'transparent', border: '1px dashed var(--text-dim)' }} />
                  Ninguno
                </button>
              </div>
              {/* Column color — editable any time, not just at creation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px', flexWrap: 'wrap' }}>
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    title={c}
                    onClick={() => updateColumn(activeBoardId!, column.id, { color: c })}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', background: c,
                      border: column.color === c ? '2px solid var(--text)' : '1px solid var(--border)',
                      cursor: 'pointer', padding: 0, flexShrink: 0,
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={column.color ?? '#94a3b8'}
                  onChange={(e) => updateColumn(activeBoardId!, column.id, { color: e.target.value })}
                  title="Custom color"
                  style={{ width: 18, height: 18, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'none', cursor: 'pointer', flexShrink: 0 }}
                />
                <button
                  title="No color"
                  onClick={() => updateColumn(activeBoardId!, column.id, { color: null })}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: 'transparent',
                    border: !column.color ? '2px solid var(--text)' : '1px dashed var(--border)',
                    cursor: 'pointer', padding: 0, flexShrink: 0,
                  }}
                />
              </div>
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
