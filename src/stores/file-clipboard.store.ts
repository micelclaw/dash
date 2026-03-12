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

interface FileClipboardState {
  operation: 'copy' | 'cut' | null;
  fileIds: string[];
  sourcePath: string;
  setClipboard: (op: 'copy' | 'cut', ids: string[], source: string) => void;
  clear: () => void;
}

export const useFileClipboard = create<FileClipboardState>((set) => ({
  operation: null,
  fileIds: [],
  sourcePath: '',
  setClipboard: (operation, fileIds, sourcePath) => set({ operation, fileIds, sourcePath }),
  clear: () => set({ operation: null, fileIds: [], sourcePath: '' }),
}));
