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

import { useMemo, useState } from 'react';
import { Trash2, ExternalLink, Square, CheckSquare, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useSearchStore } from '@/stores/search.store';
import { ProvenanceBreakdown } from './ProvenanceBreakdown';
import { getPreviewUrl } from '@/lib/file-utils';
import { resolveEntity } from '@/config/entity-registry';
import { useSearchSelection, toKey } from './use-search-selection';
import { deleteEntity, canDelete } from './delete-entity';
import type { SearchResult } from '@/types/search';

function getTitle(r: SearchResult): string {
  const rec = r.record as Record<string, unknown> | null;
  if (!rec) return r.snippet.slice(0, 60);

  // Photo results: prefer AI description over filename
  if (r.domain === 'photo') {
    const meta = rec.metadata as Record<string, unknown> | undefined;
    const desc = meta?.ai_description as string;
    return desc ? desc.slice(0, 80) : (rec.filename as string) || r.snippet.slice(0, 60);
  }

  // Message results: "Platform #channel: content_preview"
  if (r.domain === 'message') {
    const platform = (rec.platform as string) ?? '';
    const channel = (rec.channel_name as string) ?? '';
    const content = (rec.content as string) ?? r.snippet;
    const prefix = [platform, channel ? `#${channel}` : ''].filter(Boolean).join(' ');
    const preview = content.slice(0, 60);
    return prefix ? `${prefix}: ${preview}` : preview;
  }

  const title = (
    (rec.title as string) ||
    (rec.subject as string) ||
    (rec.display_name as string) ||
    (rec.filename as string) ||
    r.snippet.slice(0, 60)
  );

  // For VFS files, show parent folder path for context
  if (rec.source === 'vfs' && rec.parent_folder) {
    const folder = (rec.parent_folder as string).replace(/^\/vfs/, '');
    return `${title}  ·  ${folder}`;
  }

  return title;
}

/** Resolve the best file ID for preview URLs — prefer record.id (matches photos module) over record_id */
function getFileId(r: SearchResult): string {
  const rec = r.record as Record<string, unknown> | null;
  return (rec?.id as string) || r.record_id;
}

/** Check if a photo result has enough data for a preview to succeed */
function canPreview(r: SearchResult): boolean {
  const rec = r.record as Record<string, unknown> | null;
  if (!rec) return false;
  // Must have filepath on disk and image mime type
  if (!rec.filepath) return false;
  const mime = rec.mime_type as string | undefined;
  if (!mime || !mime.startsWith('image/')) return false;
  return true;
}

function PhotoThumb({ fileId }: { fileId: string }) {
  const [err, setErr] = useState(false);
  if (err) return <ImageIcon size={16} style={{ color: 'var(--mod-photos)', flexShrink: 0 }} />;
  return (
    <img
      src={getPreviewUrl(fileId, 64)}
      alt=""
      onError={() => setErr(true)}
      style={{
        width: 32, height: 32, objectFit: 'cover',
        borderRadius: 'var(--radius-sm)', flexShrink: 0,
      }}
    />
  );
}

export function SearchResultsList() {
  const navigate = useNavigate();
  const rawResults = useSearchStore(s => s.results);
  const sortBy = useSearchStore(s => s.sortBy);
  const selectedResult = useSearchStore(s => s.selectedResult);
  const setSelectedResult = useSearchStore(s => s.setSelectedResult);
  const removeResults = useSearchStore(s => s.removeResults);
  const loading = useSearchStore(s => s.loading);
  const total = useSearchStore(s => s.total);
  const queryTimeMs = useSearchStore(s => s.queryTimeMs);
  const searchType = useSearchStore(s => s.searchType);

  const results = useMemo(() => {
    if (sortBy === 'relevance' || !rawResults.length) return rawResults;

    // Sort by last modified date
    if (sortBy === 'recent') {
      return [...rawResults].sort((a, b) => {
        const recA = a.record as Record<string, unknown> | null;
        const recB = b.record as Record<string, unknown> | null;
        const dateA = (recA?.updated_at as string) || (recA?.created_at as string) || '';
        const dateB = (recB?.updated_at as string) || (recB?.created_at as string) || '';
        return dateB.localeCompare(dateA);
      });
    }

    // Sort by signal score
    const keyMap: Record<string, string> = {
      fulltext: 'fulltext_score',
      heat: 'heat_score',
      semantic: 'vector_score',
      graph: 'graph_score',
    };
    const scoreKey = keyMap[sortBy];
    if (!scoreKey) return rawResults;
    return [...rawResults].sort((a, b) =>
      ((b.provenance as any)?.[scoreKey] ?? 0) - ((a.provenance as any)?.[scoreKey] ?? 0)
    );
  }, [rawResults, sortBy]);

  const { checkedIds, toggleCheck, clearSelection, isChecked } = useSearchSelection(results);

  const [confirmDelete, setConfirmDelete] = useState<{
    targets: SearchResult[];
    label: string;
  } | null>(null);

  function getContextItems(r: SearchResult): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const res = resolveEntity(r.domain, r.record_id, r.record);
    const link = res.route;

    items.push({
      label: `Open ${res.label}`,
      icon: ExternalLink,
      onClick: () => { if (link) navigate(link); },
      disabled: !link,
    });

    const key = toKey(r);
    const isPartOfSelection = checkedIds.has(key) && checkedIds.size > 1;

    if (isPartOfSelection) {
      const targets = results.filter(res => checkedIds.has(toKey(res)));
      const deletableCount = targets.filter(t => canDelete(t.domain)).length;
      items.push({ label: '', onClick: () => {}, separator: true });
      items.push({
        label: `Delete ${deletableCount} selected`,
        icon: Trash2,
        variant: 'danger',
        disabled: deletableCount === 0,
        onClick: () => setConfirmDelete({
          targets,
          label: `${deletableCount} item${deletableCount !== 1 ? 's' : ''}`,
        }),
      });
    } else {
      items.push({ label: '', onClick: () => {}, separator: true });
      items.push({
        label: 'Delete',
        icon: Trash2,
        variant: 'danger',
        disabled: !canDelete(r.domain),
        onClick: () => setConfirmDelete({ targets: [r], label: getTitle(r) }),
      });
    }

    return items;
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const { targets } = confirmDelete;
    const deletable = targets.filter(t => canDelete(t.domain));
    const skipped = targets.length - deletable.length;

    const settled = await Promise.allSettled(
      deletable.map(t => deleteEntity(t.domain, t.record_id))
    );

    const succeeded = settled.filter(r => r.status === 'fulfilled').length;
    const failed = settled.filter(r => r.status === 'rejected').length;

    const keysToRemove = new Set<string>();
    deletable.forEach((t, i) => {
      if (settled[i]!.status === 'fulfilled') keysToRemove.add(toKey(t));
    });
    if (keysToRemove.size > 0) removeResults(keysToRemove);
    clearSelection();

    if (failed === 0 && skipped === 0) {
      toast.success(`Deleted ${succeeded} item${succeeded !== 1 ? 's' : ''}`);
    } else {
      if (failed > 0) toast.error(`${failed} deletion${failed !== 1 ? 's' : ''} failed`);
      if (skipped > 0) toast(`${skipped} item${skipped !== 1 ? 's' : ''} skipped (not deletable)`);
    }

    setConfirmDelete(null);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            height: 48, background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div>
      {/* Meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.6875rem', color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)', padding: '4px 0 8px',
      }}>
        <span>{total} result{total !== 1 ? 's' : ''}</span>
        {queryTimeMs != null && <span>in {queryTimeMs}ms</span>}
        {searchType && <span style={{ fontFamily: 'var(--font-mono)' }}>({searchType})</span>}
      </div>

      {/* Bulk actions bar */}
      {checkedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', marginBottom: 4,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
        }}>
          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
            {checkedIds.size} selected
          </span>
          <button
            onClick={() => {
              const targets = results.filter(r => checkedIds.has(toKey(r)));
              const deletableCount = targets.filter(t => canDelete(t.domain)).length;
              if (deletableCount === 0) return;
              setConfirmDelete({
                targets,
                label: `${deletableCount} item${deletableCount !== 1 ? 's' : ''}`,
              });
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px',
              background: 'transparent',
              border: '1px solid var(--error)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--error)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={12} />
            Delete selected
          </button>
          <button
            onClick={clearSelection}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px',
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            <X size={12} />
            Clear
          </button>
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {results.map((r, i) => {
          const res = resolveEntity(r.domain, r.record_id, r.record);
          const Icon = res.Icon;
          const isSelected = selectedResult?.record_id === r.record_id && selectedResult?.domain === r.domain;
          const heatScore = r.provenance?.heat_score ?? (r.record as Record<string, unknown> | null)?.heat_score as number ?? 0;
          const checked = isChecked(r);

          return (
            <ContextMenu
              key={`${r.domain}-${r.record_id}-${i}`}
              trigger={
                <div>
                  <button
                    onClick={() => setSelectedResult(isSelected ? null : r)}
                    onDoubleClick={() => { if (res.route) navigate(res.route); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      background: isSelected ? 'var(--surface-hover)' : checked ? 'rgba(212,160,23,0.06)' : 'transparent',
                      border: isSelected
                        ? '1px solid var(--amber)'
                        : checked
                          ? '1px solid rgba(212,160,23,0.3)'
                          : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e => { if (!isSelected && !checked) e.currentTarget.style.background = 'var(--surface)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = checked ? 'rgba(212,160,23,0.06)' : 'transparent'; }}
                  >
                    {/* Checkbox */}
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleCheck(r, e.shiftKey); }}
                      style={{
                        flexShrink: 0,
                        cursor: 'pointer',
                        color: checked ? 'var(--amber)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                    </span>

                    {r.domain === 'photo' && canPreview(r)
                      ? <PhotoThumb fileId={getFileId(r)} />
                      : <Icon size={16} style={{ color: res.color, flexShrink: 0 }} />
                    }
                    <span style={{
                      flex: 1, fontSize: '0.8125rem', color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {getTitle(r)}
                    </span>
                    <HeatBadge score={heatScore} />
                    <span style={{
                      fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)', flexShrink: 0,
                    }}>
                      {r.score.toFixed(4)}
                    </span>
                  </button>

                  {/* Provenance breakdown when selected */}
                  {isSelected && (
                    <div style={{
                      padding: '8px 10px 12px 34px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      {/* Photo preview + snippet side by side */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                        {r.domain === 'photo' && canPreview(r) && (
                          <img
                            src={getPreviewUrl(getFileId(r), 160)}
                            alt=""
                            style={{
                              width: 80, height: 80, objectFit: 'cover',
                              borderRadius: 'var(--radius-sm)', flexShrink: 0,
                            }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <div style={{
                          fontSize: '0.75rem', color: 'var(--text-dim)',
                          lineHeight: 1.4, flex: 1,
                        }}>
                          {r.snippet}
                        </div>
                      </div>
                      <ProvenanceBreakdown result={r} />
                      <button
                        onClick={() => { if (res.route) navigate(res.route); }}
                        disabled={!res.route}
                        style={{
                          marginTop: 8,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: res.route ? 'var(--amber)' : 'var(--text-muted)',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-sans)',
                          cursor: res.route ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Open {res.label}
                      </button>
                    </div>
                  )}
                </div>
              }
              items={getContextItems(r)}
            />
          );
        })}
      </div>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={confirmDelete?.targets.length === 1 ? 'Delete item?' : `Delete ${confirmDelete?.targets.length} items?`}
        description={
          confirmDelete?.targets.length === 1
            ? `"${confirmDelete.label}" will be permanently deleted.`
            : `This will permanently delete ${confirmDelete?.label}. This cannot be undone.`
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
