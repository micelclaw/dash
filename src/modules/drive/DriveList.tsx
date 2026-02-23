import { useState, useMemo } from 'react';
import {
  ChevronUp, ChevronDown, Folder,
  Pencil, FolderInput, Download, Share2, Link2, Trash2, Info,
} from 'lucide-react';
import { FileIcon } from '@/components/shared/FileIcon';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFileSize, getMimeLabel } from '@/lib/file-utils';
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
  onRename, onMove, onShare, onDelete,
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
          onClick={() => onItemClick(file)}
          onDoubleClick={() => onItemDoubleClick(file)}
          onToggleSelect={(shiftKey) => onToggleSelect(file.id, shiftKey)}
          onRename={() => onRename(file.id)}
          onMove={() => onMove(file.id)}
          onShare={() => onShare(file)}
          onDelete={() => onDelete(file.id)}
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
  file, selected, checked, onClick, onDoubleClick, onToggleSelect,
  onRename, onMove, onShare, onDelete,
}: {
  file: FileRecord;
  selected: boolean;
  checked: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onToggleSelect: (shiftKey: boolean) => void;
  onRename: () => void;
  onMove: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDir = file.is_directory;

  const contextItems: ContextMenuItem[] = [
    { label: 'Rename', icon: Pencil, onClick: onRename },
    { label: 'Move to...', icon: FolderInput, onClick: onMove },
    ...(!isDir ? [
      { label: 'Download', icon: Download, onClick: () => {} },
      { label: 'Share link', icon: Share2, onClick: onShare },
      { label: 'Copy link', icon: Link2, onClick: () => {} },
    ] : []),
    { label: '', separator: true, onClick: () => {} },
    { label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' as const },
    { label: '', separator: true, onClick: () => {} },
    { label: 'Properties', icon: Info, onClick },
  ];

  return (
    <ContextMenu
      trigger={
        <div
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
            background: checked
              ? 'var(--amber-dim)'
              : selected
                ? 'var(--amber-dim)'
                : hovered
                  ? 'var(--surface-hover)'
                  : 'transparent',
            borderBottom: '1px solid var(--border)',
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
