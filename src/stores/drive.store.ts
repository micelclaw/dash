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

/** Row density (D6) — toggled from the My Drive toolbar, consumed by DriveGrid/DriveList. */
export type DriveDensity = 'comfortable' | 'compact';

/** Inner tabs of the right-hand inspector (D5). */
export type DriveInspectorTab = 'details' | 'activity' | 'versions';

interface DriveStore {
  /** Active tab of the Drive shell. The URL ?tab= param wins on mount. */
  activeTab: DriveTab;
  /** Row density (D6) — compact tightens grid cells and list rows. */
  density: DriveDensity;
  /** Inspector panel open state (D5). Collapsed = false (rail shown while a selection exists). */
  inspectorOpen: boolean;
  /** Active inner tab of the inspector (D5). */
  inspectorTab: DriveInspectorTab;

  setActiveTab: (tab: DriveTab) => void;
  setDensity: (density: DriveDensity) => void;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTab: (tab: DriveInspectorTab) => void;
}

export const useDriveStore = create<DriveStore>()(
  persist(
    (set) => ({
      activeTab: 'my-drive',
      density: 'comfortable',
      inspectorOpen: true,
      inspectorTab: 'details',

      setActiveTab: (tab) => set({ activeTab: tab }),
      setDensity: (density) => set({ density }),
      setInspectorOpen: (open) => set({ inspectorOpen: open }),
      setInspectorTab: (tab) => set({ inspectorTab: tab }),
    }),
    {
      name: 'claw-drive',
      partialize: (state) => ({
        activeTab: state.activeTab,
        density: state.density,
        inspectorOpen: state.inspectorOpen,
        inspectorTab: state.inspectorTab,
      }),
    },
  ),
);
