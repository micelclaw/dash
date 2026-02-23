import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExt from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/use-websocket';
import { useNoteLinks } from './hooks/use-note-links';
import { NoteEditorToolbar } from './NoteEditorToolbar';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SourceBadge } from '@/components/shared/SourceBadge';
import { Tag } from '@/components/shared/Tag';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Note } from '@/types/notes';
import type { ApiResponse } from '@/types/api';

const lowlight = createLowlight(common);

interface NoteEditorProps {
  noteId: string;
  onBack?: () => void;
}

function EditorSkeleton() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ height: 28, width: '60%', background: 'var(--surface-hover)', borderRadius: 4 }} />
      <div style={{ height: 14, width: '40%', background: 'var(--surface)', borderRadius: 4 }} />
      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
      <div style={{ height: 14, width: '90%', background: 'var(--surface)', borderRadius: 4 }} />
      <div style={{ height: 14, width: '75%', background: 'var(--surface)', borderRadius: 4 }} />
      <div style={{ height: 14, width: '85%', background: 'var(--surface)', borderRadius: 4 }} />
    </div>
  );
}

export function NoteEditor({ noteId, onBack }: NoteEditorProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { links, loading: linksLoading } = useNoteLinks(noteId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch note
  useEffect(() => {
    setLoading(true);
    setIsDirty(false);
    api.get<ApiResponse<Note>>(`/notes/${noteId}`)
      .then(res => setNote(res.data))
      .catch(() => toast.error('Failed to load note'))
      .finally(() => setLoading(false));
  }, [noteId]);

  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      UnderlineExt,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      handleContentChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[200px] text-[var(--text)] text-sm leading-relaxed',
      },
    },
  });

  // Set editor content when note loads or noteId changes
  useEffect(() => {
    if (editor && note) {
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, editor]);

  const handleContentChange = useCallback((html: string) => {
    if (!note) return;
    setNote(prev => prev ? { ...prev, content: html } : null);
    setIsDirty(true);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.patch(`/notes/${noteId}`, { content: html });
        setIsDirty(false);
      } catch {
        toast.error('Failed to save');
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [note, noteId]);

  const handleTitleChange = useCallback((title: string) => {
    if (!note) return;
    setNote(prev => prev ? { ...prev, title } : null);
    setIsDirty(true);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.patch(`/notes/${noteId}`, { title });
        setIsDirty(false);
      } catch {
        // Silent fail for title saves
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [note, noteId]);

  // Listen for WS updates to the current note
  const wsEvent = useWebSocket('note.updated');
  useEffect(() => {
    if (!wsEvent || !note) return;
    if (wsEvent.data.id === note.id && !isDirty) {
      const updated = wsEvent.data as unknown as Note;
      setNote(updated);
      if (editor && updated.content !== editor.getHTML()) {
        editor.commands.setContent(updated.content || '');
      }
    }
  }, [wsEvent, note, isDirty, editor]);

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (loading) return <EditorSkeleton />;
  if (!note) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Note not found"
        description="The note may have been deleted or you don't have access."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: '0.8125rem', padding: 0,
              marginBottom: 8, fontFamily: 'var(--font-sans)',
            }}
          >
            ← Back to list
          </button>
        )}

        {/* Editable title */}
        <input
          value={note.title || ''}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          style={{
            width: '100%', fontSize: '1.25rem', fontWeight: 600,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontFamily: 'var(--font-sans)',
          }}
        />

        {/* Metadata row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
          fontSize: '0.75rem', color: 'var(--text-dim)',
        }}>
          <SourceBadge source={note.source} size="sm" />
          {note.tags.map(tag => (
            <Tag key={tag} label={tag} color="var(--text-dim)" size="sm" variant="outline" />
          ))}
          {saving && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
              Saving...
            </span>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <NoteEditorToolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>

      {/* Related items */}
      {(links.length > 0 || linksLoading) && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <RelatedItemsPanel links={links} loading={linksLoading} onNavigate={onBack} />
        </div>
      )}
    </div>
  );
}
