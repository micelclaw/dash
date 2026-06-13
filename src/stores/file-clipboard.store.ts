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

import { create } from 'zustand';

/**
 * Which namespace the clipboard ids belong to:
 * - 'index' — DB file index UUIDs (Drive, Office, photos…). Pasted via /files endpoints.
 * - 'vfs'   — VFS paths (File Explorer). Pasted via /vfs/move | /vfs/copy.
 * Consumers MUST check `space` before pasting so VFS paths never reach
 * /files/bulk (and index UUIDs never reach /vfs/*).
 */
export type FileClipboardSpace = 'index' | 'vfs';

interface FileClipboardState {
  operation: 'copy' | 'cut' | null;
  fileIds: string[];
  sourcePath: string;
  space: FileClipboardSpace;
  setClipboard: (op: 'copy' | 'cut', ids: string[], source: string, space?: FileClipboardSpace) => void;
  clear: () => void;
}

export const useFileClipboard = create<FileClipboardState>((set) => ({
  operation: null,
  fileIds: [],
  sourcePath: '',
  space: 'index',
  // `space` defaults to 'index' so existing call-sites (Drive, Office) need no changes.
  setClipboard: (operation, fileIds, sourcePath, space = 'index') => set({ operation, fileIds, sourcePath, space }),
  clear: () => set({ operation: null, fileIds: [], sourcePath: '', space: 'index' }),
}));
