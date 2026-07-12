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

import { useState } from 'react';
import { Upload, FolderPlus, Trash2, X, Cpu, Boxes, Star, ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-media-query';
import { SelectionMenuButton } from '@/components/shared/TileMoreButton';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import type { PhotoSortField, PhotoSortDir } from './types';

// PhotosToolbar was the module's bespoke header (title + view pills + filters +
// batch actions + search + upload). Phase 4 moved the page chrome to the shared
// Media UI Kit (MediaShell tabs + MediaToolbar) so Photos matches Music/Video/
// Books. What remains here are the Photos-specific control clusters that dock
// into the kit slots: PhotosFilters (left), PhotosBatchActions (right) and the
// PhotosUploadButton (shell actions).

function BatchButton({ icon: Icon, label, onClick, disabled, variant, compact }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
  /** Móvil: solo icono (los botones no caben con texto). */
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color = variant === 'danger' ? 'var(--error)' : 'var(--text)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: compact ? '5px 8px' : '4px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: hovered && !disabled ? 'var(--surface-hover)' : 'var(--surface)',
        color: disabled ? 'var(--text-muted)' : color,
        fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} />
      {!compact && label}
    </button>
  );
}

// ─── Filters (stars dropdown + sort + inventory) — MediaToolbar left slot ──
// Compactado para móvil (petición 2026-07-11): las 6 pastillas de estrellas se
// funden en UN botón con dropdown multi-toggle, el filtro Videos desaparece, y
// se añade el control de ordenación (Date/Name/Size + dirección, estilo galería
// MIUI). El mismo cluster se monta en timeline Y dentro de un álbum.

const SORT_LABELS: Record<PhotoSortField, string> = { date: 'Date', name: 'Name', size: 'Size' };

/** Botón-pastilla base del cluster de filtros. */
function pillStyle(active: boolean, hovered: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    background: active ? 'var(--amber)' : hovered ? 'var(--surface-hover)' : 'transparent',
    color: active ? '#06060a' : 'var(--text-dim)',
    fontWeight: active ? 600 : 400,
    transition: 'background var(--transition-fast)', whiteSpace: 'nowrap',
  };
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
};

interface PhotosFiltersProps {
  selectedStars?: Set<number>;
  onStarsToggle?: (value: number) => void;
  onStarsClear?: () => void;
  sortField?: PhotoSortField;
  sortDir?: PhotoSortDir;
  onSortChange?: (field: PhotoSortField, dir: PhotoSortDir) => void;
  inventoryActive?: boolean;
  onInventoryToggle?: () => void;
}

export function PhotosFilters({
  selectedStars,
  onStarsToggle,
  onStarsClear,
  sortField = 'date',
  sortDir = 'desc',
  onSortChange,
  inventoryActive = false,
  onInventoryToggle,
}: PhotosFiltersProps) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const starsActive = (selectedStars?.size ?? 0) > 0;
  const starsLabel = starsActive
    ? [...(selectedStars ?? [])].sort((a, b) => a - b).join(',')
    : 'Stars';
  const DirIcon = sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* Filtro de estrellas: un solo botón con menú multi-toggle */}
      {onStarsToggle && (
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onMouseEnter={() => setHoveredBtn('stars')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={pillStyle(starsActive, hoveredBtn === 'stars')}
                title="Filter by star rating"
              >
                <Star size={12} />
                {starsLabel}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" style={{ minWidth: 160 }}>
              {[5, 4, 3, 2, 1, 0].map((n) => {
                const checked = selectedStars?.has(n) ?? false;
                return (
                  <DropdownMenuItem
                    key={n}
                    onSelect={(e) => { e.preventDefault(); onStarsToggle(n); }}
                    style={menuItemStyle}
                  >
                    <span style={{ width: 14 }}>{checked ? <Check size={13} /> : null}</span>
                    <span style={{ letterSpacing: '-1px' }}>{'★'.repeat(n) + '☆'.repeat(5 - n)}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{n}</span>
                  </DropdownMenuItem>
                );
              })}
              {starsActive && onStarsClear && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onStarsClear()} style={menuItemStyle}>
                    <X size={12} /> Clear filter
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Ordenación: Date / Name / Size + dirección (repetir campo activo invierte) */}
      {onSortChange && (
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onMouseEnter={() => setHoveredBtn('sort')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={pillStyle(false, hoveredBtn === 'sort')}
                title="Sort by"
              >
                <ArrowUpDown size={12} />
                {SORT_LABELS[sortField]}
                <DirIcon size={11} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" style={{ minWidth: 150 }}>
              {(['date', 'name', 'size'] as PhotoSortField[]).map((field) => {
                const active = field === sortField;
                return (
                  <DropdownMenuItem
                    key={field}
                    onSelect={(e) => {
                      e.preventDefault();
                      // Mismo campo → invierte dirección; campo nuevo → desc.
                      onSortChange(field, active ? (sortDir === 'desc' ? 'asc' : 'desc') : 'desc');
                    }}
                    style={menuItemStyle}
                  >
                    <span style={{ width: 14 }}>{active ? <Check size={13} /> : null}</span>
                    {SORT_LABELS[field]}
                    {active && <DirIcon size={12} style={{ marginLeft: 'auto', color: 'var(--amber)' }} />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {onInventoryToggle && (
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          <button
            onClick={onInventoryToggle}
            onMouseEnter={() => setHoveredBtn('inventory')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={pillStyle(inventoryActive, hoveredBtn === 'inventory')}
          >
            <Boxes size={12} />
            Inventory
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Batch actions — MediaToolbar right slot ───────────────────────────

interface PhotosBatchActionsProps {
  selectedCount: number;
  onBatchAddToAlbum?: () => void;
  onBatchProcess?: () => void;
  onBatchDelete?: () => void;
  onClearSelection?: () => void;
  /** Menú del ⋮ único del header — actúa sobre TODA la selección. */
  menuItems?: ContextMenuItem[];
}

export function PhotosBatchActions({
  selectedCount,
  onBatchAddToAlbum,
  onBatchProcess,
  onBatchDelete,
  onClearSelection,
  menuItems,
}: PhotosBatchActionsProps) {
  const [hovered, setHovered] = useState(false);
  const isMobile = useIsMobile();
  if (selectedCount <= 0) return null;

  // Móvil: contador + ⋮ + Clear (las acciones viven en el menú del ⋮ —
  // decisión 2026-07-11: un solo botón de tres puntos, arriba, para el lote).
  const hasMenu = !!menuItems?.length;
  const showButtons = !(isMobile && hasMenu);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
        {selectedCount} selected
      </span>
      {showButtons && onBatchAddToAlbum && <BatchButton icon={FolderPlus} label="Add to album" onClick={onBatchAddToAlbum} compact={isMobile} />}
      {showButtons && onBatchProcess && <BatchButton icon={Cpu} label="Process" onClick={onBatchProcess} compact={isMobile} />}
      {showButtons && onBatchDelete && <BatchButton icon={Trash2} label="Delete" onClick={onBatchDelete} variant="danger" compact={isMobile} />}
      {hasMenu && <SelectionMenuButton items={menuItems!} />}
      {onClearSelection && (
        <button
          onClick={onClearSelection}
          title="Clear selection"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: isMobile ? '5px 8px' : '4px 10px',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: hovered ? 'var(--surface-hover)' : 'transparent',
            color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <X size={13} />
          {!isMobile && 'Clear'}
        </button>
      )}
    </div>
  );
}

// ─── Upload button — MediaShell actions slot ───────────────────────────

export function PhotosUploadButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', fontWeight: 500,
        border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        background: hovered ? 'var(--amber)' : 'var(--amber-dim)',
        color: hovered ? '#06060a' : 'var(--text)',
        transition: 'background var(--transition-fast)', whiteSpace: 'nowrap',
      }}
    >
      <Upload size={14} />
      Upload
    </button>
  );
}
