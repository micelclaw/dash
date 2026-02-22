import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
  /** Effective visual state — driven by userCollapsed + viewport auto-collapse */
  collapsed: boolean;
  /** User's explicit preference via Cmd+B / toggle button (persisted) */
  userCollapsed: boolean;
  mobileOpen: boolean;
  /** Toggle user preference (Cmd+B / button) — sets both userCollapsed and collapsed */
  toggle: () => void;
  /** Set effective collapsed only (used by Shell for viewport auto-collapse) */
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      userCollapsed: false,
      mobileOpen: false,
      toggle: () => set((s) => {
        const next = !s.userCollapsed;
        return { collapsed: next, userCollapsed: next };
      }),
      setCollapsed: (collapsed: boolean) => set({ collapsed }),
      setMobileOpen: (open: boolean) => set({ mobileOpen: open }),
    }),
    {
      name: 'claw-sidebar',
      partialize: (state) => ({ userCollapsed: state.userCollapsed }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SidebarStore>;
        return {
          ...current,
          userCollapsed: p.userCollapsed ?? false,
          collapsed: p.userCollapsed ?? false,
        };
      },
    },
  ),
);
