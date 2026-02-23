import { create } from 'zustand';
import type { ComposeData } from '../types';

interface MailState {
  activeAccount: string | null;
  activeFolder: string;
  selectedEmailId: string | null;
  selectedIds: Set<string>;
  composerData: ComposeData | null;

  setActiveAccount: (id: string | null) => void;
  setActiveFolder: (folder: string) => void;
  setSelectedEmailId: (id: string | null) => void;
  toggleSelection: (id: string) => void;
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
  composerData: null,

  setActiveAccount: (id) => set({ activeAccount: id, selectedEmailId: null }),
  setActiveFolder: (folder) => set({ activeFolder: folder, selectedEmailId: null }),
  setSelectedEmailId: (id) => set({ selectedEmailId: id }),
  toggleSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
  openComposer: (data) => set({ composerData: data }),
  closeComposer: () => set({ composerData: null }),
}));
