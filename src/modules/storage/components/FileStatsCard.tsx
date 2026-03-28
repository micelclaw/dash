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
import { Files, HardDrive, Camera } from 'lucide-react';
import { api } from '@/services/api';
import { formatFileSize } from '@/lib/file-utils';

interface FileStats {
  total_files: number;
  total_directories: number;
  total_size: number;
  mime_distribution: Record<string, number>;
  duplicates_count?: number;
}

interface SnapshotStats {
  count: number;
  files_with_snapshots: number;
  total_snapshot_size: number;
}

export function FileStatsCard() {
  const [stats, setStats] = useState<FileStats | null>(null);
  const [snapStats, setSnapStats] = useState<SnapshotStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [fileRes, snapRes] = await Promise.all([
          api.get<{ data: FileStats }>('/files/stats'),
          api.get<{ data: SnapshotStats }>('/files/snapshots/stats'),
        ]);
        setStats(fileRes.data);
        setSnapStats(snapRes.data);
      } catch {
        // optional endpoints
      }
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) return null;

  const topMimes = Object.entries(stats.mime_distribution ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
        <Files size={14} />
        File Statistics
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatItem label="Files" value={stats.total_files.toLocaleString()} />
        <StatItem label="Directories" value={stats.total_directories.toLocaleString()} />
        <StatItem label="Total Size" value={formatFileSize(stats.total_size)} />
        {stats.duplicates_count != null && stats.duplicates_count > 0 && (
          <StatItem label="Duplicates" value={stats.duplicates_count.toLocaleString()} warn />
        )}
      </div>

      {snapStats && snapStats.count > 0 && (
        <div className="flex items-center gap-4 mb-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Camera size={12} />
            <span className="font-medium text-[var(--text)]">{snapStats.count}</span> snapshots
          </span>
          <span>
            <span className="font-medium text-[var(--text)]">{snapStats.files_with_snapshots}</span> files versioned
          </span>
          <span>
            <span className="font-medium text-[var(--text)]">{formatFileSize(snapStats.total_snapshot_size)}</span> used
          </span>
        </div>
      )}

      {topMimes.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Top file types
          </div>
          <div className="flex flex-wrap gap-2">
            {topMimes.map(([mime, count]) => (
              <span key={mime} className="px-2 py-0.5 text-[10px] rounded bg-[var(--surface-hover)] text-[var(--text-dim)]">
                {mime.split('/').pop()} <span className="text-[var(--text-muted)]">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className={`text-base font-semibold ${warn ? 'text-amber-400' : 'text-[var(--text)]'}`}>{value}</div>
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</div>
    </div>
  );
}
