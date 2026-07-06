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

import { useAuthStore } from '@/stores/auth.store';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i > 0 ? filename.slice(i + 1).toLowerCase() : '';
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

export function isVideoMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('video/');
}

export function isPreviewable(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return isImageMime(mime) || mime === 'application/pdf' || mime.startsWith('text/');
}

/**
 * ¿Es un documento (PDF/DOCX/PPTX/XLSX/ODF) del que el backend puede generar
 * una miniatura de la 1ª página? Debe coincidir con `docThumbnailKind` del Core
 * (`thumbnail.service.ts`). Las imágenes NO entran aquí (ya tienen su camino).
 */
export function isDocPreviewable(mime: string | null | undefined): boolean {
  if (!mime) return false;
  if (mime === 'application/pdf') return true;
  return /wordprocessing|ms-?word|msword|opendocument\.text|presentation|ms-?powerpoint|spreadsheet|ms-?excel/i.test(mime);
}

/**
 * ¿Tiene el fichero una previsualización server-side (thumbnail cacheado vía
 * `/files/:id/preview`)? Imagen (directo) o documento (generado on-demand).
 */
export function hasServerPreview(mime: string | null | undefined): boolean {
  return isImageMime(mime) || isDocPreviewable(mime);
}

const FILE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Puede este registro mostrar miniatura real (para gatear el grid)? Imágenes
 * y PDF siempre (indexados por UUID o VFS por ruta); office solo indexados —
 * el office VFS no tiene conversión y quedaría en icono dentro de una caja.
 */
export function canShowThumbnail(id: string, mime: string | null | undefined): boolean {
  if (!mime) return false;
  if (isImageMime(mime) || mime === 'application/pdf') return true;
  return FILE_UUID_RE.test(id) && isDocPreviewable(mime);
}

export function getMimeLabel(mime: string | null | undefined): string {
  if (!mime) return 'File';
  if (mime === 'inode/directory') return 'Folder';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('spreadsheet')) return 'Spreadsheet';
  if (mime.includes('wordprocessing')) return 'Document';
  if (mime.includes('presentation')) return 'Presentation';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return 'Archive';
  if (mime === 'text/markdown') return 'Markdown';
  if (mime.startsWith('text/')) return 'Text';
  return 'File';
}

/**
 * Build an authenticated preview URL for use in <img src>.
 * `noWait`: el server responde 404 inmediato para documentos pendientes en vez
 * de retener la conexión ~1.5s (celdas del grid — no envenenar el pool HTTP/1.1).
 */
export function getPreviewUrl(fileId: string, width?: number, noWait?: boolean): string {
  const token = useAuthStore.getState().tokens?.accessToken;
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (width) params.set('width', String(width));
  if (noWait) params.set('wait', '0');
  return `/api/v1/files/${fileId}/preview?${params.toString()}`;
}

/**
 * Preview URL for a VFS file (File Explorer) addressed by PATH, not UUID.
 * Backed by `GET /vfs/preview` (cached webp; images + PDF first page).
 */
export function getVfsPreviewUrl(vfsPath: string, width?: number): string {
  const token = useAuthStore.getState().tokens?.accessToken;
  const params = new URLSearchParams();
  params.set('path', vfsPath);
  if (token) params.set('token', token);
  if (width) params.set('width', String(width));
  return `/api/v1/vfs/preview?${params.toString()}`;
}

/** Build an authenticated face crop URL for a cluster avatar. */
export function getFaceCropUrl(clusterId: string): string {
  const token = useAuthStore.getState().tokens?.accessToken;
  return `/api/v1/photos/faces/${clusterId}/crop?token=${token}`;
}

/** Simple numeric hash from a string (for gradient placeholders) */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
