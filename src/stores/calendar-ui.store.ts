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
import type { CalendarView } from '@/modules/calendar/types';

/**
 * Last chosen Calendar view, synchronized per user by ui-preferences.store.
 * Null leaves the first-run choice to calendar.default_view / the mobile layout.
 */
interface CalendarUiStore {
  view: CalendarView | null;
  setView: (view: CalendarView) => void;
}

export const useCalendarUiStore = create<CalendarUiStore>((set) => ({
      view: null,
      setView: (view) => set({ view }),
    }));
