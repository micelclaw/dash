import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
  collapsed: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed: boolean) => set({ collapsed }),
      setMobileOpen: (open: boolean) => set({ mobileOpen: open }),
    }),
    {
      name: 'claw-sidebar',
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
