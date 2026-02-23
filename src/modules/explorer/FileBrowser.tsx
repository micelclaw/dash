import { useState, useRef } from 'react';
import { Loader2, FolderOpen, Download, Link, Info, Edit3, Move, Trash2 } from 'lucide-react';
import { FileIcon } from '@/components/shared/FileIcon';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFileSize, getMimeLabel } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import type { FileRecord } from '@/types/files';

interface FileBrowserProps {
  files: FileRecord[];
  loading: boolean;
  error: string | null;
  view: 'grid' | 'list';
  selectedFile: FileRecord | null;
  isWritable: boolean;
  onItemClick: (file: FileRecord) => void;
  onItemDoubleClick: (file: FileRecord) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export function FileBrowser({
  files, loading, error, view, selectedFile, isWritable,
  onItemClick, onItemDoubleClick, onRename, onDelete,
}: FileBrowserProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRename = (file: FileRecord) => {
    setRenamingId(file.id);
    setRenameValue(file.filename);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim() && renameValue.trim() !== files.find(f => f.id === renamingId)?.filename) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const buildContextItems = (file: FileRecord): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    if (file.is_directory) {
      items.push({ label: 'Open', icon: FolderOpen, onClick: () => onItemDoubleClick(file) });
    }
    if (!file.is_directory) {
      items.push({ label: 'Download', icon: Download, onClick: () => {}, disabled: true });
    }
    items.push({ label: 'Copy path', icon: Link, onClick: () => { void navigator.clipboard.writeText(file.filepath); } });
    items.push({ label: 'Properties', icon: Info, onClick: () => onItemClick(file) });
    if (isWritable) {
      items.push({ label: '', icon: undefined, onClick: () => {}, separator: true });
      items.push({ label: 'Rename', icon: Edit3, onClick: () => startRename(file) });
      items.push({ label: 'Move to...', icon: Move, onClick: () => {}, disabled: true });
      items.push({ label: 'Delete', icon: Trash2, onClick: () => onDelete(file.id), variant: 'danger' });
    }
    return items;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 size={24} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--error)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
        {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No files here"
        description="This folder is empty. Upload files or create a new folder to get started."
      />
    );
  }

  if (view === 'grid') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          padding: 12,
          overflow: 'auto',
          height: '100%',
        }}
      >
        {files.map(file => (
          <ContextMenu key={file.id} trigger={
            <GridItem
              file={file}
              isSelected={selectedFile?.id === file.id}
              isRenaming={renamingId === file.id}
              renameValue={renameValue}
              renameInputRef={renameInputRef}
              onRenameChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={() => { setRenamingId(null); setRenameValue(''); }}
              onClick={() => onItemClick(file)}
              onDoubleClick={() => onItemDoubleClick(file)}
            />
          } items={buildContextItems(file)} />
        ))}
      </div>
    );
  }

  // List view
  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 120px 100px',
          gap: 8,
          padding: '0 12px',
          height: 32,
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-sans)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 1,
        }}
      >
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span>Type</span>
      </div>
      {/* Rows */}
      {files.map(file => (
        <ContextMenu key={file.id} trigger={
          <ListRow
            file={file}
            isSelected={selectedFile?.id === file.id}
            isRenaming={renamingId === file.id}
            renameValue={renameValue}
            renameInputRef={renameInputRef}
            onRenameChange={setRenameValue}
            onRenameCommit={commitRename}
            onRenameCancel={() => { setRenamingId(null); setRenameValue(''); }}
            onClick={() => onItemClick(file)}
            onDoubleClick={() => onItemDoubleClick(file)}
          />
        } items={buildContextItems(file)} />
      ))}
    </div>
  );
}

/* ── Grid Item ── */

function GridItem({ file, isSelected, isRenaming, renameValue, renameInputRef, onRenameChange, onRenameCommit, onRenameCancel, onClick, onDoubleClick }: {
  file: FileRecord;
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        height: 120,
        padding: '12px 8px',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? 'var(--surface-hover)' : hovered ? 'var(--surface)' : 'transparent',
        border: isSelected ? '1px solid var(--amber-dim)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <FileIcon mime={file.mime_type} isDirectory={file.is_directory} size="lg" />
      {isRenaming ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') onRenameCommit();
            if (e.key === 'Escape') onRenameCancel();
          }}
          style={{
            width: '100%',
            fontSize: '0.75rem',
            padding: '2px 4px',
            textAlign: 'center',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text)',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            lineHeight: 1.3,
          }}
          title={file.filename}
        >
          {file.filename}
        </span>
      )}
    </div>
  );
}

/* ── List Row ── */

function ListRow({ file, isSelected, isRenaming, renameValue, renameInputRef, onRenameChange, onRenameCommit, onRenameCancel, onClick, onDoubleClick }: {
  file: FileRecord;
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 120px 100px',
        gap: 8,
        padding: '0 12px',
        height: 36,
        alignItems: 'center',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        background: isSelected ? 'var(--surface-hover)' : hovered ? 'var(--surface)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        transition: 'background var(--transition-fast)',
        color: 'var(--text)',
      }}
    >
      {/* Name cell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FileIcon mime={file.mime_type} isDirectory={file.is_directory} size="sm" />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={e => {
              if (e.key === 'Enter') onRenameCommit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            style={{
              flex: 1,
              fontSize: '0.8125rem',
              padding: '2px 4px',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              minWidth: 0,
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={file.filename}
          >
            {file.filename}
          </span>
        )}
      </div>
      {/* Size */}
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {file.is_directory ? '--' : formatFileSize(file.size_bytes)}
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
  );
}
