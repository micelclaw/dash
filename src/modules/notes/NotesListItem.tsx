import { useState, useEffect, useRef } from 'react';
import { Pin, Archive, Trash, Share2, Link2 } from 'lucide-react';
import { SourceBadge } from '@/components/shared/SourceBadge';
import { Tag } from '@/components/shared/Tag';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { EntityShareModal } from '@/components/shared/EntityShareModal';
import { RelateModal } from '@/components/shared/RelateModal';
import { timeAgo } from '@/lib/time';
import { getPreview } from '@/lib/text';
import type { Note } from '@/types/notes';

interface NotesListItemProps {
  note: Note;
  selected: boolean;
  onClick: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function NotesListItem({ note, selected, onClick, onPin, onArchive, onDelete }: NotesListItemProps) {
  const [highlight, setHighlight] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [relateOpen, setRelateOpen] = useState(false);
  const prevUpdatedAt = useRef(note.updated_at);

  // Amber flash on external WS update
  useEffect(() => {
    if (note.updated_at !== prevUpdatedAt.current) {
      setHighlight(true);
      prevUpdatedAt.current = note.updated_at;
      const timer = setTimeout(() => setHighlight(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [note.updated_at]);

  const preview = getPreview(note.content, note.content_format);
  const visibleTags = note.tags.slice(0, 2);
  const extraTags = note.tags.length - 2;

  return (
    <>
    <ContextMenu
      trigger={
        <div
          onClick={onClick}
          style={{
            padding: '10px 12px',
            cursor: 'pointer',
            borderLeft: selected ? '2px solid var(--amber)' : '2px solid transparent',
            background: highlight ? 'var(--amber-dim)' : selected ? 'var(--surface-hover)' : 'transparent',
            transition: 'background 300ms ease, border-color var(--transition-fast)',
          }}
          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { if (!selected && !highlight) e.currentTarget.style.background = 'transparent'; }}
        >
          {/* Title */}
          <div style={{
            fontSize: '0.8125rem', fontWeight: note.pinned ? 600 : 500,
            color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {note.pinned && <span style={{ marginRight: 4 }}>📌</span>}
            {note.title || 'Untitled'}
          </div>

          {/* Preview */}
          {preview && (
            <div style={{
              fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {preview}
            </div>
          )}

          {/* Metadata row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
            fontSize: '0.6875rem', color: 'var(--text-muted)',
          }}>
            <span>{timeAgo(note.updated_at)}</span>
            {visibleTags.map(t => (
              <Tag key={t} label={t} color="var(--text-dim)" size="sm" variant="outline" />
            ))}
            {extraTags > 0 && <span>+{extraTags}</span>}
            <span style={{ marginLeft: 'auto' }}>
              <SourceBadge source={note.source} size="sm" />
            </span>
          </div>
        </div>
      }
      items={[
        { label: note.pinned ? 'Unpin' : 'Pin', icon: Pin, onClick: onPin },
        { label: 'Archive', icon: Archive, onClick: onArchive },
        { label: '', icon: undefined, onClick: () => {}, separator: true },
        { label: 'Share', icon: Share2, onClick: () => setShareOpen(true) },
        { label: 'Relate', icon: Link2, onClick: () => setRelateOpen(true) },
        { label: '', icon: undefined, onClick: () => {}, separator: true },
        { label: 'Delete', icon: Trash, onClick: onDelete, variant: 'danger' as const },
      ]}
    />
    {shareOpen && (
      <EntityShareModal
        open={shareOpen}
        entityType="note"
        entityId={note.id}
        entityTitle={note.title || 'Untitled'}
        onClose={() => setShareOpen(false)}
      />
    )}
    {relateOpen && (
      <RelateModal
        open={relateOpen}
        sourceType="note"
        sourceId={note.id}
        onClose={() => setRelateOpen(false)}
      />
    )}
    </>
  );
}
