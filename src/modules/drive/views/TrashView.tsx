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

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { FileIcon } from '@/components/shared/FileIcon';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { formatFileSize } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { api } from '@/services/api';
import { useFileClipboard } from '@/stores/file-clipboard.store';
import { useFilesQuery } from '../hooks/use-files-query';
import { useDriveShortcuts } from '../hooks/use-drive-shortcuts';
import { buildFileContextMenu, type DriveMenuContext } from '../context-menu';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import type { FileRecord } from '@/types/files';

type ConfirmKind =
  | { kind: 'one'; id: string; name: string }
  | { kind: 'selected' }
  | { kind: 'all' };

/**
 * Trash — GET /files?only_deleted=true with restore, permanent delete
 * (confirmed) and an "Empty trash" action.
 */
export function TrashView() {
  const { files, loading, error, refetch } = useFilesQuery({
    only_deleted: true,
    limit: 200,
    sort: 'updated_at',
    order: 'desc',
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === files.length && files.length > 0 ? new Set() : new Set(files.map(f => f.id)),
    );
  }, [files]);

  const restoreOne = useCallback(async (file: FileRecord) => {
    try {
      await api.post(`/files/${file.id}/restore`);
      toast.success(`"${file.filename}" restored`);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(file.id); return n; });
      await refetch();
    } catch {
      toast.error('Restore failed');
    }
  }, [refetch]);

  const restoreMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await api.post('/files/bulk', { action: 'restore', ids });
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} restored`);
      setSelectedIds(new Set());
      await refetch();
    } catch {
      toast.error('Bulk restore failed');
    } finally {
      setBusy(false);
    }
  }, [refetch]);

  const restoreSelected = useCallback(async () => {
    await restoreMany([...selectedIds]);
  }, [restoreMany, selectedIds]);

  const handleConfirmedDelete = useCallback(async () => {
    const target = confirm;
    setConfirm(null);
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === 'one') {
        await api.delete(`/files/${target.id}?permanent=true`);
        toast.success('Deleted forever');
        setSelectedIds(prev => { const n = new Set(prev); n.delete(target.id); return n; });
      } else {
        const ids = target.kind === 'selected' ? [...selectedIds] : files.map(f => f.id);
        if (ids.length === 0) return;
        await api.post('/files/bulk', { action: 'delete', ids, params: { permanent: true } });
        toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} deleted forever`);
        setSelectedIds(new Set());
      }
      await refetch();
    } catch {
      toast.error('Permanent delete failed');
    } finally {
      setBusy(false);
    }
  }, [confirm, selectedIds, files, refetch]);

  const hasSelection = selectedIds.size > 0;
  const allChecked = files.length > 0 && files.every(f => selectedIds.has(f.id));

  // ─── D4 context menu (Restore / Delete forever only) ────

  const navigate = useNavigate();
  const clipboard = useFileClipboard();
  const selectedFiles = useMemo(
    () => files.filter(f => selectedIds.has(f.id)),
    [files, selectedIds],
  );

  const menuCtx: DriveMenuContext = useMemo(() => ({
    tab: 'trash',
    clipboard: { operation: clipboard.operation, fileIds: clipboard.fileIds },
    navigate,
    callbacks: {
      onRestore: (targets) => {
        if (targets.length === 1) void restoreOne(targets[0]!);
        else void restoreMany(targets.map(f => f.id));
      },
      onDeleteForever: (targets) => {
        if (targets.length === 1) {
          setConfirm({ kind: 'one', id: targets[0]!.id, name: targets[0]!.filename });
        } else {
          setSelectedIds(new Set(targets.map(f => f.id)));
          setConfirm({ kind: 'selected' });
        }
      },
    },
  }), [clipboard.operation, clipboard.fileIds, navigate, restoreOne, restoreMany]);

  const getContextMenuItems = useCallback((file: FileRecord): ContextMenuItem[] => {
    const targets = selectedIds.has(file.id) && selectedIds.size > 1
      ? selectedFiles
      : [file];
    return buildFileContextMenu(targets, menuCtx);
  }, [selectedIds, selectedFiles, menuCtx]);

  // ─── Keyboard shortcuts (D4): Ctrl+A / Delete = forever / Esc ──

  useDriveShortcuts({
    disabled: confirm !== null,
    onSelectAll: () => {
      if (files.length > 0 && selectedIds.size !== files.length) {
        setSelectedIds(new Set(files.map(f => f.id)));
      }
    },
    onDelete: () => {
      if (selectedIds.size > 0) setConfirm({ kind: 'selected' });
    },
    onEscape: () => {
      if (selectedIds.size > 0) setSelectedIds(new Set());
    },
  });

  if (!loading && files.length === 0) {
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Deleted files land here. You can restore them or delete them forever."
      />
    );
  }

  const confirmCopy = (() => {
    if (!confirm) return { title: '', description: '' };
    if (confirm.kind === 'one') {
      return {
        title: `Delete "${confirm.name}" forever?`,
        description: 'This cannot be undone — the file is removed permanently.',
      };
    }
    if (confirm.kind === 'selected') {
      return {
        title: `Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'} forever?`,
        description: 'This cannot be undone — the files are removed permanently.',
      };
    }
    return {
      title: `Empty trash (${files.length} item${files.length === 1 ? '' : 's'})?`,
      description: 'Everything in the trash is permanently removed. This cannot be undone.',
    };
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <Trash2 size={14} style={{ color: 'var(--mod-drive)' }} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
          {files.length} item{files.length === 1 ? '' : 's'} in trash
        </span>
        <div style={{ flex: 1 }} />
        {hasSelection && (
          <>
            <ActionButton icon={RotateCcw} label={`Restore (${selectedIds.size})`} onClick={() => { void restoreSelected(); }} disabled={busy} />
            <ActionButton icon={X} label={`Delete (${selectedIds.size})`} onClick={() => setConfirm({ kind: 'selected' })} disabled={busy} danger />
          </>
        )}
        <ActionButton icon={Trash2} label="Empty trash" onClick={() => setConfirm({ kind: 'all' })} disabled={busy || files.length === 0} danger />
      </div>

      {/* List */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {error && (
          <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--error)' }}>{error}</div>
        )}

        {/* Column header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 90px 140px 170px',
          gap: 8,
          padding: '6px 16px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
          alignItems: 'center',
          fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--text-muted)',
        }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            style={{ width: 16, height: 16, accentColor: 'var(--amber)', cursor: 'pointer' }}
          />
          <span>Name</span>
          <span>Size</span>
          <span>Deleted</span>
          <span />
        </div>

        {files.map(file => (
          <TrashRow
            key={file.id}
            file={file}
            checked={selectedIds.has(file.id)}
            contextItems={getContextMenuItems(file)}
            onToggle={() => toggleSelection(file.id)}
            onRestore={() => { void restoreOne(file); }}
            onDeleteForever={() => setConfirm({ kind: 'one', id: file.id, name: file.filename })}
          />
        ))}

        {loading && (
          <div style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => { void handleConfirmedDelete(); }}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel="Delete forever"
        variant="danger"
      />
    </div>
  );
}

function TrashRow({ file, checked, contextItems, onToggle, onRestore, onDeleteForever }: {
  file: FileRecord;
  checked: boolean;
  contextItems: ContextMenuItem[];
  onToggle: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <ContextMenu
      items={contextItems}
      trigger={
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 90px 140px 170px',
        gap: 8,
        padding: '6px 16px',
        alignItems: 'center',
        background: checked ? 'var(--amber-dim)' : hovered ? 'var(--surface-hover)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.8125rem',
        color: 'var(--text)',
        transition: 'background var(--transition-fast)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ width: 16, height: 16, accentColor: 'var(--amber)', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FileIcon mime={file.mime_type} isDirectory={file.is_directory} size="sm" />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.filename}>
          {file.filename}
        </span>
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {file.is_directory ? '--' : formatFileSize(file.size_bytes)}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {file.deleted_at ? formatRelative(new Date(file.deleted_at)) : '--'}
      </span>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <ActionButton icon={RotateCcw} label="Restore" onClick={onRestore} />
        <ActionButton icon={X} label="Delete forever" onClick={onDeleteForever} danger />
      </div>
    </div>
      }
    />
  );
}

function ActionButton({ icon: Icon, label, onClick, danger, disabled }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: hovered && !disabled ? 'var(--surface-hover)' : 'var(--surface)',
        color: disabled ? 'var(--text-muted)' : danger ? 'var(--error)' : 'var(--text)',
        fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
