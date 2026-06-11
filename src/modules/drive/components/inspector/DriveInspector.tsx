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

import { useMemo } from 'react';
import {
  X, PanelRightClose, PanelRightOpen, Info, Star, Tags, FolderInput, Trash2,
  Files as FilesIcon,
} from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { FileIcon } from '@/components/shared/FileIcon';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatFileSize, getMimeLabel } from '@/lib/file-utils';
import { useDriveStore, type DriveInspectorTab } from '@/stores/drive.store';
import { DetailsTab } from './DetailsTab';
import { ActivityTab } from './ActivityTab';
import { VersionsTab } from './VersionsTab';
import type { FileRecord } from '@/types/files';

export interface InspectorBulkActions {
  onStar?: (files: FileRecord[], starred: boolean) => void;
  onTags?: (files: FileRecord[]) => void;
  onMove?: (files: FileRecord[]) => void;
  onDelete?: (files: FileRecord[]) => void;
}

interface DriveInspectorProps {
  /** Current selection (1..n). The hosting view renders nothing when empty. */
  files: FileRecord[];
  /** Close = clear the selection in the hosting view. */
  onClose: () => void;
  /** Refetch the hosting view's file list after a mutation. */
  onRefetch: () => void;
  /** Single-file delete (used by the Details quick action). */
  onDeleteFile?: (file: FileRecord) => void;
  /** Single-file star toggle. */
  onToggleStar?: (file: FileRecord, starred: boolean) => void;
  /** Bulk quick actions for the multi-select summary. */
  bulk?: InspectorBulkActions;
}

const PANEL_WIDTH = 360;

/**
 * Drive inspector (D5) — right-hand panel with Details | Activity | Versions
 * for a single selection, or an aggregate summary for a multi-selection.
 *
 * Open/collapsed state + active tab live in `useDriveStore` (persisted).
 * Collapsed with a selection → slim rail with a reopen button.
 * Below 1024px the panel renders as a fixed overlay sheet.
 */
export function DriveInspector({ files, onClose, onRefetch, onDeleteFile, onToggleStar, bulk }: DriveInspectorProps) {
  const inspectorOpen = useDriveStore(s => s.inspectorOpen);
  const setInspectorOpen = useDriveStore(s => s.setInspectorOpen);
  const inspectorTab = useDriveStore(s => s.inspectorTab);
  const setInspectorTab = useDriveStore(s => s.setInspectorTab);
  const isOverlay = useMediaQuery('(max-width: 1023px)');

  const single = files.length === 1 ? files[0]! : null;

  const tabs = useMemo(() => {
    if (!single) return [];
    const base = [
      { id: 'details', label: 'Details' },
      { id: 'activity', label: 'Activity' },
    ];
    if (!single.is_directory) base.push({ id: 'versions', label: 'Versions' });
    return base;
  }, [single]);

  // A folder can't show Versions — clamp the persisted tab.
  const effectiveTab: DriveInspectorTab =
    single?.is_directory && inspectorTab === 'versions' ? 'details' : inspectorTab;

  if (files.length === 0) return null;

  // Collapsed → slim rail so the user can reopen (persisted preference).
  if (!inspectorOpen) {
    if (isOverlay) return null;
    return (
      <div
        data-testid="drive-inspector-rail"
        style={{
          width: 34, flexShrink: 0, borderLeft: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', paddingTop: 8, gap: 8,
        }}
      >
        <button
          onClick={() => setInspectorOpen(true)}
          title="Open inspector"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--mod-drive)', padding: 4, display: 'flex',
          }}
        >
          <PanelRightOpen size={16} />
        </button>
        <Info size={14} style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  const panel = (
    <div
      data-testid="drive-inspector"
      style={{
        width: isOverlay ? 'min(360px, 92vw)' : PANEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        fontFamily: 'var(--font-sans)',
        ...(isOverlay ? {
          position: 'fixed' as const,
          top: 0, right: 0, bottom: 0,
          zIndex: 45,
          boxShadow: 'var(--shadow-lg)',
        } : {}),
      }}
    >
      {/* Header: tabs (single) or summary title (multi) + collapse/close */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        borderBottom: single ? 'none' : '1px solid var(--border)',
        padding: single ? '0 6px 0 8px' : '10px 12px',
        flexShrink: 0,
      }}>
        {single ? (
          <div
            style={{
              flex: 1, minWidth: 0, overflowX: 'auto',
              // Shared Tabs underline picks up the Drive identity color.
              ['--amber' as string]: 'var(--mod-drive)',
            } as React.CSSProperties}
          >
            <Tabs
              tabs={tabs}
              activeTab={effectiveTab}
              onChange={(id) => setInspectorTab(id as DriveInspectorTab)}
              variant="underline"
            />
          </div>
        ) : (
          <div style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)',
          }}>
            <FilesIcon size={14} style={{ color: 'var(--mod-drive)' }} />
            {files.length} items selected
          </div>
        )}
        <button
          onClick={() => setInspectorOpen(false)}
          title="Collapse inspector"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0,
          }}
        >
          <PanelRightClose size={15} />
        </button>
        <button
          onClick={onClose}
          title="Close (clear selection)"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0,
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {single ? (
          <>
            {effectiveTab === 'details' && (
              <DetailsTab
                file={single}
                onRefetch={onRefetch}
                onDelete={onDeleteFile ? (f) => onDeleteFile(f) : undefined}
                onToggleStar={onToggleStar}
              />
            )}
            {effectiveTab === 'activity' && <ActivityTab fileId={single.id} />}
            {effectiveTab === 'versions' && !single.is_directory && <VersionsTab file={single} />}
          </>
        ) : (
          <MultiSummary files={files} bulk={bulk} />
        )}
      </div>
    </div>
  );

  if (isOverlay) {
    return (
      <>
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'rgba(0,0,0,0.4)' }}
        />
        {panel}
      </>
    );
  }
  return panel;
}

// ─── Multi-select aggregate summary ────────────────────────

function MultiSummary({ files, bulk }: { files: FileRecord[]; bulk?: InspectorBulkActions }) {
  const totalSize = files.reduce((acc, f) => acc + (f.is_directory ? 0 : f.size_bytes), 0);
  const folders = files.filter(f => f.is_directory).length;
  const allStarred = files.length > 0 && files.every(f => f.starred);

  const typeCounts = useMemo(() => {
    const map = new Map<string, { count: number; sample: FileRecord }>();
    for (const f of files) {
      const label = f.is_directory ? 'Folder' : getMimeLabel(f.mime_type);
      const entry = map.get(label);
      if (entry) entry.count += 1;
      else map.set(label, { count: 1, sample: f });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [files]);

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Aggregates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
        <SummaryRow label="Items" value={`${files.length}${folders > 0 ? ` (${folders} folder${folders === 1 ? '' : 's'})` : ''}`} />
        <SummaryRow label="Total size" value={formatFileSize(totalSize)} />
      </div>

      {/* Types breakdown */}
      <div>
        <div style={{
          fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6,
        }}>
          Types
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {typeCounts.map(([label, { count, sample }]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
              background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
            }}>
              <FileIcon mime={sample.mime_type} isDirectory={sample.is_directory} size="sm" />
              <span style={{ flex: 1, color: 'var(--text)' }}>{label}</span>
              <span style={{ color: 'var(--text-muted)' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk quick actions */}
      {bulk && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {bulk.onStar && (
            <QuickBtn
              icon={Star}
              label={allStarred ? 'Unstar' : 'Star'}
              onClick={() => bulk.onStar!(files, !allStarred)}
            />
          )}
          {bulk.onTags && <QuickBtn icon={Tags} label="Tags" onClick={() => bulk.onTags!(files)} />}
          {bulk.onMove && <QuickBtn icon={FolderInput} label="Move" onClick={() => bulk.onMove!(files)} />}
          {bulk.onDelete && (
            <QuickBtn icon={Trash2} label="Delete" variant="danger" onClick={() => bulk.onDelete!(files)} />
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 92, flexShrink: 0, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function QuickBtn({ icon: Icon, label, onClick, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: variant === 'danger' ? 'var(--error)' : 'var(--text-dim)',
        fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
