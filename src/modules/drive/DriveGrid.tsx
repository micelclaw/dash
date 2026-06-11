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
import { Image, Folder, Star } from 'lucide-react';
import { FileIcon } from '@/components/shared/FileIcon';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { EmptyState } from '@/components/shared/EmptyState';
import { isImageMime, simpleHash } from '@/lib/file-utils';
import type { FileRecord } from '@/types/files';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';

interface DriveGridProps {
  files: FileRecord[];
  loading: boolean;
  selectedFileId: string | null;
  selectedIds: Set<string>;
  hasSelection: boolean;
  onItemClick: (file: FileRecord) => void;
  onItemDoubleClick: (file: FileRecord) => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  /** D4 — rich context menu built per file by the view (see drive/context-menu.tsx). */
  getContextMenuItems: (file: FileRecord) => ContextMenuItem[];
  onToggleStar?: (file: FileRecord) => void;
  onDragToFolder?: (fileIds: string[], destPath: string) => void;
  /** Ids sitting in the clipboard as a pending CUT — rendered dimmed. */
  cutIds?: Set<string>;
  isMobile?: boolean;
}

export function DriveGrid({
  files, loading, selectedFileId, selectedIds, hasSelection,
  onItemClick, onItemDoubleClick, onToggleSelect,
  getContextMenuItems, onToggleStar, onDragToFolder, cutIds,
  isMobile,
}: DriveGridProps) {
  if (!loading && files.length === 0) {
    return (
      <EmptyState
        icon={Folder}
        title="This folder is empty"
        description="Drop files here or use the upload button"
      />
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? 'repeat(2, 1fr)'
          : 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: isMobile ? 8 : 12,
        padding: isMobile ? 10 : 16,
      }}
    >
      {files.map(file => (
        <GridItem
          key={file.id}
          file={file}
          selected={file.id === selectedFileId}
          checked={selectedIds.has(file.id)}
          showCheckbox={hasSelection}
          selectedIds={selectedIds}
          isCut={!!cutIds?.has(file.id)}
          onClick={() => onItemClick(file)}
          onDoubleClick={() => onItemDoubleClick(file)}
          onToggleSelect={(shiftKey) => onToggleSelect(file.id, shiftKey)}
          contextItems={getContextMenuItems(file)}
          onToggleStar={onToggleStar ? () => onToggleStar(file) : undefined}
          starred={!!file.starred}
          onDragToFolder={onDragToFolder}
        />
      ))}
      {loading && Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          style={{
            height: 120,
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

function GridItem({
  file, selected, checked, showCheckbox, selectedIds, isCut, onClick, onDoubleClick,
  onToggleSelect, contextItems, onToggleStar, starred, onDragToFolder,
}: {
  file: FileRecord;
  selected: boolean;
  checked: boolean;
  showCheckbox: boolean;
  selectedIds: Set<string>;
  isCut: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onToggleSelect: (shiftKey: boolean) => void;
  contextItems: ContextMenuItem[];
  onToggleStar?: () => void;
  starred?: boolean;
  onDragToFolder?: (fileIds: string[], destPath: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const isImage = isImageMime(file.mime_type);
  const isDir = file.is_directory;

  const hue = simpleHash(file.id) % 360;
  const showCb = showCheckbox || hovered || checked;

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    const ids = checked && selectedIds.size > 0
      ? [...selectedIds]
      : [file.id];
    e.dataTransfer.setData('application/claw-file-ids', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDir) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isDir) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isDir || !onDragToFolder) return;
    const raw = e.dataTransfer.getData('application/claw-file-ids');
    if (!raw) return;
    try {
      const ids = JSON.parse(raw) as string[];
      // Don't drop a folder onto itself
      if (ids.includes(file.id)) return;
      const destPath = file.filepath.endsWith('/') ? file.filepath : file.filepath + '/';
      onDragToFolder(ids, destPath);
    } catch { /* ignore bad data */ }
  };

  const dropHighlight = isDragOver ? {
    border: '2px dashed var(--amber)',
    background: 'var(--amber-dim)',
  } : {};

  return (
    <ContextMenu trigger={
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          width: '100%',
          height: 120,
          borderRadius: 'var(--radius-md)',
          background: checked
            ? 'var(--amber-dim)'
            : selected
              ? 'var(--amber-dim)'
              : hovered
                ? 'var(--surface-hover)'
                : 'var(--surface)',
          border: (selected || checked) ? '1px solid var(--amber)' : '1px solid transparent',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'background var(--transition-fast), box-shadow var(--transition-fast)',
          boxShadow: hovered ? 'var(--shadow-md)' : 'none',
          fontFamily: 'var(--font-sans)',
          // Pending cut → dimmed until pasted (D4)
          opacity: isCut ? 0.45 : 1,
          ...dropHighlight,
        }}
      >
        {/* Checkbox */}
        {showCb && (
          <input
            type="checkbox"
            checked={checked}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(e.shiftKey); }}
            onChange={() => {}}
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              width: 16,
              height: 16,
              accentColor: 'var(--amber)',
              cursor: 'pointer',
              zIndex: 2,
            }}
          />
        )}

        {/* Star toggle (D3) — visible when starred or hovered */}
        {onToggleStar && (starred || hovered) && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
            title={starred ? 'Unstar' : 'Star'}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: starred ? 'var(--amber)' : 'var(--text-muted)',
            }}
          >
            <Star size={14} fill={starred ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Thumbnail area — 80px */}
        <div
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...(isImage ? {
              background: `linear-gradient(135deg, hsl(${hue}, 35%, 25%), hsl(${(hue + 40) % 360}, 35%, 18%))`,
            } : {}),
          }}
        >
          {isImage ? (
            <Image size={28} style={{ color: 'var(--text-dim)', opacity: 0.7 }} />
          ) : isDir ? (
            <Folder size={28} style={{ color: isDragOver ? 'var(--amber)' : 'var(--amber)' }} />
          ) : (
            <FileIcon mime={file.mime_type} isDirectory={false} size="lg" />
          )}
        </div>

        {/* Filename area — 40px */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
              textAlign: 'center',
            }}
            title={file.filename}
          >
            {file.filename}
          </span>
        </div>
      </div>
    } items={contextItems} />
  );
}
