import { useMemo } from 'react';
import { StickyNote } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { NotesFilters } from './NotesFilters';
import { NoteCreateButton } from './NoteCreateButton';
import { NotesListItem } from './NotesListItem';
import type { Note, NoteFilters } from '@/types/notes';

interface NotesListProps {
  notes: Note[];
  loading: boolean;
  error: string | null;
  filters: NoteFilters;
  onFiltersChange: (filters: Partial<NoteFilters>) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNote: () => void;
  onPinNote: (id: string) => void;
  onArchiveNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onRetry: () => void;
}

function SkeletonItem() {
  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ height: 14, width: '70%', background: 'var(--surface-hover)', borderRadius: 4, marginBottom: 6 }} />
      <div style={{ height: 12, width: '90%', background: 'var(--surface)', borderRadius: 4, marginBottom: 6 }} />
      <div style={{ height: 10, width: '50%', background: 'var(--surface)', borderRadius: 4 }} />
    </div>
  );
}

export function NotesList({
  notes, loading, error, filters, onFiltersChange,
  selectedId, onSelect, onCreateNote, onPinNote, onArchiveNote, onDeleteNote, onRetry,
}: NotesListProps) {
  const availableTags = useMemo(
    () => [...new Set(notes.flatMap(n => n.tags))].sort(),
    [notes],
  );

  const pinned = notes.filter(n => n.pinned);
  const regular = notes.filter(n => !n.pinned);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
      <NotesFilters
        search={filters.search || ''}
        onSearchChange={v => onFiltersChange({ search: v })}
        source={filters.source || ''}
        onSourceChange={v => onFiltersChange({ source: v })}
        selectedTag={filters.tag || ''}
        onTagChange={v => onFiltersChange({ tag: v })}
        availableTags={availableTags}
      />

      <NoteCreateButton onClick={onCreateNote} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Loading */}
        {loading && notes.length === 0 && (
          <>
            <SkeletonItem /><SkeletonItem /><SkeletonItem /><SkeletonItem />
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginBottom: 8 }}>{error}</p>
            <button
              onClick={onRetry}
              style={{
                padding: '6px 12px', background: 'var(--surface-hover)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && notes.length === 0 && (
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description="Create your first note or connect a sync provider to import existing notes."
            actions={[{ label: '+ New Note', onClick: onCreateNote, variant: 'primary' }]}
          />
        )}

        {/* Pinned section */}
        {pinned.length > 0 && (
          <>
            <div style={{
              padding: '8px 12px 4px', fontSize: '0.6875rem', fontWeight: 600,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              📌 Pinned
            </div>
            {pinned.map(note => (
              <NotesListItem
                key={note.id}
                note={note}
                selected={note.id === selectedId}
                onClick={() => onSelect(note.id)}
                onPin={() => onPinNote(note.id)}
                onArchive={() => onArchiveNote(note.id)}
                onDelete={() => onDeleteNote(note.id)}
              />
            ))}
          </>
        )}

        {/* Regular section */}
        {pinned.length > 0 && regular.length > 0 && (
          <div style={{
            padding: '8px 12px 4px', fontSize: '0.6875rem', fontWeight: 600,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            All Notes
          </div>
        )}
        {regular.map(note => (
          <NotesListItem
            key={note.id}
            note={note}
            selected={note.id === selectedId}
            onClick={() => onSelect(note.id)}
            onPin={() => onPinNote(note.id)}
            onArchive={() => onArchiveNote(note.id)}
            onDelete={() => onDeleteNote(note.id)}
          />
        ))}
      </div>
    </div>
  );
}
