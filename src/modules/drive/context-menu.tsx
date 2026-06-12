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
  FolderOpen, Eye, ExternalLink, Download, Star, StarOff, Share2, Link2, Globe,
  UserPlus, Mail, Scissors, Copy, ClipboardPaste, FolderInput, FolderPlus,
  CopyPlus, Pencil, Tags, History, Trash2, RotateCcw, X, Info, FileText, Play,
  ListPlus, Upload, PenTool,
} from 'lucide-react';
import type { NavigateFunction } from 'react-router';
import { usePlayerStore } from '@/stores/player.store';
import { api } from '@/services/api';
import { downloadFile, downloadBatch } from '@/lib/file-download';
import type { FileRecord } from '@/types/files';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import type { DriveTab } from '@/stores/drive.store';

// ─── Mime helpers (extracted from the old inline menus in DriveList/DriveGrid) ───

export function isOfficeFile(file: FileRecord): boolean {
  return /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv)$/i.test(file.filename)
    || !!file.mime_type?.startsWith('application/vnd.openxmlformats-officedocument')
    || !!file.mime_type?.startsWith('application/vnd.ms-')
    || !!file.mime_type?.startsWith('application/vnd.oasis.opendocument');
}

export const isPdfFile = (f: FileRecord) => f.mime_type === 'application/pdf';
export const isAudioFile = (f: FileRecord) => !!f.mime_type?.startsWith('audio/');
export const isVideoFile = (f: FileRecord) => !!f.mime_type?.startsWith('video/');
export const isDiagramFile = (f: FileRecord) => f.mime_type === 'application/vnd.claw.diagram+json';

/** Mimes the inline text viewer (D6) can show via GET /files/:id/content. */
export const isTextPreviewable = (f: FileRecord) =>
  !!f.mime_type?.startsWith('text/')
  || f.mime_type === 'application/json'
  || f.mime_type === 'application/xml';

/** Start audio/video playback in the global player (same flow the old inline menu used). */
export async function playFromDrive(file: FileRecord): Promise<void> {
  const isVideo = isVideoFile(file);
  let title = file.filename;
  let artist: string | undefined;
  let coverBase64: string | undefined;
  try {
    const info = await api.get<{ data: { title: string; artist: string | null; coverBase64: string | null } }>(`/files/${file.id}/media-info`);
    title = info.data.title || file.filename;
    artist = info.data.artist || undefined;
    coverBase64 = info.data.coverBase64 || undefined;
  } catch { /* use filename */ }
  const item = {
    fileId: file.id, title, artist, coverBase64,
    streamUrl: `/files/${file.id}/stream`,
    mediaType: (isVideo ? 'video' : 'audio') as 'audio' | 'video',
  };
  if (isVideo) usePlayerStore.getState().playVideo(item);
  else usePlayerStore.getState().playAudio(item);
}

// ─── Context types ───────────────────────────────────────

export interface DriveMenuCallbacks {
  /** Open a folder (navigate into it). */
  onOpen?: (file: FileRecord) => void;
  /** Preview / properties of a file (select → preview panel). */
  onPreview?: (file: FileRecord) => void;
  /** Override the default download (single → file, multi → zip). */
  onDownload?: (files: FileRecord[]) => void;
  /** Set the star state of one-or-many files. `starred` is the DESIRED state. */
  onToggleStar?: (files: FileRecord[], starred: boolean) => void;
  /** Public link → shared ShareModal. */
  onShare?: (file: FileRecord) => void;
  /** Internal user share → ShareWithUserModal. */
  onShareUser?: (files: FileRecord[]) => void;
  /** Public link sent by email → ShareEmailModal. */
  onShareEmail?: (file: FileRecord) => void;
  onCut?: (files: FileRecord[]) => void;
  onCopy?: (files: FileRecord[]) => void;
  /** Paste clipboard. `destFolder` set when invoked over a folder row; undefined = current folder. */
  onPaste?: (destFolder?: FileRecord) => void;
  onMoveTo?: (files: FileRecord[]) => void;
  onCopyTo?: (files: FileRecord[]) => void;
  onRename?: (file: FileRecord) => void;
  onTags?: (files: FileRecord[]) => void;
  onVersions?: (file: FileRecord) => void;
  onDelete?: (files: FileRecord[]) => void;
  // Trash-only
  onRestore?: (files: FileRecord[]) => void;
  onDeleteForever?: (files: FileRecord[]) => void;
  // Background-only
  onNewFolder?: () => void;
  onUpload?: () => void;
}

export interface DriveMenuContext {
  tab: DriveTab;
  clipboard: { operation: 'copy' | 'cut' | null; fileIds: string[] };
  navigate: NavigateFunction;
  callbacks: DriveMenuCallbacks;
}

// ─── Builders ────────────────────────────────────────────

const sep = (): ContextMenuItem => ({ label: '', separator: true, onClick: () => {} });

function defaultDownload(files: FileRecord[]): void {
  if (files.length === 1) {
    const f = files[0]!;
    void downloadFile(f.id, f.is_directory ? `${f.filename}.zip` : f.filename);
  } else {
    void downloadBatch(files.map(f => f.id));
  }
}

/** "Open with" submenu entries for a single file, derived from its mime. */
function buildOpenWithItems(file: FileRecord, ctx: DriveMenuContext): ContextMenuItem[] {
  const { navigate } = ctx;
  const items: ContextMenuItem[] = [];
  if (isAudioFile(file)) {
    items.push(
      { label: 'Play', icon: Play, onClick: () => { void playFromDrive(file); } },
      { label: 'Add to queue', icon: ListPlus, onClick: () => {
        usePlayerStore.getState().addToQueue({
          fileId: file.id, title: file.filename,
          streamUrl: `/files/${file.id}/stream`, mediaType: 'audio' as const,
        });
      } },
    );
  }
  if (isVideoFile(file)) {
    items.push({ label: 'Play video', icon: Play, onClick: () => { void playFromDrive(file); } });
  }
  if (isOfficeFile(file)) {
    items.push({ label: 'Office', icon: FileText, onClick: () => navigate(`/office/edit/${file.id}`) });
  }
  if (isPdfFile(file)) {
    items.push({ label: 'PDF Viewer', icon: FileText, onClick: () => navigate(`/office/pdf/${file.id}`) });
  }
  if (isDiagramFile(file)) {
    items.push({ label: 'Sketches', icon: PenTool, onClick: () => navigate(`/sketches/${file.id}`) });
  }
  return items;
}

function buildTrashMenu(files: FileRecord[], ctx: DriveMenuContext): ContextMenuItem[] {
  const cb = ctx.callbacks;
  const n = files.length;
  const suffix = n > 1 ? ` (${n})` : '';
  return [
    ...(cb.onRestore ? [{ label: `Restore${suffix}`, icon: RotateCcw, onClick: () => cb.onRestore!(files) }] : []),
    sep(),
    ...(cb.onDeleteForever ? [{
      label: `Delete forever${suffix}`, icon: X, variant: 'danger' as const,
      onClick: () => cb.onDeleteForever!(files),
    }] : []),
  ];
}

function buildMultiMenu(files: FileRecord[], ctx: DriveMenuContext): ContextMenuItem[] {
  const cb = ctx.callbacks;
  const n = files.length;
  const allStarred = files.every(f => f.starred);
  const items: ContextMenuItem[] = [];

  items.push({
    label: `Download (${n})`, icon: Download,
    onClick: () => (cb.onDownload ?? defaultDownload)(files),
  });
  if (cb.onToggleStar) {
    items.push(allStarred
      ? { label: `Unstar (${n})`, icon: StarOff, onClick: () => cb.onToggleStar!(files, false) }
      : { label: `Star (${n})`, icon: Star, onClick: () => cb.onToggleStar!(files, true) });
  }
  if (cb.onTags) {
    items.push({ label: 'Tags…', icon: Tags, onClick: () => cb.onTags!(files) });
  }
  if (cb.onShareUser) {
    items.push({ label: 'Share with user…', icon: UserPlus, onClick: () => cb.onShareUser!(files) });
  }
  items.push(sep());
  if (cb.onCut) items.push({ label: `Cut (${n})`, icon: Scissors, shortcut: 'Ctrl+X', onClick: () => cb.onCut!(files) });
  if (cb.onCopy) items.push({ label: `Copy (${n})`, icon: Copy, shortcut: 'Ctrl+C', onClick: () => cb.onCopy!(files) });
  if (cb.onMoveTo) items.push({ label: 'Move to…', icon: FolderInput, onClick: () => cb.onMoveTo!(files) });
  if (cb.onCopyTo) items.push({ label: 'Copy to…', icon: CopyPlus, onClick: () => cb.onCopyTo!(files) });
  if (cb.onDelete) {
    items.push(sep());
    items.push({
      label: `Delete (${n})`, icon: Trash2, shortcut: 'Del', variant: 'danger',
      onClick: () => cb.onDelete!(files),
    });
  }
  return items;
}

function buildSingleMenu(file: FileRecord, ctx: DriveMenuContext): ContextMenuItem[] {
  const cb = ctx.callbacks;
  const isDir = file.is_directory;
  const hasClipboard = ctx.clipboard.operation !== null && ctx.clipboard.fileIds.length > 0;
  const items: ContextMenuItem[] = [];

  // Open: folder → navigate; file → the view's open dispatcher (D6: lightbox /
  // text viewer / PDF / player by mime), falling back to preview/properties.
  if (isDir && cb.onOpen) {
    items.push({ label: 'Open', icon: FolderOpen, shortcut: 'Enter', onClick: () => cb.onOpen!(file) });
  } else if (!isDir && (cb.onOpen || cb.onPreview)) {
    items.push({
      label: 'Open', icon: Eye, shortcut: 'Enter',
      onClick: () => (cb.onOpen ?? cb.onPreview)!(file),
    });
  }

  // Open with ▶ (mime-dependent)
  if (!isDir) {
    const openWith = buildOpenWithItems(file, ctx);
    if (openWith.length > 0) {
      items.push({ label: 'Open with', icon: ExternalLink, onClick: () => {}, subItems: openWith });
    }
  }

  items.push(sep());

  items.push({
    label: 'Download', icon: Download,
    onClick: () => (cb.onDownload ?? defaultDownload)([file]),
  });

  if (cb.onToggleStar) {
    items.push(file.starred
      ? { label: 'Unstar', icon: StarOff, onClick: () => cb.onToggleStar!([file], false) }
      : { label: 'Star', icon: Star, onClick: () => cb.onToggleStar!([file], true) });
  }

  // Share ▶ — public link / internal user / by email / copy path.
  // Public link + email only for files (folders can't be served via link yet);
  // internal user shares work for folders too.
  const shareSub: ContextMenuItem[] = [
    ...(!isDir && cb.onShare ? [{ label: 'Public link…', icon: Globe, onClick: () => cb.onShare!(file) }] : []),
    ...(cb.onShareUser ? [{ label: 'With user…', icon: UserPlus, onClick: () => cb.onShareUser!([file]) }] : []),
    ...(!isDir && cb.onShareEmail ? [{ label: 'By email…', icon: Mail, onClick: () => cb.onShareEmail!(file) }] : []),
    ...(!isDir ? [{ label: 'Copy link', icon: Link2, onClick: () => { void navigator.clipboard.writeText(file.filepath); } }] : []),
  ];
  if (shareSub.length > 0) {
    items.push({ label: 'Share', icon: Share2, onClick: () => {}, subItems: shareSub });
  }

  items.push(sep());

  if (cb.onCut) items.push({ label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', onClick: () => cb.onCut!([file]) });
  if (cb.onCopy) items.push({ label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', onClick: () => cb.onCopy!([file]) });
  // Paste only over folders (paste INTO the folder) — background paste lives in the background menu.
  if (isDir && cb.onPaste) {
    items.push({
      label: 'Paste into folder', icon: ClipboardPaste, shortcut: 'Ctrl+V',
      disabled: !hasClipboard,
      onClick: () => cb.onPaste!(file),
    });
  }
  if (cb.onMoveTo) items.push({ label: 'Move to…', icon: FolderInput, onClick: () => cb.onMoveTo!([file]) });
  if (cb.onCopyTo) items.push({ label: 'Copy to…', icon: CopyPlus, onClick: () => cb.onCopyTo!([file]) });

  items.push(sep());

  if (cb.onRename) items.push({ label: 'Rename', icon: Pencil, shortcut: 'F2', onClick: () => cb.onRename!(file) });
  if (cb.onTags) items.push({ label: 'Tags…', icon: Tags, onClick: () => cb.onTags!([file]) });
  if (!isDir && cb.onVersions) {
    items.push({ label: 'Version history…', icon: History, onClick: () => cb.onVersions!(file) });
  }

  if (cb.onDelete) {
    items.push(sep());
    items.push({ label: 'Delete', icon: Trash2, shortcut: 'Del', variant: 'danger', onClick: () => cb.onDelete!([file]) });
  }

  if (cb.onPreview) {
    items.push(sep());
    items.push({ label: 'Properties', icon: Info, onClick: () => cb.onPreview!(file) });
  }

  return items;
}

/**
 * Build the rich Drive context menu for one-or-many files.
 *
 * - `files.length === 1` → full single menu (Open / Open with / Share / clipboard / …)
 * - `files.length > 1` → batch menu (bulk endpoints)
 * - `ctx.tab === 'trash'` → Restore / Delete forever only
 * - `files.length === 0` → background menu (New folder / Upload / Paste)
 */
export function buildFileContextMenu(files: FileRecord[], ctx: DriveMenuContext): ContextMenuItem[] {
  if (files.length === 0) return buildBackgroundContextMenu(ctx);
  if (ctx.tab === 'trash') return buildTrashMenu(files, ctx);
  if (files.length > 1) return buildMultiMenu(files, ctx);
  return buildSingleMenu(files[0]!, ctx);
}

/** Background (empty area) menu: New folder / Upload / Paste. */
export function buildBackgroundContextMenu(ctx: DriveMenuContext): ContextMenuItem[] {
  const cb = ctx.callbacks;
  const hasClipboard = ctx.clipboard.operation !== null && ctx.clipboard.fileIds.length > 0;
  const items: ContextMenuItem[] = [];
  if (cb.onNewFolder) items.push({ label: 'New folder', icon: FolderPlus, onClick: () => cb.onNewFolder!() });
  if (cb.onUpload) items.push({ label: 'Upload files', icon: Upload, onClick: () => cb.onUpload!() });
  if (cb.onPaste) {
    if (items.length > 0) items.push(sep());
    items.push({
      label: 'Paste', icon: ClipboardPaste, shortcut: 'Ctrl+V',
      disabled: !hasClipboard,
      onClick: () => cb.onPaste!(),
    });
  }
  return items;
}
