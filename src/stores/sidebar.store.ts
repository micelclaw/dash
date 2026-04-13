/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
  /** Effective visual state — driven by userCollapsed + viewport auto-collapse + hover */
  collapsed: boolean;
  /** User's explicit preference via Cmd+B / toggle button (persisted) */
  userCollapsed: boolean;
  /** Pin mode: if true, sidebar stays as-is. If false, auto-collapse + hover-expand */
  pinned: boolean;
  /** Whether the sidebar is temporarily expanded by mouse hover (transient) */
  hoverExpanded: boolean;
  mobileOpen: boolean;
  /** Toggle user preference (Cmd+B / button) — sets both userCollapsed and collapsed */
  toggle: () => void;
  /** Set effective collapsed only (used by Shell for viewport auto-collapse) */
  setCollapsed: (collapsed: boolean) => void;
  /** Toggle pin mode */
  togglePin: () => void;
  /** Set hover-expanded state (auto-collapse mode) */
  setHoverExpanded: (expanded: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set, get) => ({
      collapsed: false,
      userCollapsed: false,
      pinned: true, // Default: pinned (current behavior)
      hoverExpanded: false,
      mobileOpen: false,
      toggle: () => set((s) => {
        const next = !s.collapsed;
        return { collapsed: next, userCollapsed: next, hoverExpanded: false };
      }),
      setCollapsed: (collapsed: boolean) => set({ collapsed }),
      togglePin: () => set((s) => {
        const nextPinned = !s.pinned;
        // When unpinning: auto-collapse after a moment (handled by component timer)
        // When pinning: keep current state
        return { pinned: nextPinned, hoverExpanded: false };
      }),
      setHoverExpanded: (expanded: boolean) => {
        const s = get();
        if (s.pinned) return; // Pinned mode ignores hover
        if (expanded) {
          set({ collapsed: false, hoverExpanded: true });
        } else {
          set({ collapsed: true, hoverExpanded: false });
        }
      },
      setMobileOpen: (open: boolean) => set({ mobileOpen: open }),
    }),
    {
      name: 'claw-sidebar',
      partialize: (state) => ({ userCollapsed: state.userCollapsed, pinned: state.pinned }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SidebarStore>;
        return {
          ...current,
          userCollapsed: p.userCollapsed ?? false,
          collapsed: p.userCollapsed ?? false,
          pinned: p.pinned ?? true,
        };
      },
    },
  ),
);
