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
import { useSearchParams } from 'react-router';
import { StickyNote } from 'lucide-react';
import { SplitPane } from '@/components/shared/SplitPane';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useBackGuard } from '@/hooks/use-back-guard';
import { useNotes } from './hooks/use-notes';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import type { NoteFilters,Note } from '@/types/notes';

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
  const [deletePending,setDeletePending]=useState(false);
  const [deleteConnected,setDeleteConnected]=useState(false);

  // Móvil: el botón atrás cierra el editor (sub-vista) antes de salir del módulo.
  useBackGuard(!!selectedNoteId, () => setSelectedNoteId(null), isMobile);

  const {
    notes, loading, error,
    fetchNotes, createNote, deleteNote, archiveNote, togglePin, patchLocalNote,
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
      // markdown: alinea con el default de la DB y con las notas de agentes;
      // el editor TipTap edita markdown nativo (@tiptap/markdown) y el
      // selector de formato del editor permite cambiarlo por nota.
      const newNote = await createNote({ content: '', content_format: 'markdown' });
      handleSelect(newNote.id);
    } catch {
      // Error already handled in useNotes
    }
  }, [createNote, handleSelect]);

  const handleFiltersChange = useCallback((partial: Partial<NoteFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  }, []);
  const handleConnectedNoteCreated=useCallback((note:Note)=>{void fetchNotes();handleSelect(note.id);},[fetchNotes,handleSelect]);

  const handleDelete = useCallback(async () => {
    if (!deleteDialogId||deletePending) return;
    setDeletePending(true);
    let accepted=false;
    try{accepted=await deleteNote(deleteDialogId);}finally{setDeletePending(false);}
    if(!accepted)return;
    if (selectedNoteId === deleteDialogId) {
      setSelectedNoteId(null);
      setSearchParams({}, { replace: true });
    }
    setDeleteDialogId(null);
  }, [deleteDialogId, deletePending, deleteNote, selectedNoteId, setSearchParams]);

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
      onConnectedNoteCreated={handleConnectedNoteCreated}
      onPinNote={togglePin}
      onArchiveNote={archiveNote}
      onDeleteNote={id=>{setDeleteConnected(Boolean(notes.find(note=>note.id===id)?.sync));setDeleteDialogId(id);}}
      onRetry={fetchNotes}
    />
  );

  const editorPanel = selectedNoteId ? (
    <NoteEditor noteId={selectedNoteId} onSaved={patchLocalNote} />
  ) : (
    <EmptyState
      icon={StickyNote}
      title="Select a note"
      description="Choose a note from the list or create a new one"
      actions={[{ label: '+ New Note', onClick: handleCreateNote, variant: 'primary' }]}
    />
  );

  // Móvil: navegación push (lista a pantalla completa → tap abre el editor con "atrás").
  // Evitamos el SplitPane, que en móvil pinta una tab bar "Panel 1 / Panel 2" sin sentido:
  // aquí ambas vistas ya son accesibles por navegación.
  return (
    <>
      {isMobile ? (selectedNoteId
        ? <NoteEditor noteId={selectedNoteId} onBack={()=>setSelectedNoteId(null)} onSaved={patchLocalNote}/>
        : listPanel) : <SplitPane defaultSizes={[35, 65]} minSizes={[260, 400]} id="notes-split">
        {listPanel}
        {editorPanel}
      </SplitPane>}

      <ConfirmDialog
        closeOnConfirm={false}
        pending={deletePending}
        open={deleteDialogId !== null}
        onClose={() => setDeleteDialogId(null)}
        onConfirm={handleDelete}
        title={deleteConnected ? '¿Enviar nota a la papelera?' : 'Delete note?'}
        description={deleteConnected ? 'Se retirará de Micelclaw y se enviará a la papelera del proveedor. No se restaurará automáticamente desde aquí.' : 'This note will be moved to trash. You can restore it from there.'}
        confirmLabel={deleteConnected ? 'Enviar a papelera' : 'Delete'}
        variant="danger"
      />
    </>
  );
}
