import { memo, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { api } from '@/services/api';
import type { NoteAttachment } from '@/types/notes';
import type { ApiResponse } from '@/types/api';

interface EditableUnit { index: number; id: string; value: { tag: string; html: string; attributes: Record<string, string> }; }
interface EditState { enabled: boolean; local_revision: string; units: EditableUnit[]; }
// Keep React status/image updates from replacing a focused contenteditable DOM.
const NativeHtml = memo(function NativeHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Native view with certified unit edits; never sends or converts the whole preserved body. */
export function NoteNativeView({ noteId, content, attachments, canEdit = false, onConfirmed, provider = 'OneNote' }: {
  noteId: string; content: string; attachments: NoteAttachment[]; canEdit?: boolean; onConfirmed?: () => Promise<void>; provider?: string;
}) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [editState, setEditState] = useState<EditState | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [frozen, setFrozen] = useState<string | null>(null);
  const draft = useRef<{ unit: EditableUnit; html: string } | null>(null);
  // Authority belongs to the document the user started editing, not a refresh
  // received while their draft is focused. Core must reject stale revisions.
  const editAuthority = useRef<EditState | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let active = true;
    if (canEdit) void api.get<ApiResponse<EditState>>(`/notes/${noteId}/editable-units`).then(response => {
      if (active) setEditState(response.data);
    }).catch(() => { if (active) setStatus('No se pudieron cargar los bloques editables.'); });
    return () => { active = false; };
  }, [noteId, canEdit, content]);
  const safe = useMemo(() => {
    const clean = DOMPurify.sanitize(content, { ALLOWED_TAGS: ['div', 'p', 'span', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'code', 'pre', 'blockquote', 'a', 'sub', 'sup', 'img'],
      ALLOWED_ATTR: ['style', 'alt', 'title', 'href', 'start', 'value', 'colspan', 'rowspan', 'width', 'height', 'lang', 'dir'],
      ALLOW_DATA_ATTR: true });
    const document = new DOMParser().parseFromString(clean, 'text/html');
    for (const element of document.body.querySelectorAll('*')) {
      const style = element.getAttribute('style');
      if (style) element.setAttribute('style', style.split(';').filter(declaration =>
        /^(?:color|background-color|font-weight|font-style|font-size|font-family|text-decoration|text-align|margin(?:-(?:left|right|top|bottom))?|padding(?:-(?:left|right|top|bottom))?|width|height|border(?:-collapse)?|vertical-align):\s*[\w\s#.,%"'-]+$/i.test(declaration.trim())).join(';'));
      if (element.tagName === 'A') {
        const href = element.getAttribute('href');
        try { const url = new URL(href || ''); if (!['http:', 'https:', 'mailto:'].includes(url.protocol) || url.username || url.password) element.removeAttribute('href'); }
        catch { element.removeAttribute('href'); }
        element.setAttribute('rel', 'noopener noreferrer');
      }
    }
    return document.body.innerHTML;
  }, [content]);
  useEffect(() => {
    let active = true; const urls: string[] = [];
    const document = new DOMParser().parseFromString(safe, 'text/html');
    const refs = new Set([...document.querySelectorAll('img[data-note-resource], [data-note-file][data-note-resource]')].map(image => image.getAttribute('data-note-resource')));
    // Same-note attachments were authorized by Core, never by an upstream URL.
    const selected = new Map<string, NoteAttachment>();
    for (const file of attachments) if (file.resource_ref && refs.has(file.resource_ref) && file.kind === 'copied' && imageTypes.has(file.mime_type || ''))
      selected.set(file.resource_ref, file);
    queueMicrotask(() => { if (active) setImages({}); });
    void Promise.all([...selected].map(async ([ref, file]) => {
      try {
        const result = await api.getBlob(`/notes/${noteId}/attachments/${file.id}/download`);
        if (!active) return;
        const url = URL.createObjectURL(new Blob([result.blob], { type: file.mime_type! })); urls.push(url);
        setImages(previous => ({ ...previous, [ref]: url }));
      } catch { /* Text/attachments remain readable when an image cannot be fetched. */ }
    }));
    return () => { active = false; for (const url of urls) URL.revokeObjectURL(url); };
  }, [noteId, safe, attachments]);
  const rendered = useMemo(() => {
    const document = new DOMParser().parseFromString(safe, 'text/html');
    for (const file of document.querySelectorAll('[data-note-file][data-note-resource]')) {
      const ref = file.getAttribute('data-note-resource') || '';
      if (!images[ref]) continue;
      const image = document.createElement('img'); image.setAttribute('data-note-resource', ref);
      image.setAttribute('alt', file.textContent || 'Imagen adjunta de OneNote'); file.replaceWith(image);
    }
    for (const image of document.querySelectorAll('img[data-note-resource]')) {
      const url = images[image.getAttribute('data-note-resource') || ''];
      if (url) image.setAttribute('src', url);
      else { const placeholder = document.createElement('span'); placeholder.textContent = '[Imagen no disponible todavía]'; image.replaceWith(placeholder); }
    }
    for (const element of document.querySelectorAll('[data-note-unit-index]')) {
      const unit = editState?.units.find(item => String(item.index) === element.getAttribute('data-note-unit-index'));
      if (canEdit && editState?.enabled && unit && !busy) {
        element.setAttribute('contenteditable', 'true'); element.setAttribute('role', 'textbox');
        element.setAttribute('aria-label', `Texto de OneNote ${unit.index + 1}`);
        element.setAttribute('tabindex', '0'); element.setAttribute('spellcheck', 'true');
        element.classList.add('onenote-editable-text');
      }
    }
    return document.body.innerHTML;
  }, [safe, images, editState, canEdit, busy]);
  async function save(unit: EditableUnit, html: string) {
    if (busy) return;
    const authority = editAuthority.current;
    if (!authority?.enabled || html === unit.value.html) { editAuthority.current = null; setFrozen(null); setEditing(false); return; }
    draft.current = { unit, html }; setBusy(true); setStatus('Guardando en OneNote…');
    try {
      await api.post(`/notes/${noteId}/sync-edit`, { expected_local_revision: authority.local_revision,
        operations: [{ op: 'set_unit', unit_id: unit.id, value: { ...unit.value, html } }] }, { timeout: 150_000 });
      const state = await api.get<ApiResponse<{ state: string }>>(`/notes/${noteId}/sync-state`);
      if (state.data.state !== 'synced') {
        setEditState(previous => previous ? { ...previous, enabled: false } : previous);
        setStatus('El cambio sigue pendiente o tiene un conflicto. No se ha confirmado en OneNote.');
        return;
      }
      await onConfirmed?.();
      draft.current = null; editAuthority.current = null; setFrozen(null); setEditing(false); setStatus('Guardado en OneNote.');
    } catch {
      setEditState(previous => previous ? { ...previous, enabled: false } : previous);
      setStatus('No se pudo confirmar el guardado. Tu texto sigue aquí; recarga el estado antes de volver a guardar.');
    } finally { setBusy(false); }
  }
  return <>
    {canEdit && <p className="text-xs text-[var(--text-dim)]">Haz clic dentro de un párrafo o una medida para editarlo. Se guarda al salir del bloque. Las imágenes, los dibujos y el espacio en blanco no son zonas de escritura.</p>}
    {status && <p role="status" className="text-xs text-[var(--text-dim)]">{status}</p>}
    <section aria-label={`Contenido de ${provider}`} data-note-native-reader={provider.toLowerCase()}
    onFocusCapture={event => {
      if (!(event.target as HTMLElement).closest('[contenteditable="true"]')) return;
      editAuthority.current ??= editState;
      setFrozen(previous => previous ?? rendered); setEditing(true);
    }}
    onBlurCapture={event => {
      const target = (event.target as HTMLElement).closest('[contenteditable="true"][data-note-unit-index]');
      const unit = editAuthority.current?.units.find(item => String(item.index) === target?.getAttribute('data-note-unit-index'));
      if (!target || !unit) return;
      // Browser line-break wrappers are normalized to the native inline contract.
      const document = new DOMParser().parseFromString(target.innerHTML, 'text/html');
      for (const div of [...document.body.querySelectorAll('div')]) div.replaceWith(document.createElement('br'), ...div.childNodes);
      const html = DOMPurify.sanitize(document.body.innerHTML, { ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'span', 'a', 'br', 'sub', 'sup'],
        ALLOWED_ATTR: ['style', 'href', 'lang', 'dir', 'data-id', 'data-tag'], ALLOW_DATA_ATTR: false });
      void save(unit, html);
    }}
    className="my-3 overflow-auto rounded border border-[var(--border)] bg-white p-5 text-sm text-black [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_p]:my-2 [&_img]:max-w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_.onenote-editable-text]:cursor-text [&_.onenote-editable-text:hover]:outline [&_.onenote-editable-text:hover]:outline-1 [&_.onenote-editable-text:hover]:outline-blue-200 [&_.onenote-editable-text:focus]:outline [&_.onenote-editable-text:focus]:outline-2 [&_.onenote-editable-text:focus]:outline-blue-500"
    style={{ contain: 'layout paint', lineHeight: 1.5, flexShrink: 0, pointerEvents: busy ? 'none' : undefined }}>
      <NativeHtml html={editing ? frozen ?? rendered : rendered} />
    </section>
  </>;
}
