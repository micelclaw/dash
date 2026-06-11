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

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Clock, Flame } from 'lucide-react';
import { FileIcon } from '@/components/shared/FileIcon';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFileSize } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { useFilesQuery } from '../hooks/use-files-query';
import { useDriveShortcuts } from '../hooks/use-drive-shortcuts';
import { DriveInspector } from '../components/inspector/DriveInspector';
import type { FileRecord } from '@/types/files';

/**
 * Recent — two bands: "Hot now" (heat-ranked cards) and "Earlier"
 * (last-accessed list).
 *
 * D5: a single click selects the item and opens the right inspector;
 * double-click jumps to My Drive with ?id= (containing folder + selection).
 */
export function RecentView() {
  const navigate = useNavigate();
  const hot = useFilesQuery({ sort: 'heat', order: 'desc', limit: 12, is_directory: false });
  const earlier = useFilesQuery({ sort: 'last_accessed', order: 'desc', limit: 60, is_directory: false });
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  const hotFiles = useMemo(
    () => hot.files.filter(f => (f.heat_score ?? 0) > 0),
    [hot.files],
  );

  const earlierFiles = useMemo(() => {
    const hotIds = new Set(hotFiles.map(f => f.id));
    return earlier.files.filter(f => !hotIds.has(f.id));
  }, [earlier.files, hotFiles]);

  const openInMyDrive = (file: FileRecord) => {
    navigate(`/drive?tab=my-drive&id=${file.id}`);
  };

  // D5 — click selects (inspector), double-click navigates
  const handleSelect = useCallback((file: FileRecord) => {
    setSelectedFile(prev => prev?.id === file.id ? null : file);
  }, []);

  const refetchAll = useCallback(() => {
    void hot.refetch();
    void earlier.refetch();
  }, [hot.refetch, earlier.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  useDriveShortcuts({
    onEscape: () => { setSelectedFile(null); },
  });

  const loading = hot.loading || earlier.loading;
  const isEmpty = !loading && hotFiles.length === 0 && earlierFiles.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        icon={Clock}
        title="No recent activity"
        description="Files you open, edit or download will show up here, ranked by how hot they are."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* Hot now */}
        {hotFiles.length > 0 && (
          <section style={{ padding: '16px 16px 0' }}>
            <SectionHeader icon={Flame} label="Hot now" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 10,
              }}
            >
              {hotFiles.map(file => (
                <HotCard
                  key={file.id}
                  file={file}
                  selected={selectedFile?.id === file.id}
                  onClick={() => handleSelect(file)}
                  onDoubleClick={() => openInMyDrive(file)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Earlier */}
        <section style={{ padding: '16px 16px 24px' }}>
          <SectionHeader icon={Clock} label="Earlier" />
          {earlierFiles.length === 0 && !loading && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
              Nothing else accessed recently.
            </div>
          )}
          <div>
            {earlierFiles.map(file => (
              <RecentRow
                key={file.id}
                file={file}
                selected={selectedFile?.id === file.id}
                onClick={() => handleSelect(file)}
                onDoubleClick={() => openInMyDrive(file)}
              />
            ))}
          </div>
          {loading && (
            <div style={{ padding: '8px 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              Loading…
            </div>
          )}
        </section>
      </div>

      {/* Inspector (D5) */}
      {selectedFile && (
        <DriveInspector
          files={[selectedFile]}
          onClose={() => setSelectedFile(null)}
          onRefetch={refetchAll}
        />
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Icon size={14} style={{ color: 'var(--mod-drive)' }} />
      <span style={{
        fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)',
      }}>
        {label}
      </span>
    </div>
  );
}

function HotCard({ file, selected, onClick, onDoubleClick }: {
  file: FileRecord;
  selected?: boolean;
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
      title={file.filename}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: selected ? '1px solid var(--mod-drive)' : '1px solid var(--border)',
        background: selected ? 'var(--amber-dim)' : hovered ? 'var(--surface-hover)' : 'var(--surface)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), box-shadow var(--transition-fast)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
        minWidth: 0,
      }}
    >
      <FileIcon mime={file.mime_type} isDirectory={false} size="md" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{
            fontSize: '0.8125rem', color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {file.filename}
          </span>
          <HeatBadge score={file.heat_score ?? 0} />
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>
          {file.last_accessed_at ? formatRelative(new Date(file.last_accessed_at)) : formatRelative(new Date(file.updated_at))}
          {typeof file.access_count === 'number' && file.access_count > 0 && ` · ${file.access_count} opens`}
        </div>
      </div>
    </div>
  );
}

function RecentRow({ file, selected, onClick, onDoubleClick }: {
  file: FileRecord;
  selected?: boolean;
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
        gridTemplateColumns: '1fr 90px 140px',
        gap: 8,
        alignItems: 'center',
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        background: selected ? 'var(--amber-dim)' : hovered ? 'var(--surface-hover)' : 'transparent',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        color: 'var(--text)',
        transition: 'background var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FileIcon mime={file.mime_type} isDirectory={false} size="sm" />
        <span
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          title={file.filename}
        >
          {file.filename}
        </span>
        <HeatBadge score={file.heat_score ?? 0} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {formatFileSize(file.size_bytes)}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {file.last_accessed_at ? formatRelative(new Date(file.last_accessed_at)) : formatRelative(new Date(file.updated_at))}
      </span>
    </div>
  );
}
