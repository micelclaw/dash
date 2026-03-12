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

const MIME_ICONS: [string, LucideIcon][] = [
  ['application/vnd.claw.diagram+json', Waypoints],
  ['text/plain', FileText],
  ['text/markdown', FileText],
  ['text/', FileCode],
  ['image/', Image],
  ['video/', Film],
  ['audio/', Music],
  ['application/pdf', FileText],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml', FileSpreadsheet],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml', FileText],
  ['application/vnd.openxmlformats-officedocument.presentationml', Presentation],
  ['application/zip', FileArchive],
  ['application/x-tar', FileArchive],
  ['application/gzip', FileArchive],
];

function getFileIcon(mime: string, isDirectory: boolean): LucideIcon {
  if (isDirectory) return Folder;
  for (const [prefix, icon] of MIME_ICONS) {
    if (mime.startsWith(prefix)) return icon;
  }
  return File;
}

export function FileIcon({ mime, isDirectory, size = 'md' }: FileIconProps) {
  const Icon = getFileIcon(mime, isDirectory);
  const px = SIZE_MAP[size];
  return <Icon size={px} style={{ color: isDirectory ? 'var(--amber)' : 'var(--text-dim)', flexShrink: 0 }} />;
}
