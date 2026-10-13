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
import type { ComposeData, MailSortField, MailSortOrder } from '../types';

const SORT_STORAGE_KEY = 'mail-sort';

function readStoredSort(): { field: MailSortField; order: MailSortOrder } {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { field?: string; order?: string };
      const field = parsed.field as MailSortField | undefined;
      const order = parsed.order as MailSortOrder | undefined;
      // Anything unknown falls back to the default rather than reaching the API:
      // an invalid `sort` is a 400 and the list would just fail to load.
      if (
        field && ['received_at', 'from', 'subject', 'category'].includes(field) &&
        order && ['asc', 'desc'].includes(order)
      ) {
        return { field, order };
      }
    }
  } catch {
    // Unreadable storage is not a reason to break the module.
  }
  return { field: 'received_at', order: 'desc' };
}

interface MailState {
  activeAccount: string | null;
  activeFolder: string;
  /**
   * Etiqueta de Gmail seleccionada. Es EXCLUYENTE con la carpeta: en Gmail una
   * etiqueta atraviesa Entrada, Enviados y Archivo, así que cruzarla con una
   * carpeta daría casi siempre una lista vacía y parecería que no hay correo.
   */
  activeLabel: string | null;
  selectedEmailId: string | null;
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  composerData: ComposeData | null;
  sortField: MailSortField;
  sortOrder: MailSortOrder;
  starredOnly: boolean;

  setSort: (field: MailSortField, order: MailSortOrder) => void;
  toggleStarredOnly: () => void;
  setActiveAccount: (id: string | null) => void;
  setActiveFolder: (folder: string) => void;
  setActiveLabel: (label: string | null) => void;
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
  activeLabel: null,
  selectedEmailId: null,
  selectedIds: new Set<string>(),
  lastSelectedId: null,
  composerData: null,
  sortField: readStoredSort().field,
  sortOrder: readStoredSort().order,
  starredOnly: false,

  setSort: (field, order) => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ field, order }));
    } catch {
      // Not persisting is acceptable; not sorting is not.
    }
    set({ sortField: field, sortOrder: order, selectedEmailId: null });
  },
  toggleStarredOnly: () => set((s) => ({ starredOnly: !s.starredOnly, selectedEmailId: null })),

  setActiveAccount: (id) => set({ activeAccount: id, selectedEmailId: null }),
  // Elegir carpeta suelta la etiqueta y al revés: son dos formas distintas de
  // mirar el mismo buzón, no dos filtros que se apilen.
  setActiveFolder: (folder) => set({ activeFolder: folder, activeLabel: null, selectedEmailId: null }),
  setActiveLabel: (label) => set({ activeLabel: label, selectedEmailId: null }),
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
            next.add(orderedIds[i]!);
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
