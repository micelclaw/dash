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
 * File Explorer context-menu builders.
 *
 * Mirrors the Drive conventions (src/modules/drive/context-menu.tsx):
 * same labels, Lucide icons, ordering, separators, danger variant and
 * shortcuts-in-label — minus Share / Star / Versions / Tags / Open-with,
 * which are file-index features (VFS entries have no file_id).
 */

import {
  FolderOpen, Eye, Download, Scissors, Copy, ClipboardPaste, FolderInput,
  FolderPlus, CopyPlus, Pencil, Trash2, Info, Link2, Upload,
} from 'lucide-react';
import type { FileRecord } from '@/types/files';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import type { FileClipboardSpace } from '@/stores/file-clipboard.store';

// ─── Context types ───────────────────────────────────────

export interface ExplorerMenuCallbacks {
  /** Open: folder → navigate into it; file → open the preview panel. */
  onOpen?: (file: FileRecord) => void;
  /** Properties → select the entry so the preview/properties panel shows. */
  onProperties?: (file: FileRecord) => void;
  onDownload?: (files: FileRecord[]) => void;
  onCut?: (files: FileRecord[]) => void;
  onCopy?: (files: FileRecord[]) => void;
  /** Paste clipboard. `destFolder` set when invoked over a folder row; undefined = current folder. */
  onPaste?: (destFolder?: FileRecord) => void;
  /** Move to… / Copy to… → CrossSourcePicker (VFS sources only). */
  onMoveTo?: (files: FileRecord[]) => void;
  onCopyTo?: (files: FileRecord[]) => void;
  onRename?: (file: FileRecord) => void;
  onDelete?: (files: FileRecord[]) => void;
  // Background-only
  onNewFolder?: () => void;
  onUpload?: () => void;
}

export interface ExplorerMenuContext {
  /** Whether the current source/mount is writable (SOURCE_ROOTS / mount read_only). */
  writable: boolean;
  /** 'vfs' when browsing a VFS mount, 'index' for legacy DB-index paths. */
  space: FileClipboardSpace;
  clipboard: { operation: 'copy' | 'cut' | null; fileIds: string[]; space: FileClipboardSpace };
  callbacks: ExplorerMenuCallbacks;
}

// ─── Helpers ─────────────────────────────────────────────

const sep = (): ContextMenuItem => ({ label: '', separator: true, onClick: () => {} });

/** Clipboard has content AND it belongs to this space (never paste VFS paths into /files/bulk). */
function clipboardUsable(ctx: ExplorerMenuContext): boolean {
  return ctx.clipboard.operation !== null
    && ctx.clipboard.fileIds.length > 0
    && ctx.clipboard.space === ctx.space;
}

/** VFS has no folder-zip endpoint — directories aren't downloadable there. */
function isDownloadable(file: FileRecord, ctx: ExplorerMenuContext): boolean {
  return !(ctx.space === 'vfs' && file.is_directory);
}

// ─── Builders ────────────────────────────────────────────

function buildSingleMenu(file: FileRecord, ctx: ExplorerMenuContext): ContextMenuItem[] {
  const cb = ctx.callbacks;
  const isDir = file.is_directory;
  const items: ContextMenuItem[] = [];

  // Open: folder → navigate; file → preview panel.
  if (cb.onOpen) {
    items.push({
      label: 'Open', icon: isDir ? FolderOpen : Eye, shortcut: 'Enter',
      onClick: () => cb.onOpen!(file),
    });
    items.push(sep());
  }

  if (cb.onDownload && isDownloadable(file, ctx)) {
    items.push({ label: 'Download', icon: Download, onClick: () => cb.onDownload!([file]) });
    items.push(sep());
  }

  if (ctx.writable && cb.onCut) {
    items.push({ label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', onClick: () => cb.onCut!([file]) });
  }
  if (cb.onCopy) {
    items.push({ label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', onClick: () => cb.onCopy!([file]) });
  }
  // Paste only over folders (paste INTO the folder) — background paste lives in the background menu.
  if (isDir && ctx.writable && cb.onPaste) {
    items.push({
      label: 'Paste into folder', icon: ClipboardPaste, shortcut: 'Ctrl+V',
      disabled: !clipboardUsable(ctx),
      onClick: () => cb.onPaste!(file),
    });
  }
  if (ctx.writable && cb.onMoveTo) {
    items.push({ label: 'Move to…', icon: FolderInput, onClick: () => cb.onMoveTo!([file]) });
  }
  if (cb.onCopyTo) {
    items.push({ label: 'Copy to…', icon: CopyPlus, onClick: () => cb.onCopyTo!([file]) });
  }

  if (ctx.writable && cb.onRename) {
    items.push(sep());
    items.push({ label: 'Rename', icon: Pencil, shortcut: 'F2', onClick: () => cb.onRename!(file) });
  }

  if (ctx.writable && cb.onDelete) {
    items.push(sep());
    items.push({ label: 'Delete', icon: Trash2, shortcut: 'Del', variant: 'danger', onClick: () => cb.onDelete!([file]) });
  }

  items.push(sep());
  items.push({ label: 'Copy path', icon: Link2, onClick: () => { void navigator.clipboard.writeText(file.filepath); } });
  if (cb.onProperties) {
    items.push({ label: 'Properties', icon: Info, onClick: () => cb.onProperties!(file) });
  }

  return items;
}

function buildMultiMenu(files: FileRecord[], ctx: ExplorerMenuContext): ContextMenuItem[] {
  const cb = ctx.callbacks;
  const n = files.length;
  const items: ContextMenuItem[] = [];

  const downloadable = files.filter(f => isDownloadable(f, ctx));
  if (cb.onDownload && downloadable.length > 0) {
    items.push({
      label: `Download (${downloadable.length})`, icon: Download,
      onClick: () => cb.onDownload!(downloadable),
    });
    items.push(sep());
  }

  if (ctx.writable && cb.onCut) {
    items.push({ label: `Cut (${n})`, icon: Scissors, shortcut: 'Ctrl+X', onClick: () => cb.onCut!(files) });
  }
  if (cb.onCopy) {
    items.push({ label: `Copy (${n})`, icon: Copy, shortcut: 'Ctrl+C', onClick: () => cb.onCopy!(files) });
  }
  if (ctx.writable && cb.onMoveTo) {
    items.push({ label: 'Move to…', icon: FolderInput, onClick: () => cb.onMoveTo!(files) });
  }
  if (cb.onCopyTo) {
    items.push({ label: 'Copy to…', icon: CopyPlus, onClick: () => cb.onCopyTo!(files) });
  }

  if (ctx.writable && cb.onDelete) {
    items.push(sep());
    items.push({
      label: `Delete (${n})`, icon: Trash2, shortcut: 'Del', variant: 'danger',
      onClick: () => cb.onDelete!(files),
    });
  }

  return items;
}

/**
 * Build the Explorer context menu for one-or-many entries.
 * - 1 entry → full single menu
 * - >1 entries → batch menu
 * - 0 entries → background menu
 */
export function buildExplorerContextMenu(entries: FileRecord[], ctx: ExplorerMenuContext): ContextMenuItem[] {
  if (entries.length === 0) return buildExplorerBackgroundMenu(ctx);
  if (entries.length > 1) return buildMultiMenu(entries, ctx);
  return buildSingleMenu(entries[0]!, ctx);
}

/** Background (empty area) menu: New folder / Upload files / Paste. */
export function buildExplorerBackgroundMenu(ctx: ExplorerMenuContext): ContextMenuItem[] {
  const cb = ctx.callbacks;
  const items: ContextMenuItem[] = [];
  if (!ctx.writable) return items;
  if (cb.onNewFolder) items.push({ label: 'New folder', icon: FolderPlus, onClick: () => cb.onNewFolder!() });
  if (cb.onUpload) items.push({ label: 'Upload files', icon: Upload, onClick: () => cb.onUpload!() });
  if (cb.onPaste) {
    if (items.length > 0) items.push(sep());
    items.push({
      label: 'Paste', icon: ClipboardPaste, shortcut: 'Ctrl+V',
      disabled: !clipboardUsable(ctx),
      onClick: () => cb.onPaste!(),
    });
  }
  return items;
}
