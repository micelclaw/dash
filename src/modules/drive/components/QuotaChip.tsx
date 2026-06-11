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

import { useState, useEffect } from 'react';
import { HardDrive, Copy } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { api } from '@/services/api';
import { formatFileSize, getMimeLabel } from '@/lib/file-utils';
import type { ApiResponse } from '@/types/api';

interface MimeBucket {
  mime_type: string;
  count: number;
  total_bytes: number;
}

interface FileStats {
  total_files: number;
  total_directories: number;
  total_size_bytes: number;
  mime_distribution: MimeBucket[];
  folder_distribution: { parent_folder: string; count: number; total_bytes: number }[];
  largest_files: { id: string; filename: string; mime_type: string; size_bytes: number; parent_folder: string }[];
  duplicates: { groups: number; files: number; wasted_bytes: number };
}

/**
 * Compact storage-usage chip for the Drive shell header. Click opens a
 * popover with a per-type breakdown (GET /files/stats).
 */
export function QuotaChip() {
  const [stats, setStats] = useState<FileStats | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.get<ApiResponse<FileStats>>('/files/stats')
      .then(res => { if (!cancelled) setStats(res.data); })
      .catch(() => { /* chip simply stays hidden */ });
    return () => { cancelled = true; };
  }, []);

  if (!stats) return null;

  const topMimes = [...(stats.mime_distribution ?? [])]
    .sort((a, b) => Number(b.total_bytes) - Number(a.total_bytes))
    .slice(0, 6);
  const maxBytes = Math.max(...topMimes.map(m => Number(m.total_bytes)), 1);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Storage usage"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            marginBottom: 6,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-full)',
            background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'background var(--transition-fast)',
          }}
        >
          <HardDrive size={12} style={{ color: 'var(--mod-drive)' }} />
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>
            {formatFileSize(Number(stats.total_size_bytes))}
          </span>
          used
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" style={{ width: '18rem' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
              {formatFileSize(Number(stats.total_size_bytes))}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {stats.total_files} files · {stats.total_directories} folders
            </span>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

          <div style={{
            fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6,
          }}>
            By type
          </div>
          {topMimes.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>No files yet</div>
          )}
          {topMimes.map(m => (
            <div key={m.mime_type} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text)' }}>{getMimeLabel(m.mime_type)}</span>
                <span style={{ color: 'var(--text-dim)' }}>
                  {formatFileSize(Number(m.total_bytes))} · {m.count}
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2, marginTop: 2 }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(2, (Number(m.total_bytes) / maxBytes) * 100)}%`,
                  background: 'var(--mod-drive)',
                  borderRadius: 2,
                }} />
              </div>
            </div>
          ))}

          {stats.duplicates && stats.duplicates.groups > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <Copy size={12} style={{ color: 'var(--warning)' }} />
                {formatFileSize(Number(stats.duplicates.wasted_bytes))} wasted in {stats.duplicates.groups} duplicate group{stats.duplicates.groups === 1 ? '' : 's'}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
