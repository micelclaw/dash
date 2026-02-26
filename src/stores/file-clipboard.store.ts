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
