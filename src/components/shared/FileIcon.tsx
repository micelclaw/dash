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

import {
  Folder, File, Image, Film, Music, FileText,
  FileSpreadsheet, FileArchive, FileCode, Presentation, Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FileIconProps {
  mime: string;
  isDirectory: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 16, md: 24, lg: 32 } as const;

// [prefijo mime, icono, color] — colores de la paleta micelclaw (--mod-* del
// sidebar + 3 vars --file-* para los formatos office sin módulo dueño).
// Orden importa: prefijos específicos antes que los catch-all ('text/').
const MIME_ICONS: [string, LucideIcon, string][] = [
  ['application/vnd.claw.diagram+json', Waypoints, 'var(--mod-sketches)'],
  ['text/markdown', FileText, 'var(--mod-notes)'],
  ['text/plain', FileText, 'var(--mod-notes)'],
  ['text/csv', FileSpreadsheet, 'var(--file-sheet)'],
  ['text/', FileCode, 'var(--mod-tools)'],
  ['application/json', FileCode, 'var(--mod-tools)'],
  ['application/xml', FileCode, 'var(--mod-tools)'],
  ['image/', Image, 'var(--mod-photos)'],
  ['video/', Film, 'var(--mod-multimedia)'],
  ['audio/', Music, 'var(--file-audio)'],
  ['application/pdf', FileText, 'var(--mod-office)'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml', FileSpreadsheet, 'var(--file-sheet)'],
  ['application/vnd.ms-excel', FileSpreadsheet, 'var(--file-sheet)'],
  ['application/vnd.oasis.opendocument.spreadsheet', FileSpreadsheet, 'var(--file-sheet)'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml', FileText, 'var(--file-doc)'],
  ['application/vnd.oasis.opendocument.text', FileText, 'var(--file-doc)'],
  ['application/msword', FileText, 'var(--file-doc)'],
  ['application/rtf', FileText, 'var(--file-doc)'],
  ['application/vnd.openxmlformats-officedocument.presentationml', Presentation, 'var(--file-slides)'],
  ['application/vnd.oasis.opendocument.presentation', Presentation, 'var(--file-slides)'],
  ['application/zip', FileArchive, 'var(--mod-inventory)'],
  ['application/x-tar', FileArchive, 'var(--mod-inventory)'],
  ['application/gzip', FileArchive, 'var(--mod-inventory)'],
  ['application/x-7z-compressed', FileArchive, 'var(--mod-inventory)'],
  ['application/x-rar-compressed', FileArchive, 'var(--mod-inventory)'],
];

/**
 * Resuelve [Icono, color] de un archivo por su mime (o carpeta). FUENTE ÚNICA
 * de la metadata visual de archivos — reutilizada por el resolver de entidades
 * (entity-refs.ts) para que search/chips/menciones pinten los archivos igual
 * que Drive/File Explorer. Añadir un mime nuevo = una edición en MIME_ICONS.
 */
export function getFileIconEntry(mime: string, isDirectory: boolean): [LucideIcon, string] {
  if (isDirectory) return [Folder, 'var(--amber)'];
  for (const [prefix, icon, color] of MIME_ICONS) {
    if (mime.startsWith(prefix)) return [icon, color];
  }
  return [File, 'var(--text-dim)'];
}

export function FileIcon({ mime, isDirectory, size = 'md' }: FileIconProps) {
  const [Icon, color] = getFileIconEntry(mime, isDirectory);
  const px = SIZE_MAP[size];
  return <Icon size={px} style={{ color, flexShrink: 0 }} />;
}
