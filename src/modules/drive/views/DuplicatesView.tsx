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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { FileIcon } from '@/components/shared/FileIcon';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatFileSize } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { api } from '@/services/api';
import type { ApiListResponse } from '@/types/api';

interface DupFile {
  id: string;
  filename: string;
  parent_folder: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

interface DupGroup {
  checksum_sha256: string;
  file_count: number;
  total_bytes: number;
  files: DupFile[];
}

/**
 * Duplicates — GET /files/duplicates grouped by checksum. "Keep this" deletes
 * the rest of the group (soft delete → they land in Trash) via POST /files/bulk.
 */
export function DuplicatesView() {
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmKeep, setConfirmKeep] = useState<{ keep: DupFile; others: DupFile[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<DupGroup>>('/files/duplicates', { limit: 50 });
      setGroups(res.data);
    } catch {
      setError('Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  // Recoverable = total bytes minus one kept copy per group.
  const recoverableBytes = useMemo(
    () => groups.reduce((acc, g) => {
      const oneCopy = g.files[0]?.size_bytes ?? Math.round(Number(g.total_bytes) / g.file_count);
      return acc + Math.max(0, Number(g.total_bytes) - oneCopy);
    }, 0),
    [groups],
  );

  const handleKeepConfirmed = useCallback(async () => {
    const target = confirmKeep;
    setConfirmKeep(null);
    if (!target) return;
    setBusy(true);
    try {
      const ids = target.others.map(f => f.id);
      await api.post('/files/bulk', { action: 'delete', ids });
      toast.success(`${ids.length} cop${ids.length === 1 ? 'y' : 'ies'} moved to trash`);
      await fetchGroups();
    } catch {
      toast.error('Could not delete the other copies');
    } finally {
      setBusy(false);
    }
  }, [confirmKeep, fetchGroups]);

  if (!loading && groups.length === 0) {
    return (
      <EmptyState
        icon={Copy}
        title="No duplicates found"
        description="Files with identical content (same checksum) would be grouped here so you can reclaim space."
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
      }}>
        <Copy size={14} style={{ color: 'var(--mod-drive)' }} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
          {groups.length} duplicate group{groups.length === 1 ? '' : 's'}
        </span>
        {recoverableBytes > 0 && (
          <span style={{
            fontSize: '0.75rem', color: 'var(--warning)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
          }}>
            {formatFileSize(recoverableBytes)} recoverable
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--error)' }}>{error}</div>
      )}
      {loading && (
        <div style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
      )}

      {/* Groups */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(group => (
          <div
            key={group.checksum_sha256}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            {/* Group header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderBottom: '1px solid var(--border)',
            }}>
              <FileIcon mime={group.files[0]?.mime_type ?? ''} isDirectory={false} size="sm" />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                {group.files[0]?.filename ?? 'Duplicate group'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {group.file_count} copies · {formatFileSize(group.files[0]?.size_bytes ?? 0)} each
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                {group.checksum_sha256.slice(0, 12)}…
              </span>
            </div>

            {/* Copies */}
            {group.files.map(file => (
              <DupRow
                key={file.id}
                file={file}
                disabled={busy}
                onKeep={() => setConfirmKeep({
                  keep: file,
                  others: group.files.filter(f => f.id !== file.id),
                })}
              />
            ))}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmKeep !== null}
        onClose={() => setConfirmKeep(null)}
        onConfirm={() => { void handleKeepConfirmed(); }}
        title={`Keep "${confirmKeep?.keep.filename ?? ''}" and delete ${confirmKeep?.others.length ?? 0} other cop${(confirmKeep?.others.length ?? 0) === 1 ? 'y' : 'ies'}?`}
        description={`The other copies are moved to the trash (${confirmKeep ? confirmKeep.others.map(f => f.parent_folder + f.filename).join(', ') : ''}).`}
        confirmLabel="Keep this one"
        variant="warning"
      />
    </div>
  );
}

function DupRow({ file, onKeep, disabled }: { file: DupFile; onKeep: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 140px 120px',
        gap: 8,
        alignItems: 'center',
        padding: '6px 12px',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        fontSize: '0.8125rem',
        color: 'var(--text)',
        transition: 'background var(--transition-fast)',
      }}
    >
      <span
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-dim)', fontSize: '0.75rem' }}
        title={`${file.parent_folder}${file.filename}`}
      >
        {file.parent_folder}{file.filename}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        {formatRelative(new Date(file.created_at))}
      </span>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onKeep}
          disabled={disabled}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            color: disabled ? 'var(--text-muted)' : 'var(--success)',
            fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCircle2 size={12} />
          Keep this
        </button>
      </div>
    </div>
  );
}
