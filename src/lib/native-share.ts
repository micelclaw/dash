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
 * "Compartir fuera" — bridge to the platform share sheet.
 *
 * The channels (Telegram / WhatsApp / email / …) are NOT integrations we build:
 * they are the native Android share intent. We only produce the CONTENT (text +
 * optional native file) and the OS shows whichever installed apps handle it.
 *
 * Three environments, one entry point:
 *  - APK (Capacitor WebView) → the natively-registered `Share` plugin resolved via
 *    `window.Capacitor.registerPlugin('Share')` (the dash is loaded remotely and does
 *    NOT bundle @capacitor/share, so `Plugins.Share` is undefined — we register on
 *    demand). `Filesystem` stages the file blob to a cache URI (Share requires a URI).
 *  - PWA / Android Chrome → Web Share API (`navigator.share`, with `files` when
 *    `navigator.canShare` allows).
 *  - Desktop / no share API → fallback: copy text to clipboard + download the file.
 */

import { toast } from 'sonner';

export interface ShareFile {
  blob: Blob;
  name: string;
  mime: string;
}

export interface SharePayload {
  title?: string;
  text: string;
  file?: ShareFile;
  /** Multi-fichero (compartir varias fotos/archivos a la vez). Cuando trae 2+
      ficheros tiene prioridad sobre `file` en las tres vías de compartir. */
  files?: ShareFile[];
}

export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'error';

// Minimal typing for the Capacitor globals injected into the WebView by the APK.
interface SharePlugin {
  share: (opts: { title?: string; text?: string; url?: string; files?: string[]; dialogTitle?: string }) => Promise<unknown>;
}
interface FilesystemPlugin {
  writeFile: (opts: { path: string; data: string; directory: string }) => Promise<unknown>;
  getUri: (opts: { path: string; directory: string }) => Promise<{ uri: string }>;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
  // Core bridge function — creates a proxy to a natively-registered plugin even
  // when the JS package was never imported (which is our case: the dash is loaded
  // remotely into the APK WebView and does NOT bundle @capacitor/share). This is
  // why `Plugins.Share` is undefined here and we must register on demand.
  registerPlugin?: <T>(name: string) => T;
}

function cap(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/**
 * Puente nativo que el envoltorio APK inyecta en el WebView del dash vía
 * `addJavascriptInterface` (MainActivity.java). Es la vía PRINCIPAL en el APK,
 * porque `window.Capacitor` es undefined en el dash cargado en remoto. Recibe un
 * JSON string y abre el share sheet de Android.
 */
interface NativeBridge {
  share: (payloadJson: string) => string | undefined;
  // Compartir VARIOS ficheros a la vez (ACTION_SEND_MULTIPLE). Opcional: un APK
  // viejo no la tiene → el caller cae a compartir el primero por `share`.
  shareMulti?: (payloadJson: string) => string | undefined;
  // Acciones nativas v2 (segunda acción por tipo). Opcionales: un APK viejo puede no tenerlas.
  addToCalendar?: (json: string) => string | undefined;
  addToContacts?: (json: string) => string | undefined;
  openFile?: (json: string) => string | undefined;
  saveToGallery?: (json: string) => string | undefined;
  saveToDownloads?: (json: string) => string | undefined;
  openUrl?: (json: string) => string | undefined;
  openMaps?: (json: string) => string | undefined;
  openEmailDraft?: (json: string) => string | undefined;
}
function nativeBridge(): NativeBridge | undefined {
  const b = (window as unknown as { MicelclawNative?: NativeBridge }).MicelclawNative;
  return b && typeof b.share === 'function' ? b : undefined;
}

/** Resolve a natively-registered plugin (already-exposed proxy, or create one). Native only. */
function nativePlugin<T>(name: string): T | undefined {
  const c = cap();
  if (!c?.isNativePlatform?.()) return undefined;
  const existing = c.Plugins?.[name] as T | undefined;
  if (existing) return existing;
  try { return c.registerPlugin?.<T>(name); } catch { return undefined; }
}

/** True if any share mechanism (native or web) is available. Text share always works via fallback. */
export function canNativeShare(): boolean {
  if (nativeBridge()) return true;
  if (nativePlugin<SharePlugin>('Share')) return true;
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => {
      const res = String(reader.result);
      // strip the `data:<mime>;base64,` prefix
      resolve(res.slice(res.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(file: ShareFile): void {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  return false;
}

/**
 * Share a payload through the best available mechanism. Never dead-ends:
 * on desktop it copies the text (and downloads the file) and tells the user.
 */
export async function shareNative(payload: SharePayload): Promise<ShareResult> {
  // Normaliza a lista: `files` (multi) tiene prioridad; si no, el `file` único.
  const files: ShareFile[] = payload.files && payload.files.length > 0
    ? payload.files
    : (payload.file ? [payload.file] : []);
  const multi = files.length > 1;

  // 0) Puente nativo del APK (`window.MicelclawNative`, addJavascriptInterface).
  //    Vía PRINCIPAL en el APK: `window.Capacitor` es undefined en el dash remoto.
  const bridge = nativeBridge();
  if (bridge) {
    try {
      if (multi && typeof bridge.shareMulti === 'function') {
        // Varios ficheros → ACTION_SEND_MULTIPLE nativo (arrays paralelos).
        const filesBase64: string[] = [], names: string[] = [], mimes: string[] = [];
        for (const f of files) {
          filesBase64.push(await blobToBase64(f.blob));
          names.push(f.name);
          mimes.push(f.mime);
        }
        const res = bridge.shareMulti(JSON.stringify({
          title: payload.title ?? '', text: payload.text, names, mimes, filesBase64,
        }));
        if (res !== 'error') return 'shared';
      } else {
        // Un solo fichero (o APK viejo sin shareMulti → comparte el primero).
        let fileBase64 = '', fileName = '', mime = '';
        const one = files[0];
        if (one) {
          fileBase64 = await blobToBase64(one.blob);
          fileName = one.name;
          mime = one.mime;
        }
        const res = bridge.share(JSON.stringify({
          title: payload.title ?? '', text: payload.text, fileName, mime, fileBase64,
        }));
        if (res !== 'error') return 'shared';
      }
    } catch { /* cae a las siguientes vías */ }
  }

  // 1) Native APK (Capacitor plugin). Resolve via registerPlugin — Plugins.Share
  //    is NOT auto-exposed to the remotely-loaded dash (queda por si algún día
  //    el bridge de Capacitor sí está presente, p.ej. webDir local).
  const share = nativePlugin<SharePlugin>('Share');
  if (share) {
    try {
      let uris: string[] | undefined;
      const fs = nativePlugin<FilesystemPlugin>('Filesystem');
      if (files.length > 0 && fs) {
        uris = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          const data = await blobToBase64(f.blob);
          // sanitize the filename for a filesystem path (no slashes); en multi
          // prefija el índice para no pisar dos ficheros con el mismo nombre.
          const safe = f.name.replace(/[/\\]+/g, '_');
          const path = multi ? `${i}_${safe}` : safe;
          await fs.writeFile({ path, data, directory: 'CACHE' });
          const { uri } = await fs.getUri({ path, directory: 'CACHE' });
          uris.push(uri);
        }
      }
      await share.share({
        title: payload.title,
        text: payload.text,
        files: uris,
        dialogTitle: payload.title ?? 'Compartir',
      });
      return 'shared';
    } catch (err) {
      // Capacitor throws a rejection with message "Share canceled" when the user dismisses.
      if (err instanceof Error && /cancel/i.test(err.message)) return 'cancelled';
      // fall through to web/fallback
    }
  }

  // 2) Web Share API (PWA / Android Chrome)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (files.length > 0) {
        const fileObjs = files.map(f => new File([f.blob], f.name, { type: f.mime }));
        if (!navigator.canShare || navigator.canShare({ files: fileObjs })) {
          await navigator.share({ title: payload.title, text: payload.text, files: fileObjs });
          return 'shared';
        }
      }
      await navigator.share({ title: payload.title, text: payload.text });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // fall through to fallback
    }
  }

  // 3) Fallback (desktop / unsupported): copy text + download file(s)
  const copied = await copyText(payload.text);
  if (files.length > 0) {
    for (const f of files) downloadBlob(f);
    const many = files.length > 1;
    toast.success(copied
      ? (many ? 'Texto copiado y ficheros descargados' : 'Texto copiado y fichero descargado')
      : (many ? 'Ficheros descargados' : 'Fichero descargado'));
    return copied ? 'copied' : 'downloaded';
  }
  if (copied) {
    toast.success('Texto copiado al portapapeles');
    return 'copied';
  }
  toast.error('No se pudo compartir en este dispositivo');
  return 'error';
}

// ─── Segunda acción nativa (v2) ──────────────────────────────────────────────
// Cada función intenta el puente nativo (APK); devuelve `true` si lo manejó. Si no
// (PWA/escritorio o APK viejo), el CALLER hace el fallback web (descargar el fichero,
// etc.), salvo openUrl/openMaps/openEmailDraft que ya degradan aquí (universal).

export interface CalendarFields {
  title: string; beginMs: number; endMs?: number; allDay?: boolean; location?: string; description?: string;
}
export interface ContactFields { name: string; phone?: string; email?: string }

/** Añadir un evento al calendario nativo (ACTION_INSERT). true si el puente lo manejó. */
export function addToCalendarNative(f: CalendarFields): boolean {
  const b = nativeBridge();
  if (!b?.addToCalendar) return false;
  try { return b.addToCalendar(JSON.stringify(f)) !== 'error'; } catch { return false; }
}

/** Guardar un contacto en la agenda nativa (ACTION_INSERT_OR_EDIT). true si el puente lo manejó. */
export function addToContactsNative(f: ContactFields): boolean {
  const b = nativeBridge();
  if (!b?.addToContacts) return false;
  try { return b.addToContacts(JSON.stringify(f)) !== 'error'; } catch { return false; }
}

async function bridgeFileCall(method: 'saveToGallery' | 'saveToDownloads' | 'openFile', file: ShareFile): Promise<boolean> {
  const b = nativeBridge();
  if (!b || typeof b[method] !== 'function') return false;
  try {
    const data = await blobToBase64(file.blob);
    // CRÍTICO: invocar ADJUNTO al objeto (`b[method](...)`), NO desacoplado
    // (`const fn = b[method]; fn(...)`). En Android WebView un método de
    // addJavascriptInterface llamado sin su receptor pierde el binding del puente
    // Java y falla en silencio → la acción no hacía NADA (ni toast). El resto de
    // métodos (calendar/contacts/url/maps/email) ya llamaban adjuntos, por eso sí iban.
    const res = b[method]!(JSON.stringify({ fileBase64: data, fileName: file.name, mime: file.mime }));
    return res !== 'error';
  } catch { return false; }
}

/** Guardar una imagen en la galería. true si el puente lo manejó. */
export function saveToGalleryNative(file: ShareFile): Promise<boolean> { return bridgeFileCall('saveToGallery', file); }
/** Guardar un fichero en Descargas. true si el puente lo manejó. */
export function saveToDownloadsNative(file: ShareFile): Promise<boolean> { return bridgeFileCall('saveToDownloads', file); }
/** Abrir un fichero con la app nativa que lo maneje (ACTION_VIEW). true si el puente lo manejó. */
export function openWithNative(file: ShareFile): Promise<boolean> { return bridgeFileCall('openFile', file); }

/** Abrir una URL en el navegador (nativo o web). Siempre resuelve. */
export function openUrl(url: string): void {
  const b = nativeBridge();
  if (b?.openUrl) { try { if (b.openUrl(JSON.stringify({ url })) !== 'error') return; } catch { /* fallback */ } }
  window.open(url, '_blank', 'noopener');
}

/** Abrir una ubicación/dirección en Maps (geo: nativo o web). Siempre resuelve. */
export function openMaps(query: string): void {
  const b = nativeBridge();
  if (b?.openMaps) { try { if (b.openMaps(JSON.stringify({ query })) !== 'error') return; } catch { /* fallback */ } }
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener');
}

/** Abrir un borrador de email en la app de correo (mailto). Siempre resuelve. */
export function openEmailDraft(fields: { to?: string; subject?: string; body?: string }): void {
  const b = nativeBridge();
  if (b?.openEmailDraft) { try { if (b.openEmailDraft(JSON.stringify(fields)) !== 'error') return; } catch { /* fallback */ } }
  // mailto sigue RFC 6068 → percent-encoding (RFC 3986). URLSearchParams emite
  // form-urlencoded (espacio → '+'), que los clientes estrictos NO decodifican
  // a espacio → el borrador saldría con signos '+'. Usar encodeURIComponent (→ %20).
  const params: string[] = [];
  if (fields.subject) params.push(`subject=${encodeURIComponent(fields.subject)}`);
  if (fields.body) params.push(`body=${encodeURIComponent(fields.body)}`);
  const q = params.join('&');
  window.location.href = `mailto:${fields.to ?? ''}${q ? `?${q}` : ''}`;
}

/** Descargar un blob (fallback web de gallery/downloads/openWith). Reexport del helper interno. */
export function downloadFileFallback(file: ShareFile): void { downloadBlob(file); }

/** ¿Estamos dentro del APK (puente nativo presente)? Dentro del APK el fallback web
 *  `<a download>` sobre blob: NO funciona (WebView sin DownloadListener) → el caller
 *  debe dar feedback en vez de caer al fallback muerto. */
export function hasNativeBridge(): boolean { return !!nativeBridge(); }
