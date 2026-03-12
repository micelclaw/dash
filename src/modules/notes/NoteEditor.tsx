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
import { AlertCircle, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/use-websocket';
import { useNoteLinks } from './hooks/use-note-links';
import { NoteEditorToolbar } from './NoteEditorToolbar';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { useCoNavigation } from '@/hooks/use-co-navigation';
import { SourceBadge } from '@/components/shared/SourceBadge';
import { Tag } from '@/components/shared/Tag';
import { EmptyState } from '@/components/shared/EmptyState';
import { SourcePickerModal } from './SourcePickerModal';
import type { Note } from '@/types/notes';
import type { ApiResponse } from '@/types/api';

const lowlight = createLowlight(common);

interface NoteEditorProps {
  noteId: string;
  onBack?: () => void;
  onSaved?: (id: string, changes: Partial<Note>) => void;
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

export function NoteEditor({ noteId, onBack, onSaved }: NoteEditorProps) {
  useCoNavigation('note', noteId);
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
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
        onSaved?.(noteId, { content: html, updated_at: new Date().toISOString() });
      } catch {
        toast.error('Failed to save');
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [note, noteId, onSaved]);

  const handleTitleChange = useCallback((title: string) => {
    if (!note) return;
    setNote(prev => prev ? { ...prev, title } : null);
    setIsDirty(true);
    onSaved?.(noteId, { title });

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
  }, [note, noteId, onSaved]);

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

  const handleSourceChange = useCallback(async (source: string) => {
    if (!note) return;
    setNote(prev => prev ? { ...prev, source } : null);
    try {
      await api.patch(`/notes/${noteId}`, { source });
    } catch {
      toast.error('Failed to update source');
    }
  }, [note, noteId]);

  const handleAddTag = useCallback(async () => {
    const tag = tagInput.trim();
    if (!tag || !note || note.tags.includes(tag)) { setTagInput(''); return; }
    const newTags = [...note.tags, tag];
    setNote(prev => prev ? { ...prev, tags: newTags } : null);
    setTagInput('');
    onSaved?.(noteId, { tags: newTags });
    try {
      await api.patch(`/notes/${noteId}`, { tags: newTags });
    } catch {
      toast.error('Failed to add tag');
    }
  }, [tagInput, note, noteId, onSaved]);

  const handleRemoveTag = useCallback(async (tagToRemove: string) => {
    if (!note) return;
    const newTags = note.tags.filter(t => t !== tagToRemove);
    setNote(prev => prev ? { ...prev, tags: newTags } : null);
    onSaved?.(noteId, { tags: newTags });
    try {
      await api.patch(`/notes/${noteId}`, { tags: newTags });
    } catch {
      toast.error('Failed to remove tag');
    }
  }, [note, noteId, onSaved]);

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
          fontSize: '0.75rem', color: 'var(--text-dim)', flexWrap: 'wrap',
        }}>
          {/* Clickable source badge */}
          <button
            onClick={() => setSourcePickerOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'transparent', border: '1px solid transparent',
              borderRadius: 'var(--radius-sm)', padding: '1px 4px',
              cursor: 'pointer', transition: 'border-color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
            title="Change source"
          >
            <SourceBadge source={note.source} size="sm" />
          </button>

          {/* Removable tags */}
          {note.tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
                fontSize: '0.6875rem', color: 'var(--text-dim)',
              }}
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, color: 'var(--text-muted)', display: 'flex',
                }}
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Add tag input */}
          {showTagInput ? (
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
                if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); }
              }}
              onBlur={() => { if (!tagInput.trim()) setShowTagInput(false); }}
              placeholder="tag name"
              autoFocus
              style={{
                width: 80, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '1px 6px', fontSize: '0.6875rem', color: 'var(--text)',
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '1px 6px',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.6875rem',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color var(--transition-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Plus size={10} />
              tag
            </button>
          )}

          {saving && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
              Saving...
            </span>
          )}
        </div>
      </div>

      {/* Source picker modal */}
      <SourcePickerModal
        open={sourcePickerOpen}
        currentSource={note.source}
        onSelect={handleSourceChange}
        onClose={() => setSourcePickerOpen(false)}
      />

      {/* Editor area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <NoteEditorToolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>

      {/* Intelligence panels */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <RelatedItemsPanel links={links} loading={linksLoading} onNavigate={onBack} />
        <SimilarContentPanel sourceType="note" sourceId={noteId} />
        <GraphProximityPanel sourceType="note" sourceId={noteId} />
      </div>
    </div>
  );
}
