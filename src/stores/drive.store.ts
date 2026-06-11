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

/** Tabs of the Drive module shell (DrivePage). Synced with ?tab= in the URL — the URL wins on mount. */
export type DriveTab =
  | 'my-drive'
  | 'recent'
  | 'starred'
  | 'shared'
  | 'trash'
  | 'duplicates'
  | 'devices';

export const DRIVE_TABS: DriveTab[] = [
  'my-drive',
  'recent',
  'starred',
  'shared',
  'trash',
  'duplicates',
  'devices',
];

export function isDriveTab(value: string | null | undefined): value is DriveTab {
  return !!value && (DRIVE_TABS as string[]).includes(value);
}

/** Row density — reserved for a future D-session (compact/comfortable list rows). */
export type DriveDensity = 'comfortable' | 'compact';

interface DriveStore {
  /** Active tab of the Drive shell. The URL ?tab= param wins on mount. */
  activeTab: DriveTab;
  /** Row density (future use). */
  density: DriveDensity;
  /** Inspector panel open state (future use — D5). */
  inspectorOpen: boolean;

  setActiveTab: (tab: DriveTab) => void;
  setDensity: (density: DriveDensity) => void;
  setInspectorOpen: (open: boolean) => void;
}

export const useDriveStore = create<DriveStore>()(
  persist(
    (set) => ({
      activeTab: 'my-drive',
      density: 'comfortable',
      inspectorOpen: false,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setDensity: (density) => set({ density }),
      setInspectorOpen: (open) => set({ inspectorOpen: open }),
    }),
    {
      name: 'claw-drive',
      partialize: (state) => ({
        activeTab: state.activeTab,
        density: state.density,
        inspectorOpen: state.inspectorOpen,
      }),
    },
  ),
);
