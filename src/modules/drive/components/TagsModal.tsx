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

import { useState, useEffect, useMemo } from 'react';
import { X, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { TagInput } from '@/components/shared/TagInput';
import type { FileRecord } from '@/types/files';

interface TagsModalProps {
  open: boolean;
  /** Single file → edit its tags directly (PATCH). Multi → edits the COMMON
   *  tags; additions/removals are applied to every file via /files/bulk. */
  files: FileRecord[];
  onClose: () => void;
  /** Called after save so the view can refetch. */
  onSaved?: () => void;
}

/** Tags shared by every file in the selection. */
function commonTags(files: FileRecord[]): string[] {
  if (files.length === 0) return [];
  let acc = new Set(files[0]!.tags ?? []);
  for (const f of files.slice(1)) {
    const own = new Set(f.tags ?? []);
    acc = new Set([...acc].filter(t => own.has(t)));
  }
  return [...acc];
}

/**
 * Lightweight tags editor (D4) built on the shared TagInput. Single file =
 * full tag list; multi-select = shared tags, applying the delta with
 * POST /files/bulk {action: tag|untag}.
 */
export function TagsModal({ open, files, onClose, onSaved }: TagsModalProps) {
  const initial = useMemo(() => commonTags(files), [files]);
  const [tags, setTags] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setTags(initial);
  }, [open, initial]);

  if (!open || files.length === 0) return null;

  const isMulti = files.length > 1;
  const title = isMulti ? `Tags for ${files.length} items` : `Tags: ${files[0]!.filename}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!isMulti) {
        await api.patch(`/files/${files[0]!.id}`, { tags });
      } else {
        const ids = files.map(f => f.id);
        const before = new Set(initial);
        const after = new Set(tags);
        const added = [...after].filter(t => !before.has(t));
        const removed = [...before].filter(t => !after.has(t));
        if (added.length > 0) {
          await api.post('/files/bulk', { action: 'tag', ids, params: { tags: added } });
        }
        if (removed.length > 0) {
          await api.post('/files/bulk', { action: 'untag', ids, params: { tags: removed } });
        }
      }
      toast.success('Tags updated');
      onSaved?.();
      onClose();
    } catch {
      toast.error('Could not update tags');
    }
    setSaving(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 400, maxWidth: '90vw',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <Tags size={15} style={{ flexShrink: 0, color: 'var(--mod-drive)' }} />
            {title}
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 2, flexShrink: 0, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {isMulti && (
            <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Showing tags shared by all {files.length} items. Added tags are applied
              to every item; removed tags are removed from every item.
            </p>
          )}
          <TagInput tags={tags} onChange={setTags} addLabel="tag" />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            style={{
              padding: '6px 14px',
              background: saving ? 'var(--surface)' : 'var(--amber)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: saving ? 'var(--text-muted)' : '#000',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
