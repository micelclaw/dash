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

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronUp, ChevronDown, Folder,
  Pencil, FolderInput, Download, Share2, Link2, Trash2, Info, FileText, Play, ListPlus,
} from 'lucide-react';
import { FileIcon } from '@/components/shared/FileIcon';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFileSize, getMimeLabel } from '@/lib/file-utils';
import { downloadFile } from '@/lib/file-download';
import { usePlayerStore } from '@/stores/player.store';
import { api } from '@/services/api';
import { formatRelative } from '@/lib/date-helpers';
import type { FileRecord } from '@/types/files';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import type { SortField, SortDirection } from './types';

interface DriveListProps {
  files: FileRecord[];
  loading: boolean;
  selectedFileId: string | null;
  selectedIds: Set<string>;
  onItemClick: (file: FileRecord) => void;
  onItemDoubleClick: (file: FileRecord) => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onToggleAll: () => void;
  onRename: (id: string) => void;
  onMove: (id: string) => void;
  onShare: (file: FileRecord) => void;
  onDelete: (id: string) => void;
  onDragToFolder?: (fileIds: string[], destPath: string) => void;
}

const COLUMNS: { key: SortField; label: string; width?: string }[] = [
  { key: 'filename', label: 'Name' },
  { key: 'size_bytes', label: 'Size', width: '90px' },
  { key: 'updated_at', label: 'Modified', width: '120px' },
  { key: 'mime_type', label: 'Type', width: '100px' },
];

const GRID_COLS = '32px 1fr 90px 120px 100px';

export function DriveList({
  files, loading, selectedFileId, selectedIds,
  onItemClick, onItemDoubleClick, onToggleSelect, onToggleAll,
  onRename, onMove, onShare, onDelete, onDragToFolder,
}: DriveListProps) {
  const [sortField, setSortField] = useState<SortField>('filename');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    sorted.sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      let cmp = 0;
      switch (sortField) {
        case 'filename':
          cmp = a.filename.localeCompare(b.filename);
          break;
        case 'size_bytes':
          cmp = a.size_bytes - b.size_bytes;
          break;
        case 'updated_at':
          cmp = a.updated_at.localeCompare(b.updated_at);
          break;
        case 'mime_type':
          cmp = getMimeLabel(a.mime_type).localeCompare(getMimeLabel(b.mime_type));
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [files, sortField, sortDir]);

  const allChecked = files.length > 0 && files.every(f => selectedIds.has(f.id));

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
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLS,
          gap: 8,
          padding: '6px 16px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 1,
          alignItems: 'center',
        }}
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={onToggleAll}
          style={{ width: 16, height: 16, accentColor: 'var(--amber)', cursor: 'pointer' }}
        />
        {COLUMNS.map(col => (
          <ColumnHeader
            key={col.key}
            label={col.label}
            active={sortField === col.key}
            direction={sortField === col.key ? sortDir : 'asc'}
            onClick={() => handleSort(col.key)}
          />
        ))}
      </div>

      {/* Rows */}
      {sortedFiles.map(file => (
        <ListRow
          key={file.id}
          file={file}
          selected={file.id === selectedFileId}
          checked={selectedIds.has(file.id)}
          selectedIds={selectedIds}
          onClick={() => onItemClick(file)}
          onDoubleClick={() => onItemDoubleClick(file)}
          onToggleSelect={(shiftKey) => onToggleSelect(file.id, shiftKey)}
          onRename={() => onRename(file.id)}
          onMove={() => onMove(file.id)}
          onShare={() => onShare(file)}
          onDelete={() => onDelete(file.id)}
          onDragToFolder={onDragToFolder}
        />
      ))}

      {loading && Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          style={{
            height: 36,
            margin: '0 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            animation: 'pulse 1.5s ease-in-out infinite',
            marginBottom: 4,
          }}
        />
      ))}
    </div>
  );
}

function ColumnHeader({
  label, active, direction, onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const SortIcon = direction === 'asc' ? ChevronUp : ChevronDown;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        color: active ? 'var(--text)' : hovered ? 'var(--text-dim)' : 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '4px 0',
        transition: 'color var(--transition-fast)',
      }}
    >
      {label}
      {active && <SortIcon size={12} />}
    </button>
  );
}

function ListRow({
  file, selected, checked, selectedIds, onClick, onDoubleClick, onToggleSelect,
  onRename, onMove, onShare, onDelete, onDragToFolder,
}: {
  file: FileRecord;
  selected: boolean;
  checked: boolean;
  selectedIds: Set<string>;
  onClick: () => void;
  onDoubleClick: () => void;
  onToggleSelect: (shiftKey: boolean) => void;
  onRename: () => void;
  onMove: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDragToFolder?: (fileIds: string[], destPath: string) => void;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const isDir = file.is_directory;

  const isOfficeMime = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv)$/i.test(file.filename)
    || file.mime_type?.startsWith('application/vnd.openxmlformats-officedocument')
    || file.mime_type?.startsWith('application/vnd.ms-')
    || file.mime_type?.startsWith('application/vnd.oasis.opendocument');
  const isPdf = file.mime_type === 'application/pdf';
  const isAudio = file.mime_type?.startsWith('audio/');
  const isVideo = file.mime_type?.startsWith('video/');

  const playFromDrive = async () => {
    let title = file.filename;
    let artist: string | undefined;
    let coverBase64: string | undefined;
    try {
      const info = await api.get<{ data: { title: string; artist: string | null; coverBase64: string | null } }>(`/files/${file.id}/media-info`);
      title = info.data.title || file.filename;
      artist = info.data.artist || undefined;
      coverBase64 = info.data.coverBase64 || undefined;
    } catch { /* use filename */ }
    const item = { fileId: file.id, title, artist, coverBase64, streamUrl: `/files/${file.id}/stream`, mediaType: (isVideo ? 'video' : 'audio') as 'audio' | 'video' };
    if (isVideo) usePlayerStore.getState().playVideo(item);
    else usePlayerStore.getState().playAudio(item);
  };

  const contextItems: ContextMenuItem[] = [
    ...(isAudio ? [
      { label: 'Play', icon: Play, onClick: () => { void playFromDrive(); } },
      { label: 'Add to queue', icon: ListPlus, onClick: () => {
        usePlayerStore.getState().addToQueue({ fileId: file.id, title: file.filename, streamUrl: `/files/${file.id}/stream`, mediaType: 'audio' as const });
      }},
    ] : []),
    ...(isVideo ? [
      { label: 'Play video', icon: Play, onClick: () => { void playFromDrive(); } },
    ] : []),
    ...(isOfficeMime ? [
      { label: 'Open in Office', icon: FileText, onClick: () => navigate(`/office/edit/${file.id}`) },
    ] : []),
    ...(isPdf ? [
      { label: 'Open in PDF Viewer', icon: FileText, onClick: () => navigate(`/office/pdf/${file.id}`) },
    ] : []),
    { label: 'Rename', icon: Pencil, onClick: onRename },
    { label: 'Move to...', icon: FolderInput, onClick: onMove },
    { label: 'Download', icon: Download, onClick: () => { void downloadFile(file.id, isDir ? `${file.filename}.zip` : file.filename); } },
    ...(!isDir ? [
      { label: 'Share link', icon: Share2, onClick: onShare },
      { label: 'Copy link', icon: Link2, onClick: () => { void navigator.clipboard.writeText(file.filepath); } },
    ] : []),
    { label: '', separator: true, onClick: () => {} },
    { label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' as const },
    { label: '', separator: true, onClick: () => {} },
    { label: 'Properties', icon: Info, onClick },
  ];

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
      if (ids.includes(file.id)) return;
      const destPath = file.filepath.endsWith('/') ? file.filepath : file.filepath + '/';
      onDragToFolder(ids, destPath);
    } catch { /* ignore bad data */ }
  };

  return (
    <ContextMenu
      trigger={
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
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
            gap: 8,
            padding: '6px 16px',
            cursor: 'pointer',
            background: isDragOver
              ? 'var(--amber-dim)'
              : checked
                ? 'var(--amber-dim)'
                : selected
                  ? 'var(--amber-dim)'
                  : hovered
                    ? 'var(--surface-hover)'
                    : 'transparent',
            borderBottom: '1px solid var(--border)',
            border: isDragOver ? '1px dashed var(--amber)' : undefined,
            transition: 'background var(--transition-fast)',
            fontSize: '0.8125rem',
            color: 'var(--text)',
            alignItems: 'center',
          }}
        >
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={checked}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(e.shiftKey); }}
            onChange={() => {}}
            style={{ width: 16, height: 16, accentColor: 'var(--amber)', cursor: 'pointer' }}
          />

          {/* Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <FileIcon mime={file.mime_type} isDirectory={isDir} size="sm" />
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={file.filename}
            >
              {file.filename}
            </span>
            <HeatBadge score={file.heat_score ?? 0} />
          </div>

          {/* Size */}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {isDir ? '--' : formatFileSize(file.size_bytes)}
          </span>

          {/* Modified */}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {formatRelative(new Date(file.updated_at))}
          </span>

          {/* Type */}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {getMimeLabel(file.mime_type)}
          </span>
        </div>
      }
      items={contextItems}
    />
  );
}
