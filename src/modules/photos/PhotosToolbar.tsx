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
import { Upload, FolderPlus, Trash2, X, Cpu, Boxes } from 'lucide-react';

// PhotosToolbar was the module's bespoke header (title + view pills + filters +
// batch actions + search + upload). Phase 4 moved the page chrome to the shared
// Media UI Kit (MediaShell tabs + MediaToolbar) so Photos matches Music/Video/
// Books. What remains here are the Photos-specific control clusters that dock
// into the kit slots: PhotosFilters (left), PhotosBatchActions (right) and the
// PhotosUploadButton (shell actions).

function BatchButton({ icon: Icon, label, onClick, disabled, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
}) {
  const [hovered, setHovered] = useState(false);
  const color = variant === 'danger' ? 'var(--error)' : 'var(--text)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px',
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
      {label}
    </button>
  );
}

// ─── Filters (star pills + inventory) — MediaToolbar left slot ──────────

interface PhotosFiltersProps {
  selectedStars?: Set<number>;
  onStarsToggle?: (value: number) => void;
  inventoryActive?: boolean;
  onInventoryToggle?: () => void;
}

export function PhotosFilters({
  selectedStars,
  onStarsToggle,
  inventoryActive = false,
  onInventoryToggle,
}: PhotosFiltersProps) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {onStarsToggle && (
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          {([
            { label: '☆', value: 0 },
            { label: '★', value: 1 },
            { label: '★★', value: 2 },
            { label: '★★★', value: 3 },
            { label: '★★★★', value: 4 },
            { label: '★★★★★', value: 5 },
          ] as const).map((pill) => {
            const active = selectedStars?.has(pill.value) ?? false;
            return (
              <button
                key={pill.value}
                onClick={() => onStarsToggle(pill.value)}
                onMouseEnter={() => setHoveredBtn(`star-${pill.value}`)}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  padding: '4px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
                  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: active ? 'var(--amber)' : hoveredBtn === `star-${pill.value}` ? 'var(--surface-hover)' : 'transparent',
                  color: active ? '#06060a' : 'var(--text-dim)',
                  fontWeight: active ? 600 : 400,
                  transition: 'background var(--transition-fast)',
                  whiteSpace: 'nowrap', letterSpacing: '-1px',
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      )}

      {onInventoryToggle && (
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          <button
            onClick={onInventoryToggle}
            onMouseEnter={() => setHoveredBtn('inventory')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: inventoryActive ? 'var(--amber)' : hoveredBtn === 'inventory' ? 'var(--surface-hover)' : 'transparent',
              color: inventoryActive ? '#06060a' : 'var(--text-dim)',
              fontWeight: inventoryActive ? 600 : 400,
              transition: 'background var(--transition-fast)', whiteSpace: 'nowrap',
            }}
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
}

export function PhotosBatchActions({
  selectedCount,
  onBatchAddToAlbum,
  onBatchProcess,
  onBatchDelete,
  onClearSelection,
}: PhotosBatchActionsProps) {
  const [hovered, setHovered] = useState(false);
  if (selectedCount <= 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
        {selectedCount} selected
      </span>
      {onBatchAddToAlbum && <BatchButton icon={FolderPlus} label="Add to album" onClick={onBatchAddToAlbum} />}
      {onBatchProcess && <BatchButton icon={Cpu} label="Process" onClick={onBatchProcess} />}
      {onBatchDelete && <BatchButton icon={Trash2} label="Delete" onClick={onBatchDelete} variant="danger" />}
      {onClearSelection && (
        <button
          onClick={onClearSelection}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: hovered ? 'var(--surface-hover)' : 'transparent',
            color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <X size={13} />
          Clear
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
