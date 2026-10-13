import type { Note } from '@/types/notes';

export function noteEditPolicy(note: (Pick<Note, 'sync' | '_shared_permission'> & Partial<Pick<Note, 'content' | 'content_format'>>) | null) {
  const sharedRead = note?._shared_permission === 'read';
  return {
    // Certification authorizes structured operations, never the legacy whole-body editor.
    bodyReadOnly: !note || Boolean(note.sync) || sharedRead ||
      Boolean(note.content_format === 'html' && note.content?.startsWith('<div data-note-native-view="onenote">')),
    metadataReadOnly: !note || sharedRead || Boolean(note.sync && !note.sync.local_metadata_editable),
  };
}
