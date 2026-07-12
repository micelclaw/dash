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

/**
 * Builds the "Compartir fuera" payload (text + optional native file) for a
 * record, fetching whatever it needs from the Core. Decision (2026-07-08):
 * v1 is TEXT + NATIVE FILES only — no public web links.
 *
 *  - event   → text summary + `.ics`  (recipient's calendar imports it)
 *  - contact → text summary + `.vcf`  (recipient's contacts app imports it)
 *  - photo   → the image file          (a photo IS a Drive file)
 *  - file    → the file itself
 *  - note    → text (title + body)      (no file; no link by decision)
 *  - diary   → text (date + body)
 */

import { api } from '@/services/api';
import type { SharePayload, ShareFile, CalendarFields, ContactFields } from './native-share';
import {
  addToCalendarNative, addToContactsNative, saveToGalleryNative, saveToDownloadsNative,
  openWithNative, openUrl, openMaps, openEmailDraft, downloadFileFallback, hasNativeBridge,
} from './native-share';

interface ApiEnvelope<T> { data: T }

function stripHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent ?? '').trim();
  } catch {
    return html.replace(/<[^>]+>/g, '').trim();
  }
}

function formatEventWhen(startAt?: string, endAt?: string | null, allDay?: boolean): string {
  if (!startAt) return '';
  const start = new Date(startAt);
  if (allDay) return start.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
  const s = start.toLocaleString('es-ES', opts);
  if (endAt) {
    const end = new Date(endAt);
    return `${s} – ${end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return s;
}

async function fileFromEndpoint(path: string, fallbackName: string): Promise<ShareFile> {
  const { blob, filename, mime } = await api.getBlob(path);
  return { blob, name: filename ?? fallbackName, mime };
}

/** Normalize an entity type to the shape used for sharing (photo is a file). */
export function shareTargetType(entityType: string): string {
  return entityType === 'photo' ? 'file' : entityType;
}

export async function buildSharePayload(entityType: string, id: string, fallbackTitle?: string): Promise<SharePayload> {
  switch (entityType) {
    case 'note': {
      const res = await api.get<ApiEnvelope<{ title: string | null; content: string; content_format?: string }>>(`/notes/${id}`);
      const n = res.data;
      const body = n.content_format === 'html' ? stripHtml(n.content) : n.content;
      const title = n.title || fallbackTitle || 'Nota';
      return { title, text: `${title}\n\n${body}`.trim() };
    }
    case 'diary_entry': {
      const res = await api.get<ApiEnvelope<{ entry_date: string; content: string }>>(`/diary/${id}`);
      const d = res.data;
      const when = d.entry_date ? new Date(d.entry_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      return { title: when || 'Diario', text: `${when}\n\n${d.content}`.trim() };
    }
    case 'event': {
      const res = await api.get<ApiEnvelope<{ title: string; start_at?: string; end_at?: string | null; all_day?: boolean; location?: string | null }>>(`/events/${id}`);
      const ev = res.data;
      const title = ev.title || fallbackTitle || 'Evento';
      const parts = [title, formatEventWhen(ev.start_at, ev.end_at, ev.all_day)];
      if (ev.location) parts.push(`📍 ${ev.location}`);
      const file = await fileFromEndpoint(`/events/${id}/ics`, `${title}.ics`);
      return { title, text: parts.filter(Boolean).join('\n'), file };
    }
    case 'contact': {
      const res = await api.get<ApiEnvelope<{ display_name: string; phones?: { number?: string }[]; emails?: { address?: string }[] }>>(`/contacts/${id}`);
      const c = res.data;
      const title = c.display_name || fallbackTitle || 'Contacto';
      const lines = [title];
      for (const p of c.phones ?? []) if (p.number) lines.push(`📞 ${p.number}`);
      for (const e of c.emails ?? []) if (e.address) lines.push(`✉️ ${e.address}`);
      const file = await fileFromEndpoint(`/contacts/${id}/vcf`, `${title}.vcf`);
      return { title, text: lines.join('\n'), file };
    }
    case 'photo':
    case 'file': {
      // A photo is a Drive file; share the actual bytes.
      let name = fallbackTitle || 'archivo';
      try {
        const res = await api.get<ApiEnvelope<{ filename?: string }>>(`/files/${id}`);
        if (res.data?.filename) name = res.data.filename;
      } catch { /* metadata optional; getBlob still yields a name */ }
      const file = await fileFromEndpoint(`/files/${id}/download`, name);
      return { title: file.name, text: file.name, file };
    }
    case 'book': {
      const file = await fileFromEndpoint(`/books/${id}/file`, `${fallbackTitle || 'libro'}.epub`);
      return { title: fallbackTitle || file.name, text: fallbackTitle || file.name, file };
    }
    case 'bookmark':
    case 'feed':
    case 'article': {
      const url = await getRecordUrl(entityType, id);
      const title = fallbackTitle || url || 'Enlace';
      return { title, text: url ? `${title}\n${url}` : title };
    }
    case 'email': {
      // El dominio email usa body_plain/body_html (no body_text/snippet).
      const res = await api.get<ApiEnvelope<{ subject?: string; body_plain?: string; body_html?: string }>>(`/emails/${id}`);
      const e = res.data;
      const subject = e.subject || fallbackTitle || 'Correo';
      const body = e.body_plain || (e.body_html ? stripHtml(e.body_html) : '') || '';
      return { title: subject, text: `${subject}\n\n${body}`.trim() };
    }
    default: {
      const title = fallbackTitle || 'Registro';
      return { title, text: title };
    }
  }
}

/**
 * Payload multi-fichero para "Compartir fuera" con varias fotos/archivos a la vez.
 * Reutiliza buildSharePayload por id (mismo camino que el share de 1 registro:
 * 'photo'/'file' bajan los bytes) y agrega los `file` en `files`. Los ids que no
 * producen fichero nativo (o fallan, p.ej. una carpeta) se omiten sin romper el resto.
 */
export async function buildMultiSharePayload(entityType: string, ids: string[], fallbackTitle?: string): Promise<SharePayload> {
  const files: ShareFile[] = [];
  for (const id of ids) {
    try {
      const single = await buildSharePayload(entityType, id);
      if (single.file) files.push(single.file);
    } catch { /* omite el que no se pueda descargar (p.ej. una carpeta) */ }
  }
  const title = fallbackTitle
    || (files.length === 1 ? files[0]!.name : files.length ? `${files.length} archivos` : 'Compartir');
  return { title, text: title, files };
}

// ─── Segunda acción por tipo (v2) ────────────────────────────────────────────

export type SecondActionKind =
  | 'calendar' | 'contacts' | 'gallery' | 'downloads' | 'openWith'
  | 'openUrl' | 'maps' | 'emailDraft' | 'saveText';

/** Pistas que el caller (que ya tiene el registro) pasa para decidir/ejecutar acciones sin refetch. */
export interface ShareMeta { mime?: string; url?: string; location?: string; isDirectory?: boolean }

export interface SecondAction { kind: SecondActionKind; label: string }

/** MIME que tiene un visor nativo típico (documentos/pdf/media/epub) → "Abrir con". */
function isOpenableMime(mime: string): boolean {
  return /^(application\/pdf|application\/epub|text\/|audio\/|video\/)/.test(mime)
    || /(word|excel|powerpoint|opendocument|ms-office|officedocument|rtf|csv)/i.test(mime);
}

/** Tipos que el share INTERNO (POST /shares, VALID_TARGET_TYPES) acepta hoy. */
const INTERNAL_TARGETS = new Set(['note', 'event', 'contact', 'email', 'file', 'photo', 'album', 'diary_entry', 'kanban_board']);
export function canShareInternal(entityType: string): boolean {
  return INTERNAL_TARGETS.has(entityType);
}

/** Segundas acciones (además de "Compartir/Enviar") según tipo + hints del registro. */
export function resolveSecondActions(entityType: string, meta?: ShareMeta): SecondAction[] {
  const mime = meta?.mime ?? '';
  const out: SecondAction[] = [];
  switch (entityType) {
    case 'event':
      out.push({ kind: 'calendar', label: 'Añadir a mi calendario' });
      if (meta?.location) out.push({ kind: 'maps', label: 'Abrir ubicación en Maps' });
      break;
    case 'contact':
      out.push({ kind: 'contacts', label: 'Guardar en mis contactos' });
      if (meta?.location) out.push({ kind: 'maps', label: 'Abrir dirección en Maps' });
      break;
    case 'photo':
      out.push({ kind: 'gallery', label: 'Guardar en la galería' });
      break;
    case 'book':
      out.push({ kind: 'openWith', label: 'Abrir con el lector' });
      break;
    case 'bookmark':
    case 'feed':
    case 'article':
      out.push({ kind: 'openUrl', label: 'Abrir en el navegador' });
      break;
    case 'email':
      out.push({ kind: 'emailDraft', label: 'Abrir como borrador' });
      break;
    case 'note':
    case 'diary_entry':
      out.push({ kind: 'saveText', label: 'Guardar como texto' });
      break;
    case 'file':
      if (mime.startsWith('image/')) out.push({ kind: 'gallery', label: 'Guardar en la galería' });
      else if (isOpenableMime(mime)) out.push({ kind: 'openWith', label: 'Abrir con…' });
      else out.push({ kind: 'downloads', label: 'Guardar en Descargas' });
      break;
    default:
      break;
  }
  return out;
}

// ─── Builders para las acciones nativas ──────────────────────────────────────

export async function buildCalendarFields(id: string): Promise<CalendarFields> {
  const res = await api.get<ApiEnvelope<{ title: string; start_at?: string; end_at?: string | null; all_day?: boolean; location?: string | null; description?: string | null }>>(`/events/${id}`);
  const ev = res.data;
  return {
    title: ev.title || 'Evento',
    beginMs: ev.start_at ? new Date(ev.start_at).getTime() : Date.now(),
    endMs: ev.end_at ? new Date(ev.end_at).getTime() : undefined,
    allDay: !!ev.all_day,
    location: ev.location ?? undefined,
    description: ev.description ?? undefined,
  };
}

export async function buildContactFields(id: string): Promise<ContactFields> {
  const res = await api.get<ApiEnvelope<{ display_name: string; phones?: { number?: string }[]; emails?: { address?: string }[] }>>(`/contacts/${id}`);
  const c = res.data;
  return {
    name: c.display_name || 'Contacto',
    phone: c.phones?.find(p => p.number)?.number,
    email: c.emails?.find(e => e.address)?.address,
  };
}

/** Query de ubicación para Maps (evento.location / dirección de contacto / inventory.location). */
export async function getLocationQuery(entityType: string, id: string): Promise<string | null> {
  try {
    if (entityType === 'event') {
      const res = await api.get<ApiEnvelope<{ location?: string | null }>>(`/events/${id}`);
      return res.data.location || null;
    }
    if (entityType === 'contact') {
      const res = await api.get<ApiEnvelope<{ addresses?: unknown }>>(`/contacts/${id}`);
      const addrs = res.data.addresses;
      if (Array.isArray(addrs) && addrs.length) {
        const a = addrs[0] as Record<string, unknown>;
        return [a.street, a.city, a.region, a.postal_code, a.country].filter(Boolean).join(', ') || null;
      }
      return null;
    }
    if (entityType === 'inventory') {
      const res = await api.get<ApiEnvelope<{ location?: string | null }>>(`/inventory/${id}`);
      return res.data.location || null;
    }
  } catch { /* sin ubicación */ }
  return null;
}

/** URL de un marcador / feed / artículo (para "Abrir en el navegador" y para el texto de Enviar). */
export async function getRecordUrl(entityType: string, id: string): Promise<string | null> {
  try {
    const path = entityType === 'bookmark' ? `/bookmarks/${id}`
      : entityType === 'feed' ? `/feeds/${id}`
      : entityType === 'article' ? `/feeds/articles/${id}`
      : null;
    if (!path) return null;
    // Campos semánticos por dominio: bookmark→url, feed→site_url/feed_url, artículo→url/link.
    const res = await api.get<ApiEnvelope<{ url?: string; link?: string; site_url?: string; feed_url?: string }>>(path);
    return res.data.url ?? res.data.link ?? res.data.site_url ?? res.data.feed_url ?? null;
  } catch { return null; }
}

/** Baja el fichero nativo del registro (para gallery/downloads/openWith): file/photo o book. */
export async function getShareFile(entityType: string, id: string, fallbackName?: string): Promise<ShareFile> {
  if (entityType === 'book') return fileFromEndpoint(`/books/${id}/file`, `${fallbackName || 'libro'}.epub`);
  return fileFromEndpoint(`/files/${id}/download`, fallbackName || 'archivo');
}

/** Envuelve un texto como fichero .txt (para "Guardar como texto" de notas/diario). */
export function textToFile(text: string, name: string): ShareFile {
  const safe = name.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'texto';
  return { blob: new Blob([text], { type: 'text/plain' }), name: safe.endsWith('.txt') ? safe : `${safe}.txt`, mime: 'text/plain' };
}

/**
 * Ejecuta una segunda acción (nativa en el APK; fallback web si no hay puente).
 * Lanza Error con mensaje legible en los casos "sin ubicación / sin enlace".
 * Reutilizable por EntityShareModal y por el ShareModal de Drive.
 */
export async function executeSecondAction(
  kind: SecondActionKind,
  entityType: string,
  id: string,
  title: string,
  meta?: ShareMeta,
): Promise<void> {
  switch (kind) {
    case 'calendar': {
      const f = await buildCalendarFields(id);
      if (!addToCalendarNative(f)) {
        const ics = await api.getBlob(`/events/${id}/ics`);
        downloadFileFallback({ blob: ics.blob, name: ics.filename ?? `${f.title}.ics`, mime: ics.mime });
      }
      return;
    }
    case 'contacts': {
      const f = await buildContactFields(id);
      if (!addToContactsNative(f)) {
        const vcf = await api.getBlob(`/contacts/${id}/vcf`);
        downloadFileFallback({ blob: vcf.blob, name: vcf.filename ?? `${f.name}.vcf`, mime: vcf.mime });
      }
      return;
    }
    case 'maps': {
      const q = meta?.location ?? await getLocationQuery(entityType, id);
      if (!q) throw new Error('Este registro no tiene ubicación');
      openMaps(q);
      return;
    }
    case 'openUrl': {
      const url = meta?.url ?? await getRecordUrl(entityType, id);
      if (!url) throw new Error('No se encontró el enlace');
      openUrl(url);
      return;
    }
    case 'gallery': {
      const file = await getShareFile(entityType, id, title);
      if (await saveToGalleryNative(file)) return;
      if (hasNativeBridge()) throw new Error('No se pudo guardar en la galería');
      downloadFileFallback(file);
      return;
    }
    case 'downloads': {
      const file = await getShareFile(entityType, id, title);
      if (await saveToDownloadsNative(file)) return;
      if (hasNativeBridge()) throw new Error('No se pudo guardar en Descargas');
      downloadFileFallback(file);
      return;
    }
    case 'openWith': {
      const file = await getShareFile(entityType, id, title);
      if (await openWithNative(file)) return;
      if (hasNativeBridge()) throw new Error('No se pudo abrir el archivo en el móvil');
      downloadFileFallback(file);
      return;
    }
    case 'saveText': {
      const payload = await buildSharePayload(entityType, id, title);
      const f = textToFile(payload.text, title || 'nota');
      if (await saveToDownloadsNative(f)) return;
      if (hasNativeBridge()) throw new Error('No se pudo guardar el texto en Descargas');
      downloadFileFallback(f);
      return;
    }
    case 'emailDraft': {
      // El dominio email usa body_plain/body_html (no body_text/snippet).
      const res = await api.get<ApiEnvelope<{ subject?: string; body_plain?: string; body_html?: string }>>(`/emails/${id}`);
      const body = res.data.body_plain || (res.data.body_html ? stripHtml(res.data.body_html) : '') || '';
      openEmailDraft({ subject: res.data.subject, body });
      return;
    }
  }
}
