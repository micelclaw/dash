import { create } from 'zustand';
import type { ComposeData } from '../types';

interface MailState {
  activeAccount: string | null;
  activeFolder: string;
  selectedEmailId: string | null;
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  composerData: ComposeData | null;

  setActiveAccount: (id: string | null) => void;
  setActiveFolder: (folder: string) => void;
  setSelectedEmailId: (id: string | null) => void;
  toggleSelection: (id: string, shiftKey?: boolean, orderedIds?: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  openComposer: (data: ComposeData) => void;
  closeComposer: () => void;
}

export const useMailState = create<MailState>()((set) => ({
  activeAccount: null,
  activeFolder: 'INBOX',
  selectedEmailId: null,
  selectedIds: new Set<string>(),
  lastSelectedId: null,
  composerData: null,

  setActiveAccount: (id) => set({ activeAccount: id, selectedEmailId: null }),
  setActiveFolder: (folder) => set({ activeFolder: folder, selectedEmailId: null }),
  setSelectedEmailId: (id) => set({ selectedEmailId: id }),
  toggleSelection: (id, shiftKey, orderedIds) =>
    set((s) => {
      // Shift+click range selection
      if (shiftKey && s.lastSelectedId && orderedIds) {
        const startIdx = orderedIds.indexOf(s.lastSelectedId);
        const endIdx = orderedIds.indexOf(id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const next = new Set(s.selectedIds);
          for (let i = from; i <= to; i++) {
            next.add(orderedIds[i]);
          }
          return { selectedIds: next, lastSelectedId: id };
        }
      }
      // Normal toggle
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next, lastSelectedId: id };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
  openComposer: (data) => set({ composerData: data }),
  closeComposer: () => set({ composerData: null }),
}));
