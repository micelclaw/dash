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

import { useState, useEffect, useCallback } from 'react';
import { History, Download, RotateCcw, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { formatFileSize } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';

interface Snapshot {
  id: string;
  file_id: string;
  version_number: number;
  size_bytes: number;
  note: string | null;
  created_at: string;
}

interface VersionsResponse {
  snapshots: Snapshot[];
  current_version: number;
  current_size: number;
  total_snapshot_size: number;
}

interface FileVersionHistoryProps {
  fileId: string;
  filename: string;
  /** Start expanded (e.g. when hosted inside a dedicated dialog). */
  defaultExpanded?: boolean;
}

export function FileVersionHistory({ fileId, filename, defaultExpanded = false }: FileVersionHistoryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [data, setData] = useState<VersionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // envelopeList shape: snapshots in `data`, counters in `meta`
      const res = await api.get<{
        data: Snapshot[];
        meta: { current_version: number; current_size_bytes: number; total_snapshot_size_bytes: number };
      }>(`/files/${fileId}/versions`);
      setData({
        snapshots: res.data ?? [],
        current_version: res.meta?.current_version ?? 1,
        current_size: res.meta?.current_size_bytes ?? 0,
        total_snapshot_size: res.meta?.total_snapshot_size_bytes ?? 0,
      });
    } catch {
      // versions endpoint may not be available
    }
    setLoading(false);
  }, [fileId]);

  useEffect(() => {
    if (expanded && !data) load();
  }, [expanded, data, load]);

  const createSnapshot = async () => {
    setActing('create');
    try {
      await api.post(`/files/${fileId}/versions`);
      toast.success('Snapshot created');
      load();
    } catch {
      toast.error('Failed to create snapshot');
    }
    setActing(null);
  };

  const restoreSnapshot = async (snapshotId: string) => {
    setActing(snapshotId);
    try {
      await api.post(`/files/${fileId}/versions/${snapshotId}/restore`);
      toast.success('Version restored');
      load();
    } catch {
      toast.error('Failed to restore version');
    }
    setActing(null);
  };

  const deleteSnapshot = async (snapshotId: string) => {
    setActing(snapshotId);
    try {
      await api.delete(`/files/${fileId}/versions/${snapshotId}`);
      toast.success('Snapshot deleted');
      load();
    } catch {
      toast.error('Failed to delete snapshot');
    }
    setActing(null);
  };

  const downloadSnapshot = (snapshotId: string) => {
    const url = `/api/files/${fileId}/versions/${snapshotId}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.6875rem',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <History size={12} />
        Version History
        {data && data.snapshots.length > 0 && (
          <span style={{
            marginLeft: 4, padding: '1px 6px', fontSize: '0.625rem',
            background: 'var(--surface-hover)', borderRadius: 'var(--radius-full)',
            color: 'var(--text-dim)',
          }}>
            {data.snapshots.length}
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 12px' }}>
          {loading ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>Loading...</div>
          ) : !data || data.snapshots.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No snapshots yet</span>
              <button
                onClick={createSnapshot}
                disabled={acting === 'create'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                  background: 'var(--amber)', color: '#06060a', border: 'none',
                  borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <Plus size={10} /> Create Snapshot
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {data.snapshots.length} version{data.snapshots.length > 1 ? 's' : ''} · {formatFileSize(data.total_snapshot_size)}
                </span>
                <button
                  onClick={createSnapshot}
                  disabled={acting === 'create'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                    background: 'var(--surface-hover)', color: 'var(--text-dim)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Plus size={10} /> Snapshot
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.snapshots.map(snap => (
                  <div key={snap.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 500 }}>
                        v{snap.version_number}
                        {snap.note && <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-dim)' }}>{snap.note}</span>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
                        {formatRelative(new Date(snap.created_at))} · {formatFileSize(snap.size_bytes)}
                      </div>
                    </div>
                    <button onClick={() => downloadSnapshot(snap.id)} title="Download" disabled={acting === snap.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex' }}>
                      <Download size={12} />
                    </button>
                    <button onClick={() => restoreSnapshot(snap.id)} title="Restore" disabled={acting === snap.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex' }}>
                      <RotateCcw size={12} />
                    </button>
                    <button onClick={() => deleteSnapshot(snap.id)} title="Delete" disabled={acting === snap.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
