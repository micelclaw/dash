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

import { useState, useRef, useEffect } from 'react';
import { Loader2, FolderOpen } from 'lucide-react';
import { FileIcon } from '@/components/shared/FileIcon';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFileSize, getMimeLabel } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { buildExplorerContextMenu, buildExplorerBackgroundMenu, type ExplorerMenuContext } from './context-menu';
import type { FileRecord } from '@/types/files';

interface FileBrowserProps {
  files: FileRecord[];
  loading: boolean;
  error: string | null;
  view: 'grid' | 'list';
  selectedFile: FileRecord | null;
  selectedIds: Set<string>;
  isWritable: boolean;
  onItemClick: (file: FileRecord) => void;
  onItemDoubleClick: (file: FileRecord) => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onToggleAll: () => void;
  /** Commit of the inline rename input (id + new name). */
  onRename: (id: string, newName: string) => void;
  /** Menu context built by the page (clipboard, space, writable, callbacks).
   *  FileBrowser injects `onRename` (inline rename) into the callbacks itself. */
  menuCtx: ExplorerMenuContext;
}

export function FileBrowser({
  files, loading, error, view, selectedFile, selectedIds, isWritable,
  onItemClick, onItemDoubleClick, onToggleSelect, onToggleAll, onRename, menuCtx,
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

  // F2 → inline rename of the highlighted entry (matches the menu shortcut label)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'F2' || !isWritable || !selectedFile) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      startRename(selectedFile);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isWritable, selectedFile]);

  // Inject the inline-rename trigger into the page-provided callbacks
  const fullCtx: ExplorerMenuContext = {
    ...menuCtx,
    callbacks: { ...menuCtx.callbacks, onRename: startRename },
  };

  const buildContextItems = (file: FileRecord): ContextMenuItem[] => {
    // Right-click on a selected row acts on the whole selection (Drive convention)
    const entries = selectedIds.size > 0 && selectedIds.has(file.id)
      ? files.filter(f => selectedIds.has(f.id))
      : [file];
    return buildExplorerContextMenu(entries, fullCtx);
  };

  const backgroundItems = buildExplorerBackgroundMenu(fullCtx);

  /** Wrap content in the background (empty-area) context menu when it has entries. */
  const withBackgroundMenu = (content: React.ReactElement) =>
    backgroundItems.length > 0
      ? <ContextMenu trigger={content} items={backgroundItems} />
      : content;

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
    return withBackgroundMenu(
      <div style={{ height: '100%' }}>
        <EmptyState
          icon={FolderOpen}
          title="No files here"
          description="This folder is empty. Upload files or create a new folder to get started."
        />
      </div>
    );
  }

  const hasSelection = selectedIds.size > 0;

  if (view === 'grid') {
    return withBackgroundMenu(
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          padding: 12,
          overflow: 'auto',
          height: '100%',
          alignContent: 'start',
        }}
      >
        {files.map(file => (
          <ContextMenu key={file.id} trigger={
            <GridItem
              file={file}
              isSelected={selectedFile?.id === file.id}
              checked={selectedIds.has(file.id)}
              showCheckbox={hasSelection}
              isRenaming={renamingId === file.id}
              renameValue={renameValue}
              renameInputRef={renameInputRef}
              onRenameChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={() => { setRenamingId(null); setRenameValue(''); }}
              onClick={() => onItemClick(file)}
              onDoubleClick={() => onItemDoubleClick(file)}
              onToggleSelect={(shiftKey) => onToggleSelect(file.id, shiftKey)}
            />
          } items={buildContextItems(file)} />
        ))}
      </div>
    );
  }

  const allChecked = files.length > 0 && files.every(f => selectedIds.has(f.id));

  // List view
  return withBackgroundMenu(
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 90px 120px 100px',
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
        <input
          type="checkbox"
          checked={allChecked}
          onChange={onToggleAll}
          style={{ width: 16, height: 16, accentColor: 'var(--amber)', cursor: 'pointer' }}
        />
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
            checked={selectedIds.has(file.id)}
            isRenaming={renamingId === file.id}
            renameValue={renameValue}
            renameInputRef={renameInputRef}
            onRenameChange={setRenameValue}
            onRenameCommit={commitRename}
            onRenameCancel={() => { setRenamingId(null); setRenameValue(''); }}
            onClick={() => onItemClick(file)}
            onDoubleClick={() => onItemDoubleClick(file)}
            onToggleSelect={(shiftKey) => onToggleSelect(file.id, shiftKey)}
          />
        } items={buildContextItems(file)} />
      ))}
    </div>
  );
}

/* ── Grid Item ── */

function GridItem({ file, isSelected, checked, showCheckbox, isRenaming, renameValue, renameInputRef, onRenameChange, onRenameCommit, onRenameCancel, onClick, onDoubleClick, onToggleSelect }: {
  file: FileRecord;
  isSelected: boolean;
  checked: boolean;
  showCheckbox: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onToggleSelect: (shiftKey: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showCb = showCheckbox || hovered || checked;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        height: 120,
        padding: '12px 8px',
        borderRadius: 'var(--radius-md)',
        background: checked ? 'var(--amber-dim)' : isSelected ? 'var(--surface-hover)' : hovered ? 'var(--surface)' : 'transparent',
        border: (isSelected || checked) ? '1px solid var(--amber-dim)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
      }}
    >
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

function ListRow({ file, isSelected, checked, isRenaming, renameValue, renameInputRef, onRenameChange, onRenameCommit, onRenameCancel, onClick, onDoubleClick, onToggleSelect }: {
  file: FileRecord;
  isSelected: boolean;
  checked: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onToggleSelect: (shiftKey: boolean) => void;
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
        gridTemplateColumns: '32px 1fr 90px 120px 100px',
        gap: 8,
        padding: '0 12px',
        height: 36,
        alignItems: 'center',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        background: checked ? 'var(--amber-dim)' : isSelected ? 'var(--surface-hover)' : hovered ? 'var(--surface)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        transition: 'background var(--transition-fast)',
        color: 'var(--text)',
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
