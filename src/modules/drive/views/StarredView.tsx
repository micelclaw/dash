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

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Star, StarOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { RenameDialog } from '@/components/shared/RenameDialog';
import { FolderPicker } from '@/components/shared/FolderPicker';
import { ShareModal } from '@/components/shared/ShareModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useIsMobile } from '@/hooks/use-media-query';
import { api } from '@/services/api';
import { useFilesQuery } from '../hooks/use-files-query';
import { DriveGrid } from '../DriveGrid';
import { DriveList } from '../DriveList';
import { DrivePreview } from '../DrivePreview';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';
import type { DriveView } from '../types';

/**
 * Starred — GET /files?starred=true, reusing the Drive grid/list with an
 * inline unstar toggle and a small batch bar (bulk unstar / delete).
 */
export function StarredView() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { files, loading, error, refetch } = useFilesQuery({ starred: true, limit: 200 });

  const [view, setView] = useState<DriveView>(
    () => (localStorage.getItem('drive-view') as DriveView) || 'grid',
  );
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastToggleRef = useRef<string | null>(null);

  // Modals
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<Set<string> | null>(null);

  const changeView = useCallback((v: DriveView) => {
    setView(v);
    localStorage.setItem('drive-view', v);
  }, []);

  const toggleSelection = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastToggleRef.current) {
        const fromIdx = files.findIndex(f => f.id === lastToggleRef.current);
        const toIdx = files.findIndex(f => f.id === id);
        if (fromIdx >= 0 && toIdx >= 0) {
          for (let i = Math.min(fromIdx, toIdx); i <= Math.max(fromIdx, toIdx); i++) {
            next.add(files[i]!.id);
          }
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      lastToggleRef.current = id;
      return next;
    });
  }, [files]);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === files.length && files.length > 0 ? new Set() : new Set(files.map(f => f.id)),
    );
  }, [files]);

  const handleUnstar = useCallback(async (file: FileRecord) => {
    try {
      await api.patch<ApiResponse<FileRecord>>(`/files/${file.id}`, { starred: false });
      toast.success('Star removed');
      setSelectedFile(prev => prev?.id === file.id ? null : prev);
      await refetch();
    } catch {
      toast.error('Could not remove star');
    }
  }, [refetch]);

  const handleBulkUnstar = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      await api.post('/files/bulk', { action: 'unstar', ids });
      toast.success(`${ids.length} star${ids.length === 1 ? '' : 's'} removed`);
      setSelectedIds(new Set());
      setSelectedFile(null);
      await refetch();
    } catch {
      toast.error('Bulk unstar failed');
    }
  }, [selectedIds, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.delete(`/files/${id}`);
      toast.success('Moved to trash');
      setSelectedFile(prev => prev?.id === id ? null : prev);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      await refetch();
    } catch {
      toast.error('Delete failed');
    }
  }, [refetch]);

  const handleBulkDelete = useCallback(async () => {
    const ids = confirmDeleteIds ? [...confirmDeleteIds] : [];
    setConfirmDeleteIds(null);
    if (ids.length === 0) return;
    try {
      await api.post('/files/bulk', { action: 'delete', ids });
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} moved to trash`);
      setSelectedIds(new Set());
      setSelectedFile(null);
      await refetch();
    } catch {
      toast.error('Bulk delete failed');
    }
  }, [confirmDeleteIds, refetch]);

  const handleRename = useCallback((id: string) => {
    const file = files.find(f => f.id === id);
    if (file) setRenameTarget(file);
  }, [files]);

  const handleRenameConfirm = useCallback(async (name: string) => {
    if (!renameTarget) return;
    try {
      await api.patch<ApiResponse<FileRecord>>(`/files/${renameTarget.id}`, { filename: name });
      await refetch();
    } catch {
      toast.error('Rename failed');
    }
  }, [renameTarget, refetch]);

  const handleMoveConfirm = useCallback(async (destPath: string) => {
    const id = moveTargetId;
    setMoveTargetId(null);
    if (!id) return;
    try {
      await api.patch<ApiResponse<FileRecord>>(`/files/${id}`, { parent_folder: destPath });
      toast.success('File moved');
      await refetch();
    } catch {
      toast.error('Move failed');
    }
  }, [moveTargetId, refetch]);

  const handleItemDoubleClick = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      const path = file.filepath.endsWith('/') ? file.filepath : file.filepath + '/';
      navigate(`/drive?tab=my-drive&path=${encodeURIComponent(path)}`);
    } else {
      navigate(`/drive?tab=my-drive&id=${file.id}`);
    }
  }, [navigate]);

  const hasSelection = selectedIds.size > 0;

  if (!loading && files.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No starred files"
        description="Mark files with the star to pin your favorites here."
        actions={[{ label: 'Browse My Drive', onClick: () => navigate('/drive?tab=my-drive'), variant: 'primary' }]}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* Mini toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <Star size={14} style={{ color: 'var(--amber)' }} fill="var(--amber)" />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
          {files.length} starred item{files.length === 1 ? '' : 's'}
        </span>
        <div style={{ flex: 1 }} />
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {/* Batch bar */}
      {hasSelection && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 16px', background: 'var(--amber-dim)',
          borderBottom: '1px solid var(--border)', fontSize: '0.8125rem',
        }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{selectedIds.size} selected</span>
          <div style={{ flex: 1 }} />
          <MiniButton icon={StarOff} label="Unstar" onClick={() => { void handleBulkUnstar(); }} />
          <MiniButton icon={Trash2} label="Delete" onClick={() => setConfirmDeleteIds(new Set(selectedIds))} danger />
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', padding: '4px 8px',
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {error && (
          <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--error)' }}>{error}</div>
        )}
        {view === 'grid' ? (
          <DriveGrid
            files={files}
            loading={loading}
            selectedFileId={selectedFile?.id ?? null}
            selectedIds={selectedIds}
            hasSelection={hasSelection}
            onItemClick={(f) => setSelectedFile(prev => prev?.id === f.id ? null : f)}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            onRename={handleRename}
            onMove={setMoveTargetId}
            onShare={setShareFile}
            onDelete={(id) => { void handleDelete(id); }}
            onToggleStar={(f) => { void handleUnstar(f); }}
            isMobile={isMobile}
          />
        ) : (
          <DriveList
            files={files}
            loading={loading}
            selectedFileId={selectedFile?.id ?? null}
            selectedIds={selectedIds}
            onItemClick={(f) => setSelectedFile(prev => prev?.id === f.id ? null : f)}
            onItemDoubleClick={handleItemDoubleClick}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleAll}
            onRename={handleRename}
            onMove={setMoveTargetId}
            onShare={setShareFile}
            onDelete={(id) => { void handleDelete(id); }}
            onToggleStar={(f) => { void handleUnstar(f); }}
          />
        )}
      </div>

      {/* Preview */}
      {selectedFile && (
        <DrivePreview
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={(id) => { void handleDelete(id); }}
          isMobile={isMobile}
        />
      )}

      {/* Modals */}
      {shareFile && (
        <ShareModal open={!!shareFile} file={shareFile} onClose={() => setShareFile(null)} />
      )}
      <FolderPicker
        open={moveTargetId !== null}
        currentPath="/drive/"
        onSelect={(p) => { void handleMoveConfirm(p); }}
        onCancel={() => setMoveTargetId(null)}
      />
      <RenameDialog
        open={!!renameTarget}
        currentName={renameTarget?.filename ?? ''}
        title="New name:"
        onConfirm={(name) => { void handleRenameConfirm(name); }}
        onClose={() => setRenameTarget(null)}
      />
      <ConfirmDialog
        open={confirmDeleteIds !== null}
        onClose={() => setConfirmDeleteIds(null)}
        onConfirm={() => { void handleBulkDelete(); }}
        title={`Delete ${confirmDeleteIds?.size ?? 0} item${(confirmDeleteIds?.size ?? 0) === 1 ? '' : 's'}?`}
        description="They will be moved to the trash."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function MiniButton({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
        color: danger ? 'var(--error)' : 'var(--text)',
        fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
