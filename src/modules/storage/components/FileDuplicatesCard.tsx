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
import { Copy, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { formatFileSize } from '@/lib/file-utils';

interface DuplicateFile {
  id: string;
  filename: string;
  filepath: string;
  size_bytes: number;
  updated_at: string;
}

interface DuplicateGroup {
  checksum: string;
  size_bytes: number;
  files: DuplicateFile[];
}

export function FileDuplicatesCard() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: DuplicateGroup[] }>('/files/duplicates?limit=20');
      setGroups(res.data ?? []);
    } catch {
      // optional
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (fileId: string) => {
    setDeleting(fileId);
    try {
      await api.delete(`/files/${fileId}`);
      toast.success('File deleted');
      setGroups(prev => prev.map(g => ({
        ...g,
        files: g.files.filter(f => f.id !== fileId),
      })).filter(g => g.files.length > 1));
    } catch {
      toast.error('Failed to delete file');
    }
    setDeleting(null);
  };

  if (loading) return null;
  if (groups.length === 0) return null;

  const totalWaste = groups.reduce((sum, g) => sum + g.size_bytes * (g.files.length - 1), 0);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
          <Copy size={14} />
          Duplicate Files
          <span className="text-xs font-normal text-amber-400">
            {formatFileSize(totalWaste)} recoverable
          </span>
        </h3>
        <button onClick={load} className="p-1.5 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)]">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {groups.map(group => (
          <div key={group.checksum} className="rounded border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="text-[10px] text-[var(--text-muted)] mb-2">
              {group.files.length} copies · {formatFileSize(group.size_bytes)} each
            </div>
            <div className="space-y-1">
              {group.files.map((file, i) => (
                <div key={file.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate text-[var(--text)]" title={file.filepath}>
                    {file.filepath}
                  </span>
                  {i > 0 && (
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={deleting === file.id}
                      className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 flex-shrink-0"
                      title="Delete this copy"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
