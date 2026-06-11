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
import { useNavigate } from 'react-router';
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExt from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Typography from '@tiptap/extension-typography';
import ListKeymap from '@tiptap/extension-list-keymap';
import CharacterCount from '@tiptap/extension-character-count';
import Youtube from '@tiptap/extension-youtube';
import TextAlign from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { TableOfContents, getHierarchicalIndexes, type TableOfContentDataItem } from '@tiptap/extension-table-of-contents';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import FileHandler from '@tiptap/extension-file-handler';
import { common, createLowlight } from 'lowlight';
import { AlertCircle, Code, GripVertical } from 'lucide-react';
import { AuthImage } from './extensions/auth-image';
import { UniversalMention, parseClawHref } from './extensions/mention';
import { buildMentionSuggestion } from './extensions/mention-suggestion';
import { ENTITY_REF_MAP } from '@/config/entity-refs';
import { TagInput } from '@/components/shared/TagInput';
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
import { EmptyState } from '@/components/shared/EmptyState';
import { SourcePickerModal } from './SourcePickerModal';
import type { Note } from '@/types/notes';
import type { ApiResponse } from '@/types/api';

const lowlight = createLowlight(common);

type NoteFormat = Note['content_format'];

const FORMAT_LABELS: Record<NoteFormat, string> = {
  markdown: 'Markdown',
  html: 'HTML',
  plain: 'Plain text',
};

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

/** Sube una imagen pegada/arrastrada a Drive (carpeta /notes) y devuelve la URL limpia. */
async function uploadEditorImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('parent_folder', '/notes');
  formData.append('file', file);
  const res = await api.upload<ApiResponse<{ id: string }>>('/files/upload', formData);
  return `/api/v1/files/${res.data.id}/preview`;
}

/** FileHandler: sube cada imagen y la inserta (en `pos` si viene de un drop). */
async function insertImages(ed: TiptapEditor, files: File[], pos?: number): Promise<void> {
  for (const file of files) {
    try {
      const src = await uploadEditorImage(file);
      const content = { type: 'image', attrs: { src, alt: file.name } };
      if (typeof pos === 'number') ed.chain().focus().insertContentAt(pos, content).run();
      else ed.chain().focus().insertContent(content).run();
    } catch {
      toast.error(`No se pudo subir ${file.name}`);
    }
  }
}

export function NoteEditor({ noteId, onBack, onSaved }: NoteEditorProps) {
  useCoNavigation('note', noteId);
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [tocItems, setTocItems] = useState<TableOfContentDataItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  // Modo código fuente: edita el markdown/HTML CRUDO en un textarea en vez
  // del WYSIWYG. Al volver al renderizado se re-parsea. (Sin sentido en
  // formato plain, que ya es crudo.)
  const [sourceMode, setSourceMode] = useState(false);
  const { links, loading: linksLoading } = useNoteLinks(noteId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El onUpdate de TipTap es un closure estable — el formato vivo va en un ref
  // para serializar siempre según el formato ACTUAL de la nota.
  const formatRef = useRef<NoteFormat>('markdown');
  const format: NoteFormat = note?.content_format ?? 'markdown';
  formatRef.current = format;

  // Fetch note
  useEffect(() => {
    setLoading(true);
    setIsDirty(false);
    setSourceMode(false);
    api.get<ApiResponse<Note>>(`/notes/${noteId}`)
      .then(res => setNote(res.data))
      .catch(() => toast.error('Failed to load note'))
      .finally(() => setLoading(false));
  }, [noteId]);

  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      UnderlineExt,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Markdown,
      // Bloques que antes el schema DESCARTABA al parsear (tablas, imágenes…)
      TableKit.configure({ table: { resizable: false } }),
      AuthImage.configure({ inline: true }),
      Details, DetailsSummary, DetailsContent,
      Highlight, Subscript, Superscript,
      Typography,
      ListKeymap,
      CharacterCount,
      Youtube.configure({ width: 480, height: 270, nocookie: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle, Color,
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        onUpdate: (items) => setTocItems(items),
      }),
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        onPaste: (ed, files) => { void insertImages(ed, files); },
        onDrop: (ed, files, pos) => { void insertImages(ed, files, pos); },
      }),
      UniversalMention.configure({ suggestion: buildMentionSuggestion() }),
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      // Serializar según el formato de la nota: el content guardado SIEMPRE
      // coincide con content_format (antes una nota markdown editada aquí se
      // guardaba como HTML y divergía para los agentes que la releyeran).
      handleContentChange(formatRef.current === 'markdown' ? ed.getMarkdown() : ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[200px] text-[var(--text)] text-sm leading-relaxed',
      },
      // Click en una chip de mención (a[href^="claw://"]) → navegar al registro.
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement).closest?.('a[href]');
        const ref = parseClawHref(anchor?.getAttribute('href'));
        const def = ref ? ENTITY_REF_MAP[ref.domain] : undefined;
        if (ref && def) {
          navigate(def.route(ref.id));
          return true;
        }
        return false;
      },
    },
  });

  // Handle de debugging en dev (tests E2E / consola).
  useEffect(() => {
    if (import.meta.env.DEV && editor) {
      (window as unknown as Record<string, unknown>).__noteEditor = editor;
    }
  }, [editor]);

  // Set editor content when note loads or noteId changes — parseando según
  // el formato de la nota (markdown se renderiza rico, no caracteres literales).
  useEffect(() => {
    if (editor && note && note.content_format !== 'plain') {
      const current = note.content_format === 'markdown' ? editor.getMarkdown() : editor.getHTML();
      if (current !== note.content) {
        editor.commands.setContent(note.content || '', {
          emitUpdate: false,
          contentType: note.content_format === 'markdown' ? 'markdown' : 'html',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, editor]);

  const handleContentChange = useCallback((content: string) => {
    if (!note) return;
    setNote(prev => prev ? { ...prev, content } : null);
    setIsDirty(true);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.patch(`/notes/${noteId}`, { content });
        setIsDirty(false);
        onSaved?.(noteId, { content, updated_at: new Date().toISOString() });
      } catch {
        toast.error('Failed to save');
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [note, noteId, onSaved]);

  // Cambio de formato: convierte el contenido actual con el propio editor y
  // persiste content + content_format JUNTOS (una sola PATCH).
  const handleFormatChange = useCallback(async (target: NoteFormat) => {
    if (!note || !editor || target === note.content_format) return;
    if (target === 'plain' && note.content_format !== 'plain') {
      const ok = window.confirm('Convertir a texto plano pierde el formato (negritas, listas, enlaces…). ¿Continuar?');
      if (!ok) return;
    }
    // En modo código el doc de TipTap puede ir por detrás del textarea —
    // recargar el contenido vivo antes de convertir.
    if (sourceMode && note.content_format !== 'plain') {
      editor.commands.setContent(note.content || '', {
        emitUpdate: false,
        contentType: note.content_format === 'markdown' ? 'markdown' : 'html',
      });
    }
    let converted: string;
    if (note.content_format === 'plain') {
      // El texto plano es markdown válido — parsearlo como markdown y
      // serializar al destino da una conversión coherente para md y html.
      editor.commands.setContent(note.content || '', { emitUpdate: false, contentType: 'markdown' });
      converted = target === 'markdown' ? editor.getMarkdown() : editor.getHTML();
    } else if (target === 'plain') {
      converted = editor.getText();
    } else {
      converted = target === 'markdown' ? editor.getMarkdown() : editor.getHTML();
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      await api.patch(`/notes/${noteId}`, { content: converted, content_format: target });
      setNote(prev => prev ? { ...prev, content: converted, content_format: target } : null);
      setIsDirty(false);
      onSaved?.(noteId, { content: converted, content_format: target, updated_at: new Date().toISOString() });
      if (target !== 'plain') {
        editor.commands.setContent(converted, { emitUpdate: false, contentType: target });
      }
    } catch {
      toast.error('Failed to change format');
    } finally {
      setSaving(false);
    }
  }, [note, noteId, editor, onSaved, sourceMode]);

  // Toggle renderizado ↔ código fuente. Al entrar, el textarea toma
  // note.content (que onUpdate mantiene al día); al salir, se re-parsea lo
  // editado en el doc de TipTap.
  const toggleSourceMode = useCallback(() => {
    if (!note || !editor || format === 'plain') return;
    if (sourceMode) {
      editor.commands.setContent(note.content || '', {
        emitUpdate: false,
        contentType: format === 'markdown' ? 'markdown' : 'html',
      });
      setSourceMode(false);
    } else {
      setSourceMode(true);
    }
  }, [note, editor, format, sourceMode]);

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
      if (editor && updated.content_format !== 'plain') {
        const current = updated.content_format === 'markdown' ? editor.getMarkdown() : editor.getHTML();
        if (updated.content !== current) {
          editor.commands.setContent(updated.content || '', {
            emitUpdate: false,
            contentType: updated.content_format === 'markdown' ? 'markdown' : 'html',
          });
        }
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

  const handleTagsChange = useCallback(async (newTags: string[]) => {
    if (!note) return;
    setNote(prev => prev ? { ...prev, tags: newTags } : null);
    onSaved?.(noteId, { tags: newTags });
    try {
      await api.patch(`/notes/${noteId}`, { tags: newTags });
    } catch {
      toast.error('Failed to update tags');
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

          {/* Tags unificados */}
          <TagInput tags={note.tags} onChange={handleTagsChange} />

          {/* Selector de formato del contenido (markdown/html/plain) */}
          <select
            value={format}
            onChange={e => handleFormatChange(e.target.value as NoteFormat)}
            title="Content format"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
              padding: '1px 4px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {(Object.keys(FORMAT_LABELS) as NoteFormat[]).map(f => (
              <option key={f} value={f} style={{ background: 'var(--card)', color: 'var(--text)' }}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>

          {/* Toggle renderizado ↔ código fuente (crudo md/html). Oculto en plain. */}
          {format !== 'plain' && (
            <button
              onClick={toggleSourceMode}
              title={sourceMode ? 'Volver al editor renderizado' : `Editar código ${FORMAT_LABELS[format]} crudo`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: sourceMode ? 'color-mix(in srgb, var(--amber) 15%, transparent)' : 'transparent',
                border: `1px solid ${sourceMode ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: sourceMode ? 'var(--amber)' : 'var(--text-dim)',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-sans)',
                padding: '1px 5px',
                cursor: 'pointer',
                transition: 'color var(--transition-fast), border-color var(--transition-fast)',
              }}
            >
              <Code size={11} />
              Code
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

      {/* Editor area — TipTap renderizado para markdown/html, textarea para
          plain y para el modo código fuente (md/html crudo, monospace).
          El bloque rico se OCULTA con CSS en vez de desmontarse: el DragHandle
          (extensión react) crashea con setState al desmontar el subtree del
          editor mientras la instancia sigue viva. */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column' }}>
        {(format === 'plain' || sourceMode) && (
          <textarea
            value={note.content || ''}
            onChange={e => handleContentChange(e.target.value)}
            placeholder="Start writing..."
            spellCheck={false}
            style={{
              flex: 1,
              width: '100%',
              minHeight: 200,
              marginTop: 8,
              background: sourceMode ? 'color-mix(in srgb, var(--bg) 60%, var(--surface))' : 'transparent',
              border: sourceMode ? '1px solid var(--border)' : 'none',
              borderRadius: sourceMode ? 'var(--radius-sm)' : 0,
              padding: sourceMode ? 10 : 0,
              outline: 'none',
              resize: 'none',
              color: 'var(--text)',
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              fontFamily: sourceMode
                ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
                : 'var(--font-sans)',
            }}
          />
        )}
        <div style={{
          display: (format === 'plain' || sourceMode) ? 'none' : 'flex',
          flexDirection: 'column',
          flex: 1,
        }}>
            <NoteEditorToolbar
              editor={editor}
              format={format}
              tocOpen={tocOpen}
              onToggleToc={() => setTocOpen((v) => !v)}
            />
            {/* Tabla de contenidos plegable (extensión table-of-contents) */}
            {tocOpen && tocItems.length > 0 && (
              <div style={{
                margin: '8px 0', padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
              }}>
                {tocItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => item.dom.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: item.isActive ? 'var(--amber)' : 'var(--text-dim)',
                      padding: '1px 0', paddingLeft: (item.level - 1) * 14,
                      fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
                    }}
                  >
                    {item.textContent}
                  </button>
                ))}
              </div>
            )}
            {/* Handle lateral estilo Notion para arrastrar bloques */}
            {editor && (
              <DragHandle editor={editor}>
                <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
              </DragHandle>
            )}
            <EditorContent editor={editor} />
            {/* Contador de palabras/caracteres (extensión character-count) */}
            {editor && (
              <div style={{
                marginTop: 6, fontSize: '0.6875rem', color: 'var(--text-muted)',
                textAlign: 'right', fontFamily: 'var(--font-sans)',
              }}>
                {editor.storage.characterCount.words()} palabras · {editor.storage.characterCount.characters()} caracteres
              </div>
            )}
        </div>
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
