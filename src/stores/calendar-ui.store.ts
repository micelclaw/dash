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
import { persist } from 'zustand/middleware';
import type { CalendarView } from '@/modules/calendar/types';

/**
 * Per-browser Calendar UI preferences (persisted to localStorage, sidebar.store
 * pattern). Holds the LAST-USED view so leaving Calendar (e.g. to Notes) and
 * coming back restores it — distinct from the server-side `calendar.default_view`
 * setting, which is only the first-run default. `view: null` = never chosen →
 * the page falls back to the settings default (or agenda on mobile first-run).
 */
interface CalendarUiStore {
  view: CalendarView | null;
  setView: (view: CalendarView) => void;
}

export const useCalendarUiStore = create<CalendarUiStore>()(
  persist(
    (set) => ({
      view: null,
      setView: (view) => set({ view }),
    }),
    {
      name: 'claw-calendar-ui',
      partialize: (s) => ({ view: s.view }),
      merge: (persisted, current) => {
        const p = persisted as Partial<CalendarUiStore>;
        return { ...current, view: p.view ?? null };
      },
    },
  ),
);
