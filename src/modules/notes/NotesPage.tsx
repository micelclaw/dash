import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { StickyNote } from 'lucide-react';
import { SplitPane } from '@/components/shared/SplitPane';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useNotes } from './hooks/use-notes';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import type { NoteFilters } from '@/types/notes';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    searchParams.get('id'),
  );
  const [filters, setFilters] = useState<NoteFilters>({
    search: searchParams.get('q') || '',
    archived: false,
  });
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  const {
    notes, loading, error,
    fetchNotes, createNote, deleteNote, archiveNote, togglePin,
  } = useNotes(filters);

  // Sync URL params
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && id !== selectedNoteId) setSelectedNoteId(id);

    // Handle ?action=new
    if (searchParams.get('action') === 'new') {
      handleCreateNote();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((id: string) => {
    setSelectedNoteId(id);
    setSearchParams({ id }, { replace: true });
  }, [setSearchParams]);

  const handleCreateNote = useCallback(async () => {
    try {
      const newNote = await createNote({ content: '', content_format: 'html' });
      handleSelect(newNote.id);
    } catch {
      // Error already handled in useNotes
    }
  }, [createNote, handleSelect]);

  const handleFiltersChange = useCallback((partial: Partial<NoteFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteDialogId) return;
    await deleteNote(deleteDialogId);
    if (selectedNoteId === deleteDialogId) {
      setSelectedNoteId(null);
      setSearchParams({}, { replace: true });
    }
    setDeleteDialogId(null);
  }, [deleteDialogId, deleteNote, selectedNoteId, setSearchParams]);

  // Keyboard shortcut: Cmd+N / Ctrl+N to create
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateNote();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateNote]);

  // Mobile: push navigation
  if (isMobile && selectedNoteId) {
    return <NoteEditor noteId={selectedNoteId} onBack={() => setSelectedNoteId(null)} />;
  }

  const listPanel = (
    <NotesList
      notes={notes}
      loading={loading}
      error={error}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      selectedId={selectedNoteId}
      onSelect={handleSelect}
      onCreateNote={handleCreateNote}
      onPinNote={togglePin}
      onArchiveNote={archiveNote}
      onDeleteNote={setDeleteDialogId}
      onRetry={fetchNotes}
    />
  );

  const editorPanel = selectedNoteId ? (
    <NoteEditor noteId={selectedNoteId} />
  ) : (
    <EmptyState
      icon={StickyNote}
      title="Select a note"
      description="Choose a note from the list or create a new one"
      actions={[{ label: '+ New Note', onClick: handleCreateNote, variant: 'primary' }]}
    />
  );

  return (
    <>
      <SplitPane defaultSizes={[35, 65]} minSizes={[260, 400]} id="notes-split">
        {listPanel}
        {editorPanel}
      </SplitPane>

      <ConfirmDialog
        open={deleteDialogId !== null}
        onClose={() => setDeleteDialogId(null)}
        onConfirm={handleDelete}
        title="Delete note?"
        description="This note will be moved to trash. You can restore it from there."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
