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

import { useOriginRefresh } from '@/hooks/use-origin-refresh';
import { NoteAttachments } from './NoteAttachments';
import { NoteNativeView } from './NoteNativeView';
import { NoteNativeExport } from './NoteNativeExport';
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
import { AlertCircle, Code, GripVertical, Share2 } from 'lucide-react';
import { EntityShareModal } from '@/components/shared/EntityShareModal';
import { SharedWithIndicator } from '@/components/shared/SharedWithIndicator';
import { AuthImage, setNoteImageDisplayResources } from './extensions/auth-image';
import { UniversalMention, parseClawHref } from './extensions/mention';
import { buildMentionSuggestion } from './extensions/mention-suggestion';
import { ENTITY_REF_MAP } from '@/config/entity-refs';
import { TagInput } from '@/components/shared/TagInput';
import { toast } from 'sonner';
import { api, ApiError } from '@/services/api';
import { useWebSocket } from '@/hooks/use-websocket';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useNoteLinks } from './hooks/use-note-links';
import { NoteEditorToolbar } from './NoteEditorToolbar';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { useCoNavigation } from '@/hooks/use-co-navigation';
import { useKeyboardOpen } from '@/hooks/use-media-query';
import { EntitySource } from '@/components/shared/SourceBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Note, NoteAttachment } from '@/types/notes';
import type { ApiResponse } from '@/types/api';
import { noteEditPolicy } from './note-edit-policy';
import { NativeNoteIdentity, NativeNoteProtected } from './extensions/native-note';
import { useOneNoteEditor } from './hooks/use-onenote-editor';
import {useNotionTitle} from './hooks/use-notion-title';
import {useNotionResources} from './hooks/use-notion-resources';
import { useNextcloudMarkdown } from './hooks/use-nextcloud-markdown';

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

/**
 * Dado el target de un click dentro del editor, si cae sobre una chip de
 * mención (a[href^="claw://"]) devuelve la ruta de app resuelta vía
 * ENTITY_REF_MAP; si no, null. Compartido por handleClick (navegar) y
 * auxclick (abrir en nueva pestaña).
 */
function resolveMentionRoute(target: HTMLElement | null): string | null {
  const anchor = target?.closest?.('a[href]');
  const ref = parseClawHref(anchor?.getAttribute('href'));
  const def = ref ? ENTITY_REF_MAP[ref.domain] : undefined;
  return ref && def ? def.route(ref.id) : null;
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
  const [attachmentState, setAttachmentState] = useState<{ noteId: string; items: NoteAttachment[] }>({ noteId, items: [] });
  const receiveAttachments = useCallback((items: NoteAttachment[]) => setAttachmentState({ noteId, items }), [noteId]);
  const nativeView = note?.content_format === 'html' && (['onenote-notes','notion-notes'].includes(note.sync?.provider || '') ||
    note.content.startsWith('<div data-note-native-view="onenote">'));
  const { bodyReadOnly, metadataReadOnly } = noteEditPolicy(note);
  const bodyReadOnlyRef = useRef(true);
  bodyReadOnlyRef.current = bodyReadOnly;
  const connectedChangeRef = useRef<((html: string) => void) | null>(null);
  const nativeEditorRef = useRef(false); nativeEditorRef.current = nativeView === true;
  const notionEditorRef=useRef(false);notionEditorRef.current=note?.sync?.provider==='notion-notes';
  const nextcloudEditorRef=useRef(false);nextcloudEditorRef.current=note?.sync?.provider==='nextcloud-notes';
  const [loading, setLoading] = useState(true);
  const [confirmPlain, setConfirmPlain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareInitial, setShareInitial] = useState<'shared' | undefined>(undefined);
  const [shareRefreshKey, setShareRefreshKey] = useState(0);
  const [tocItems, setTocItems] = useState<TableOfContentDataItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  // Modo código fuente: edita el markdown/HTML CRUDO en un textarea en vez
  // del WYSIWYG. Al volver al renderizado se re-parsea. (Sin sentido en
  // formato plain, que ya es crudo.)
  const [sourceMode, setSourceMode] = useState(false);
  const { links, loading: linksLoading } = useNoteLinks(noteId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bug 5: el botón de imagen abre este input nativo (galería en móvil,
  // explorador en PC) y sube vía insertImages (mismo flujo que paste/drop).
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const resourceInputRef=useRef<HTMLInputElement|null>(null),resourceTarget=useRef<{id:string;image:boolean}|null>(null);
  const resourceUploadRef=useRef<((file:File)=>Promise<void>)|null>(null),resourceBusyRef=useRef(false);
  // Con el teclado desplegado (móvil), ocultamos los paneles de inteligencia del
  // pie para dar más espacio a la escritura.
  const keyboardOpen = useKeyboardOpen();
  // La extensión TableOfContents dispara su onUpdate de forma SÍNCRONA durante la
  // creación del editor (en render, antes de montar). Para no hacer setState
  // pre-mount ("...component that hasn't mounted yet") guardamos el primer TOC en
  // un ref y lo volcamos en el useEffect de montaje; después de montar, va directo.
  const tocMountedRef = useRef(false);
  const pendingTocRef = useRef<TableOfContentDataItem[] | null>(null);
  // El onUpdate de TipTap es un closure estable — el formato vivo va en un ref
  // para serializar siempre según el formato ACTUAL de la nota.
  const formatRef = useRef<NoteFormat>('markdown');
  const format: NoteFormat = note?.content_format ?? 'markdown';
  formatRef.current = format;

  useEffect(() => {
    tocMountedRef.current = true;
    if (pendingTocRef.current) { setTocItems(pendingTocRef.current); pendingTocRef.current = null; }
    return () => { tocMountedRef.current = false; };
  }, []);

  // Fetch note
  useEffect(() => {
    let active = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setNote(null);
    setLoading(true);
    setIsDirty(false);
    setSourceMode(false);
    api.get<ApiResponse<Note>>(`/notes/${noteId}`)
      .then(res => { if (active) setNote(res.data); })
      .catch(() => { if (active) toast.error('Failed to load note'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [noteId]);

  useOriginRefresh('notes', async () => {
    const { data } = await api.get<ApiResponse<Note>>(`/notes/${noteId}`);
    setNote(prev => prev?.id === data.id ? { ...prev, origins: data.origins, sync: data.sync } : prev);
  });

  // Tiptap editor
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
        // StarterKit de TipTap 3.x ya incluye link/underline/listKeymap; los
        // desactivamos para añadir nuestras versiones a medida (autolink,
        // openOnClick:false, ListKeymap) sin colisión de nombres de extensión.
        link: false,
        underline: false,
        listKeymap: false,
      }),
      NativeNoteIdentity.configure({ enabled: () => nativeEditorRef.current,unitBlocks:()=>notionEditorRef.current }), NativeNoteProtected,
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
      // Measurements/code in notes must retain the character the user typed.
      Typography.configure({ multiplication: false }),
      ListKeymap,
      CharacterCount,
      Youtube.configure({ width: 480, height: 270, nocookie: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle, Color,
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        // Antes de montar, el primer onUpdate (síncrono en la creación del editor)
        // se guarda en pendingTocRef y se vuelca en el useEffect de montaje; ya
        // montado, el setState va directo. Evita el warning de setState pre-mount.
        onUpdate: (items) => {
          if (tocMountedRef.current) setTocItems(items);
          else pendingTocRef.current = items;
        },
      }),
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp','application/pdf'],
        onPaste: (ed, files) => { if(notionEditorRef.current){if(files[0])void resourceUploadRef.current?.(files[0]);return;}if(nextcloudEditorRef.current)return;if(!nativeEditorRef.current&&!bodyReadOnlyRef.current)void insertImages(ed,files.filter(file=>file.type.startsWith('image/'))); },
        onDrop: (ed, files, pos) => { if(notionEditorRef.current){if(files[0])void resourceUploadRef.current?.(files[0]);return;}if(nextcloudEditorRef.current)return;if(!nativeEditorRef.current&&!bodyReadOnlyRef.current)void insertImages(ed,files.filter(file=>file.type.startsWith('image/')),pos); },
      }),
      UniversalMention.configure({ suggestion: buildMentionSuggestion() }),
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      if (connectedChangeRef.current) { connectedChangeRef.current(ed.getHTML()); return; }
      if (bodyReadOnlyRef.current) return;
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
      // El href real es `claw://…` (no navegable por el navegador), así que el
      // gesto "nueva pestaña" (rueda/ctrl/cmd) lo resolvemos a mano: abrimos la
      // ruta de app resuelta vía ENTITY_REF_MAP con window.open.
      handleClick: (_view, _pos, event) => {
        const route = resolveMentionRoute(event.target as HTMLElement);
        if (!route) return false;
        if (event.metaKey || event.ctrlKey) {
          window.open(route, '_blank', 'noopener');
        } else {
          navigate(route);
        }
        return true;
      },
      handleDOMEvents: {
        // Click central (rueda) sobre una chip → abrir en nueva pestaña.
        auxclick: (_view, event) => {
          if (event.button !== 1) return false;
          const route = resolveMentionRoute(event.target as HTMLElement);
          if (!route) return false;
          event.preventDefault();
          window.open(route, '_blank', 'noopener');
          return true;
        },
      },
    },
  });

  const titleBlocksBody=useRef(false);
  const oneNoteEditor = useOneNoteEditor(note, editor, fresh => { setNote(fresh); onSaved?.(fresh.id, fresh); },titleBlocksBody);
  const nextcloudEditor = useNextcloudMarkdown(note, fresh => { setNote(fresh); onSaved?.(fresh.id, fresh); }, titleBlocksBody);
  const notionTitle=useNotionTitle(note,()=>oneNoteEditor.hasPending()||nextcloudEditor.hasPending()||resourceBusyRef.current,titleBlocksBody,fresh=>{setNote(fresh);onSaved?.(fresh.id,fresh);});
  const resources=useNotionResources(note,()=>oneNoteEditor.hasPending()||nextcloudEditor.hasPending()||notionTitle.dirty||notionTitle.saving,fresh=>{setNote(fresh);onSaved?.(fresh.id,fresh);});
  resourceBusyRef.current=resources.busy;
  titleBlocksBody.current=notionTitle.dirty||notionTitle.saving||resources.busy;
  resourceUploadRef.current=resources.enabled?file=>resources.upload(file):null;
  connectedChangeRef.current = oneNoteEditor.active ? oneNoteEditor.onChange : nextcloudEditor.active ? () => {
    const markdown = editor?.getMarkdown() ?? '';
    nextcloudEditor.onChange(markdown);
    setNote(prev => prev?.sync?.provider === 'nextcloud-notes' ? { ...prev, content: markdown } : prev);
  } : null;

  // Handle de debugging en dev (tests E2E / consola).
  useEffect(() => {
    if (import.meta.env.DEV && editor) {
      (window as unknown as Record<string, unknown>).__noteEditor = editor;
    }
  }, [editor]);

  useEffect(() => { editor?.setEditable((!bodyReadOnly || oneNoteEditor.enabled || nextcloudEditor.enabled)&&!notionTitle.dirty&&!notionTitle.saving&&!resources.busy, false); }, [editor, bodyReadOnly, oneNoteEditor.enabled,nextcloudEditor.enabled,notionTitle.dirty,notionTitle.saving,resources.busy]);

  // Set editor content when note loads or noteId changes — parseando según
  // el formato de la nota (markdown se renderiza rico, no caracteres literales).
  useEffect(() => {
    if (editor && note && note.content_format !== 'plain') {
      if (nativeView) return; // OneNote's adapter prepares the SAME editor with provenance.
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

  useEffect(() => {
    if (!editor || note?.sync?.provider !== 'nextcloud-notes' || note.content_format !== 'markdown' ||
      attachmentState.noteId !== note.id) return;
    let active = true;
    const urls: string[] = [];
    const images = attachmentState.items.filter(item => item.kind === 'copied' && item.resource_ref &&
      ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(item.mime_type ?? ''));
    void Promise.all(images.map(async item => {
      try {
        const response = await api.getBlob(`/notes/${note.id}/attachments/${item.id}/download`);
        if (!active) return null;
        const url = URL.createObjectURL(new Blob([response.blob], { type: item.mime_type! }));
        urls.push(url);
        return [item.resource_ref!, url] as const;
      } catch { return null; }
    })).then(found => {
      if (!active) return;
      const map = new Map(found.filter((pair): pair is readonly [string, string] => pair !== null));
      setNoteImageDisplayResources(editor, map);
    });
    return () => {
      active = false;
      setNoteImageDisplayResources(editor, new Map());
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [editor, note?.id, note?.content_format, note?.sync?.provider, attachmentState]);

  const handleContentChange = useCallback((content: string) => {
    if (note?.sync?.provider === 'nextcloud-notes') {
      nextcloudEditor.onChange(content);
      setNote(prev => prev ? { ...prev, content } : null);
      return;
    }
    if (!note || bodyReadOnlyRef.current) return;
    setNote(prev => prev ? { ...prev, content } : null);
    setIsDirty(true);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (bodyReadOnlyRef.current) return;
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
  }, [note, noteId, onSaved, nextcloudEditor.onChange]);

  // Cambio de formato: convierte el contenido actual con el propio editor y
  // persiste content + content_format JUNTOS (una sola PATCH).
  const applyFormatChange = useCallback(async (target: NoteFormat) => {
    if (!note || !editor || bodyReadOnlyRef.current || target === note.content_format) return;
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

  // Convertir a texto plano pierde el formato → confirma antes; el resto
  // de conversiones (md↔html) se aplican directo.
  const handleFormatChange = useCallback((target: NoteFormat) => {
    if (!note || bodyReadOnlyRef.current) return;
    if (target === 'plain' && note.content_format !== 'plain') { setConfirmPlain(true); return; }
    void applyFormatChange(target);
  }, [note, applyFormatChange]);

  // Toggle renderizado ↔ código fuente. Al entrar, el textarea toma
  // note.content (que onUpdate mantiene al día); al salir, se re-parsea lo
  // editado en el doc de TipTap.
  const toggleSourceMode = useCallback(() => {
    if (!note || !editor || format === 'plain') return;
    if (sourceMode) {
      if (!nativeView) editor.commands.setContent(note.content || '', {
        emitUpdate: false,
        contentType: format === 'markdown' ? 'markdown' : 'html',
      });
      setSourceMode(false);
    } else {
      setSourceMode(true);
    }
  }, [note, editor, format, sourceMode, nativeView]);

  const handleTitleChange = useCallback((title: string) => {
    if(notionTitle.active){notionTitle.onChange(title);return;}
    if (!note || bodyReadOnlyRef.current) return;
    setNote(prev => prev ? { ...prev, title } : null);
    setIsDirty(true);
    onSaved?.(noteId, { title });

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (bodyReadOnlyRef.current) return;
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
  }, [note, noteId, onSaved,notionTitle.active,notionTitle.onChange]);

  // Listen for WS updates to the current note
  const wsEvent = useWebSocket('note.*');
  useEffect(() => {
    if (!wsEvent || !note) return;
    if (wsEvent.data.id === note.id && !isDirty && !oneNoteEditor.dirty && !nextcloudEditor.dirty && !nextcloudEditor.saving && !notionTitle.dirty&&!notionTitle.saving) {
      let active = true;
      // Re-read authorization/sync state: legacy WS payloads do not carry the public descriptor.
      void api.get<ApiResponse<Note>>(`/notes/${noteId}`).then(({ data: updated }) => {
        if (!active) return;
        setNote(updated);
        const native = updated.content_format === 'html' && (['onenote-notes','notion-notes'].includes(updated.sync?.provider||'') || updated.content.startsWith('<div data-note-native-view="onenote">'));
        if (editor && !native && updated.content_format !== 'plain') editor.commands.setContent(updated.content || '', {
          emitUpdate: false, contentType: updated.content_format === 'markdown' ? 'markdown' : 'html',
        });
      }).catch(error => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          setNote(null); editor?.setEditable(false, false);
        } else toast.error('No se pudo actualizar la nota');
      });
      return () => { active = false; };
    }
    // A descriptor refresh must not itself trigger another refresh of the same event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsEvent, noteId, isDirty, oneNoteEditor.dirty, nextcloudEditor.dirty, nextcloudEditor.saving, notionTitle.dirty,notionTitle.saving, editor]);

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleTagsChange = useCallback(async (newTags: string[]) => {
    if (!note || noteEditPolicy(note).metadataReadOnly) return;
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
      {/* Header (incluye la toolbar de formato en modo renderizado → sin doble
          línea: si la toolbar se muestra, ella aporta el separador inferior). */}
      <div style={{ padding: '12px 16px 8px', borderBottom: (format !== 'plain' && !sourceMode) ? 'none' : '1px solid var(--border)' }}>
        {note.sync && (
          <div role="status" data-note-sync-state={note.sync.state} style={{ fontSize: '0.8125rem', marginBottom: 8, color: 'var(--text-dim)' }}>
            {note.sync.label} · {{ synced: 'Sincronizada', pending: 'Cambio pendiente', conflict: 'Conflicto pendiente', paused: 'Sincronización pausada', unavailable: 'Conexión no disponible' }[note.sync.state]}
            <div style={{ fontSize: '0.75rem' }}>
              {!note.sync.owner ? 'Nota compartida: contenido conectado de solo lectura.'
                : note.sync.remote_editable === false ? 'Esta nota es de solo lectura en Nextcloud o no ofrece ETag para una escritura segura.'
                : note.sync.state !== 'synced' ? {
                  pending: 'Guardado pendiente: la edición espera confirmación del proveedor.',
                  conflict: 'Edición bloqueada por un conflicto pendiente. Tu cambio se conserva.',
                  paused: 'Edición bloqueada mientras la sincronización está pausada.',
                  unavailable: 'Edición bloqueada: la conexión necesita recuperar la sincronización.',
                }[note.sync.state]
                : note.sync.write_certified ? (note.sync.provider === 'notion-notes'
                  ? 'Texto y checklist editables y sincronizados con Notion. Los elementos especiales se conservan protegidos.'
                  : note.sync.provider === 'nextcloud-notes'
                    ? 'Markdown editable y sincronizado con Nextcloud. Los adjuntos nuevos requieren una subida compatible.'
                    : 'Texto editable y sincronizado con OneNote. Las imágenes del lienzo se conservan protegidas; añadir o eliminar elementos aún no está habilitado.')
                : 'Contenido nativo conservado. Escritura todavía pendiente de verificación.'}
            </div>
          </div>
        )}
        {/* Título + "Back to list" en la MISMA fila (a la derecha) para no gastar
            una fila propia (bug 6). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            readOnly={notionTitle.active?!notionTitle.enabled||resources.busy:bodyReadOnly}
            value={notionTitle.active?notionTitle.title:note.title || ''}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            style={{
              flex: 1, minWidth: 0, fontSize: '1.25rem', fontWeight: 600,
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontFamily: 'var(--font-sans)',
            }}
          />
          {onBack && (
            <button
              onClick={onBack}
              style={{
                flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', fontSize: '0.8125rem', padding: 0,
                fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
              }}
            >
              ← Back to list
            </button>
          )}
        </div>

        {/* Metadata row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
          fontSize: '0.75rem', color: 'var(--text-dim)', flexWrap: 'wrap',
        }}>
          <EntitySource entity={note} domain="notes" detail />

          {/* Tags unificados */}
          {metadataReadOnly ? <span>{(note.tags ?? []).join(' · ')}</span> : <TagInput tags={note.tags ?? []} onChange={handleTagsChange} />}

          {/* Compartir la nota (usuarios de Micelclaw + apps del móvil) */}
          <SharedWithIndicator
            entityType="note"
            entityId={noteId}
            refreshKey={shareRefreshKey}
            onManage={() => { setShareInitial('shared'); setShareOpen(true); }}
          />
          <button
            onClick={() => { setShareInitial(undefined); setShareOpen(true); }}
            title="Compartir"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '1px 6px',
              cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Share2 size={12} /> Compartir
          </button>

          {/* Selector de formato del contenido (markdown/html/plain) */}
          <select
            disabled={bodyReadOnly}
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

          {(saving || oneNoteEditor.saving || nextcloudEditor.saving || notionTitle.saving) && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
              Saving...
            </span>
          )}
        </div>

        {/* Toolbar de formato SIEMPRE visible, dentro del header fijo (no del
            scroll) → se accede a negrita/imagen/tabla/… sin subir del todo
            (bug 6). Solo en modo renderizado (no plain/código). */}
        {format !== 'plain' && !sourceMode && (!bodyReadOnly || oneNoteEditor.enabled || nextcloudEditor.enabled) && (
          <>
            <NoteEditorToolbar
              editor={editor}
              format={format}
              inlineOnly={nativeView}
              tocOpen={tocOpen}
              onToggleToc={() => setTocOpen((v) => !v)}
              onPickImage={resources.enabled?()=>{resourceTarget.current=null;resourceInputRef.current?.click();}:nativeView || nextcloudEditor.active ? undefined : () => imageInputRef.current?.click()}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              disabled={nativeView || bodyReadOnly}
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = e.target.files;
                if (!nativeView && !bodyReadOnly && files && files.length && editor) void insertImages(editor, Array.from(files));
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {/* Editor area — TipTap renderizado para markdown/html, textarea para
          plain y para el modo código fuente (md/html crudo, monospace).
          El bloque rico se OCULTA con CSS en vez de desmontarse: el DragHandle
          (extensión react) crashea con setState al desmontar el subtree del
          editor mientras la instancia sigue viva. */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column' }}>
        <input ref={resourceInputRef} type="file" aria-label={note.sync?.provider==='nextcloud-notes'?'Archivo para Nextcloud':'Archivo para Notion'} accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" hidden disabled={!resources.enabled}
          onChange={event=>{const file=event.target.files?.[0],target=resourceTarget.current;event.target.value='';if(file){if(target&&target.image!==file.type.startsWith('image/')){toast.error('Sustituye por un archivo del mismo tipo: imagen por imagen, PDF por PDF.');return;}void resources.upload(file,target?.id??null);}}}/>
        <NoteAttachments key={noteId} noteId={noteId} compact={nativeView} onItems={receiveAttachments} refreshKey={note.sync?.local_revision??(wsEvent?.data.id === noteId ? wsEvent : undefined)}
          onAdd={resources.enabled?()=>{resourceTarget.current=null;resourceInputRef.current?.click();}:undefined}
          onReplace={resources.enabled?item=>{resourceTarget.current={id:item.resource_ref!.split('/')[0]!,image:Boolean(item.mime_type?.startsWith('image/'))};resourceInputRef.current?.click();}:undefined}/>
        {resources.error&&<div role="alert" className="text-sm text-[var(--amber)]">{resources.error}{resources.pending&&<button type="button" disabled={resources.sending} onClick={()=>void resources.retry()}>Comprobar el mismo adjunto</button>}</div>}
        {resources.status&&<p role="status" className="text-xs text-[var(--text-dim)]">{resources.status}</p>}
        {note.native_export_available && !note._shared_permission && (
          <NoteNativeExport key={`native-${noteId}`} noteId={noteId} />
        )}
        {oneNoteEditor.error && <p role="alert" className="text-sm text-[var(--amber)]">{oneNoteEditor.error}</p>}
        {nextcloudEditor.error && <p role="alert" className="text-sm text-[var(--amber)]">{nextcloudEditor.error}</p>}
        {notionTitle.error&&<div role="alert" className="text-sm text-[var(--amber)]">{notionTitle.error} <button type="button" onClick={notionTitle.discard}>Descartar cambio de título</button></div>}
        {notionTitle.status&&<p role="status" className="text-xs text-[var(--text-dim)]">{notionTitle.status}</p>}
        {oneNoteEditor.status && <p role="status" className="text-xs text-[var(--text-dim)]">{oneNoteEditor.status}</p>}
        {nextcloudEditor.status && <p role="status" className="text-xs text-[var(--text-dim)]">{nextcloudEditor.status}</p>}
        {nativeView && !oneNoteEditor.active && !sourceMode && <NoteNativeView key={noteId} noteId={noteId} content={note.content}
          provider={note.sync?.provider === 'notion-notes' ? 'Notion' : 'OneNote'}
          attachments={attachmentState.noteId === noteId ? attachmentState.items : []} />}
        {(format === 'plain' || sourceMode) && (
          <textarea
            readOnly={bodyReadOnly && !nextcloudEditor.enabled}
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
          display: (format === 'plain' || sourceMode || nativeView && !oneNoteEditor.active) ? 'none' : 'flex',
          flexDirection: 'column',
          flex: 1,
        }}>
            {/* La toolbar de formato se movió al header fijo (bug 6). */}
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

      {/* Intelligence panels — ocultos con el teclado desplegado (móvil). */}
      {!keyboardOpen && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <RelatedItemsPanel links={links} loading={linksLoading} onNavigate={onBack} sourceType="note" sourceId={noteId} />
          <SimilarContentPanel sourceType="note" sourceId={noteId} />
          <GraphProximityPanel sourceType="note" sourceId={noteId} />
        </div>
      )}

      <ConfirmDialog
        open={confirmPlain}
        onClose={() => setConfirmPlain(false)}
        onConfirm={() => { setConfirmPlain(false); void applyFormatChange('plain'); }}
        title="Convert to plain text?"
        description="Converting to plain text loses formatting (bold, lists, links…). Continue?"
        confirmLabel="Convert"
        cancelLabel="Cancel"
        variant="warning"
      />

      {shareOpen && (
        <EntityShareModal
          open={shareOpen}
          entityType="note"
          entityId={noteId}
          entityTitle={note.title || ''}
          initialSection={shareInitial}
          onShared={() => setShareRefreshKey(k => k + 1)}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
