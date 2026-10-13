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

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  RotateCw,
  BookOpen,
  Mail,
  Archive,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  StarOff,
  Inbox,
  Clock,
  FolderInput,
  ShieldAlert,
  Link2,
  MoreVertical,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MAIL_SORT_OPTIONS, type MailSortField, type MailSortOrder } from './types';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { buildMailActions, repartirAcciones, type MailAction, type MailActionKey } from './lib/mail-actions';
import type { MoveTarget } from './lib/move-targets';

/** Shared chrome for the square icon buttons on the right of the toolbar. */
const iconButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background var(--transition-fast)',
};

interface MailListToolbarProps {
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  selectedCount: number;
  /** La ÚNICA vía de acción, la misma que usa la fila y el menú del botón derecho. */
  onAction?: (
    key: MailActionKey,
    ids: string[],
    params?: { folder?: string; label?: string; el?: HTMLElement },
  ) => void;
  /** Los ids seleccionados, sobre los que cae la acción. */
  selectedIdList?: string[];
  /** ¿Están todos destacados? Decide «destacar» vs «quitar destacado». */
  allSelectedStarred?: boolean;
  /** La carpeta activa: cambia qué acciones tienen sentido. */
  activeFolder?: string;
  /** A dónde se puede mover lo seleccionado. */
  moveTargets?: MoveTarget[];
  // Sorting
  sortField: MailSortField;
  sortOrder: MailSortOrder;
  onSortChange: (field: MailSortField, order: MailSortOrder) => void;
  // Starred filter (replaces the old Starred folder — combinable with any folder)
  starredOnly: boolean;
  onToggleStarredOnly: () => void;
  // Pagination
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function MailListToolbar({
  allSelected,
  someSelected,
  onSelectAll,
  onDeselectAll,
  search,
  onSearchChange,
  onRefresh,
  selectedCount,
  onAction,
  selectedIdList,
  allSelectedStarred,
  activeFolder,
  moveTargets,
  sortField,
  sortOrder,
  onSortChange,
  starredOnly,
  onToggleStarredOnly,
  page,
  pageSize,
  total,
  onPageChange,
}: MailListToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [refreshHovered, setRefreshHovered] = useState(false);
  const [sortHovered, setSortHovered] = useState(false);
  const [starHovered, setStarHovered] = useState(false);
  const [hoveredBatch, setHoveredBatch] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search changes into local state
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced search
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, search, onSearchChange]);

  const handleCheckboxClick = useCallback(() => {
    if (allSelected || someSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [allSelected, someSelected, onDeselectAll, onSelectAll]);

  const selectionMode = selectedCount > 0;

  // Las acciones NO se escriben aquí: salen de `lib/mail-actions.ts`, el mismo
  // sitio del que sale el menú del botón derecho. Antes esta barra tenía su
  // propia lista de cuatro y por eso le faltaban destacar y mover a.
  //
  // Cinco como botón y el resto en el ⋮ (maqueta aprobada por el usuario): las de
  // uso diario a un clic sin llenar la barra en una ventana estrecha.
  const ICONOS_BARRA = {
    'mail-open': BookOpen, mail: Mail, star: Star, 'star-off': StarOff,
    archive: Archive, inbox: Inbox, clock: Clock, folder: FolderInput,
    'shield-alert': ShieldAlert, link: Link2, trash: Trash2,
  } as const;

  const accionesDeSeleccion = buildMailActions({
    count: selectedCount,
    allRead: false,
    allStarred: allSelectedStarred ?? false,
    folder: activeFolder ?? 'INBOX',
    moveTargets,
    canRelate: false,
  });
  const { directas, enMenu } = repartirAcciones(accionesDeSeleccion);

  const despachar = (a: MailAction, el?: HTMLElement) => onAction?.(a.key, selectedIdList ?? [], { el });

  const batchActions = directas.map((a) => ({
    key: a.key,
    label: a.label,
    icon: ICONOS_BARRA[a.icon],
    accion: a,
    submenu: a.submenu,
  }));

  const itemsDelMenu: ContextMenuItem[] = [];
  for (const a of enMenu) {
    const Icono = ICONOS_BARRA[a.icon];
    if (a.submenu) {
      const subItems: ContextMenuItem[] = [];
      for (const t of a.submenu) {
        if (t.groupHeader) subItems.push({ label: t.groupHeader, separator: true, onClick: () => {} });
        subItems.push({
          label: t.label, icon: Icono,
          onClick: () => onAction?.('move', selectedIdList ?? [],
            t.kind === 'label' ? { label: t.folder } : { folder: t.folder }),
        });
      }
      itemsDelMenu.push({ label: a.label, icon: Icono, onClick: () => {}, subItems });
      continue;
    }
    if (a.danger) itemsDelMenu.push({ label: '', separator: true, onClick: () => {} });
    itemsDelMenu.push({
      label: a.label, icon: Icono, onClick: () => despachar(a),
      ...(a.danger ? { variant: 'danger' as const } : {}),
    });
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  /** El mismo estilo para los cinco botones y para el ⋮. */
  const batchBtnStyle = (activo: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    background: activo ? 'var(--surface-hover)' : 'transparent',
    color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
    cursor: 'pointer', transition: 'background var(--transition-fast)',
    whiteSpace: 'nowrap',
  });

  const pagerBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, border: 'none', borderRadius: 'var(--radius-sm)',
    background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer',
    padding: 0, flexShrink: 0,
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected;
          }}
          onChange={handleCheckboxClick}
          style={{
            width: 14,
            height: 14,
            accentColor: 'var(--amber)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />

        {selectionMode ? (
          /* Selection mode */
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {selectedCount} selected
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              {batchActions.map(({ key, label, icon: Icon, accion, submenu }) => (
                submenu ? (
                  // «Mover a…» necesita elegir destino: el propio botón abre su
                  // submenú, con las carpetas de la cuenta (no las de todas).
                  <ContextMenu
                    key={key}
                    openOnLeftClick
                    items={submenu.flatMap((t) => [
                      ...(t.groupHeader ? [{ label: t.groupHeader, separator: true, onClick: () => {} }] : []),
                      {
                        label: t.label,
                        icon: Icon,
                        onClick: () => onAction?.('move', selectedIdList ?? [],
                          t.kind === 'label' ? { label: t.folder } : { folder: t.folder }),
                      },
                    ])}
                    trigger={
                      <button title={label} style={batchBtnStyle(key === hoveredBatch)}>
                        <Icon size={14} />
                        <span>{label}</span>
                      </button>
                    }
                  />
                ) : (
                <button
                  key={key}
                  onClick={(e) => despachar(accion, e.currentTarget)}
                  onMouseEnter={() => setHoveredBatch(key)}
                  onMouseLeave={() => setHoveredBatch(null)}
                  title={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: hoveredBatch === key ? 'var(--surface-hover)' : 'transparent',
                    color: 'var(--text-dim)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
                )
              ))}
              {/* Y el resto de acciones, en EL MISMO menú que el botón derecho. */}
              {itemsDelMenu.length > 0 && (
                <ContextMenu
                  openOnLeftClick
                  items={itemsDelMenu}
                  trigger={
                    <button
                      data-testid="mail-toolbar-more"
                      title="More actions"
                      style={batchBtnStyle(hoveredBatch === 'more')}
                      onMouseEnter={() => setHoveredBatch('more')}
                      onMouseLeave={() => setHoveredBatch(null)}
                    >
                      <MoreVertical size={14} />
                    </button>
                  }
                />
              )}
            </div>
          </div>
        ) : (
          /* Normal mode */
          <>
            {/* Search input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 10px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search mail..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text)',
                  padding: '6px 8px',
                }}
              />
              {localSearch && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    onSearchChange('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Starred filter — applies within the current folder, so you can see
                starred mail in Inbox and then in Sent. */}
            <button
              onClick={onToggleStarredOnly}
              onMouseEnter={() => setStarHovered(true)}
              onMouseLeave={() => setStarHovered(false)}
              title={starredOnly ? 'Showing starred only' : 'Show starred only'}
              aria-pressed={starredOnly}
              style={{
                ...iconButtonStyle,
                background: starredOnly
                  ? 'var(--surface-hover)'
                  : starHovered
                    ? 'var(--surface-hover)'
                    : 'transparent',
                borderColor: starredOnly ? 'var(--amber)' : 'var(--border)',
                color: starredOnly ? 'var(--amber)' : 'var(--text-dim)',
              }}
            >
              <Star size={14} fill={starredOnly ? 'var(--amber)' : 'none'} />
            </button>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onMouseEnter={() => setSortHovered(true)}
                  onMouseLeave={() => setSortHovered(false)}
                  title="Sort"
                  style={{
                    ...iconButtonStyle,
                    background: sortHovered ? 'var(--surface-hover)' : 'transparent',
                    color: sortField === 'received_at' ? 'var(--text-dim)' : 'var(--amber)',
                    borderColor: sortField === 'received_at' ? 'var(--border)' : 'var(--amber)',
                  }}
                >
                  <ArrowUpDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Sort by
                </div>
                {MAIL_SORT_OPTIONS.map(({ field, label }) => (
                  <DropdownMenuItem key={field} onClick={() => onSortChange(field, sortOrder)}>
                    <Check
                      size={13}
                      style={{ marginRight: 6, opacity: sortField === field ? 1 : 0 }}
                    />
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSortChange(sortField, 'desc')}>
                  <ArrowDown size={13} style={{ marginRight: 6, opacity: sortOrder === 'desc' ? 1 : 0.35 }} />
                  {sortField === 'received_at' ? 'Newest first' : 'Descending'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSortChange(sortField, 'asc')}>
                  <ArrowUp size={13} style={{ marginRight: 6, opacity: sortOrder === 'asc' ? 1 : 0.35 }} />
                  {sortField === 'received_at' ? 'Oldest first' : 'Ascending'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              onMouseEnter={() => setRefreshHovered(true)}
              onMouseLeave={() => setRefreshHovered(false)}
              title="Refresh"
              style={{
                ...iconButtonStyle,
                background: refreshHovered ? 'var(--surface-hover)' : 'transparent',
                color: 'var(--text-dim)',
              }}
            >
              <RotateCw size={14} />
            </button>
          </>
        )}
      </div>

      {/* Pagination row */}
      {total > pageSize && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            padding: '2px 12px 6px',
          }}
        >
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {from}–{to} of {total}
          </span>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev}
            style={{ ...pagerBtnStyle, opacity: hasPrev ? 1 : 0.3, cursor: hasPrev ? 'pointer' : 'default' }}
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
            style={{ ...pagerBtnStyle, opacity: hasNext ? 1 : 0.3, cursor: hasNext ? 'pointer' : 'default' }}
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
