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
import { api } from '@/services/api';
import { toast } from 'sonner';
import type {
  Board, Card, Column, FullBoard, CardFilters, ViewMode, Automation,
  CustomFieldDef,
} from '@/modules/projects/types';

interface ApiEnvelope<T> { data: T }
interface ApiList<T> { data: T[]; total: number; limit: number; offset: number }

// ─── Normalized state ────────────────────────────────

interface ProjectsState {
  // Normalized entities
  boards: Board[];
  columns: Record<string, Column>;
  cards: Record<string, Card>;
  customFieldDefs: Record<string, CustomFieldDef>;
  automations: Automation[];

  // Relationship arrays (ordered)
  boardColumnIds: Record<string, string[]>;   // boardId → columnId[]
  columnCardIds: Record<string, string[]>;    // columnId → cardId[]
  cardCommentCounts: Record<string, number>;  // cardId → count
  cardDependencyCounts: Record<string, number>;
  cardLinkCounts: Record<string, number>;

  /**
   * Tareas SIN tablero (las del tablero "Personal"), para la zona izquierda de
   * la pantalla de entrada. Slice APARTE de `cards`/`columnCardIds` a propósito:
   * ese diccionario lo puebla `fetchFullBoard` iterando `board.columns[].cards`,
   * y meter aquí tareas de otro tablero lo corrompería.
   */
  inboxCards: Card[];
  inboxLoading: boolean;
  inboxTotal: number;

  // Active board
  activeBoardId: string | null;
  activeBoardTitle: string | null;
  activeBoardPermission: 'owner' | 'edit' | 'view' | null;
  /** Settings of the active board (survives direct loads of /projects/:id,
   *  where the boards list isn't fetched). */
  activeBoardSettings: Board['settings'] | null;

  // UI state
  activeView: ViewMode;
  filters: CardFilters;
  selectedCardId: string | null;
  cardDetailOpen: boolean;
  multiSelectedIds: Set<string>;

  // Loading
  loading: boolean;
  boardLoading: boolean;

  // Board actions
  fetchBoards: () => Promise<void>;
  fetchFullBoard: (boardId: string) => Promise<void>;
  /** Bandeja: las tareas del tablero por defecto, sin cargar el tablero entero. */
  fetchInbox: () => Promise<void>;
  /** Apuntar una tarea sin decir tablero (cae en el "Personal"). `extra` trae
   *  lo que el mini-lenguaje de la captura haya entendido (prioridad, fecha…). */
  quickAddTask: (title: string, extra?: Record<string, unknown>) => Promise<Card | null>;
  /** Marcar hecha / reabrir. La fecha la deriva el servidor. */
  toggleTaskComplete: (cardId: string, completed: boolean) => Promise<void>;
  /** Arrastrar de la bandeja a una baldosa: entra por la columna de posición 0. */
  sendTaskToBoard: (cardId: string, boardId: string) => Promise<string | null>;
  createBoard: (data: { title: string; description?: string; color?: string; icon?: string; default_view?: string; tags?: string[] }) => Promise<Board | null>;
  updateBoard: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  archiveBoard: (id: string) => Promise<void>;
  unarchiveBoard: (id: string) => Promise<void>;

  // Column actions
  createColumn: (boardId: string, data: { title: string; color?: string; wip_limit?: number }) => Promise<void>;
  updateColumn: (boardId: string, columnId: string, data: Record<string, unknown>) => Promise<void>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  reorderColumn: (boardId: string, columnId: string, position: number) => Promise<void>;
  collapseColumn: (boardId: string, columnId: string, collapsed: boolean) => Promise<void>;

  // Card actions
  createCard: (boardId: string, data: { column_id: string; title: string; priority?: string; description?: string | null; color?: string | null; due_date?: string | null; start_date?: string | null; estimated_hours?: number | null; tags?: string[] | null; checklist?: unknown[] | null }) => Promise<void>;
  updateCard: (boardId: string, cardId: string, data: Record<string, unknown>) => Promise<void>;
  deleteCard: (boardId: string, cardId: string) => Promise<void>;
  moveCard: (boardId: string, cardId: string, columnId: string, position: number) => Promise<void>;
  archiveCard: (boardId: string, cardId: string) => Promise<void>;
  unarchiveCard: (boardId: string, cardId: string) => Promise<void>;

  // Automation actions
  fetchAutomations: (boardId: string) => Promise<void>;
  createAutomation: (boardId: string, data: Record<string, unknown>) => Promise<void>;
  updateAutomation: (boardId: string, automationId: string, data: Record<string, unknown>) => Promise<void>;
  deleteAutomation: (boardId: string, automationId: string) => Promise<void>;

  // Custom field def actions
  createFieldDef: (boardId: string, input: { name: string; type: string; options?: unknown; required?: boolean; show_on_card?: boolean }) => Promise<void>;
  updateFieldDef: (boardId: string, fieldId: string, input: { name?: string; type?: string; options?: unknown; required?: boolean; show_on_card?: boolean }) => Promise<void>;
  deleteFieldDef: (boardId: string, fieldId: string) => Promise<void>;

  // Bulk actions
  bulkAction: (boardId: string, action: string, cardIds: string[], extra?: Record<string, unknown>) => Promise<void>;

  // UI actions
  selectCard: (cardId: string | null) => void;
  setView: (view: ViewMode) => void;
  setFilters: (filters: CardFilters) => void;
  toggleMultiSelect: (cardId: string) => void;
  clearMultiSelect: () => void;

  // Selectors
  getColumnCards: (columnId: string) => Card[];
  getCard: (cardId: string) => Card | undefined;
  getColumn: (columnId: string) => Column | undefined;
  getOrderedColumns: () => Column[];

  // WebSocket handlers
  handleWsEvent: (event: string, data: Record<string, unknown>) => void;
}

/**
 * Una tarea vive en DOS sitios del store: `cards` (lo puebla `fetchFullBoard`
 * iterando las columnas del tablero) e `inboxCards` (la bandeja de la pantalla
 * de entrada, que se carga por el endpoint plano). Son slices separados a
 * propósito —meter tareas de otros tableros en `cards` corrompería el kanban—
 * pero eso obliga a escribir en LOS DOS al actualizar, o la bandeja enseña una
 * versión vieja: era el bug de "0/3 en la lista y 2/3 en la ficha" y el de la
 * portada que seguía ahí después de quitarla.
 */
function aplicarTarjeta(s: ProjectsState, card: Card) {
  return {
    cards: { ...s.cards, [card.id]: card },
    inboxCards: s.inboxCards.some((c) => c.id === card.id)
      ? s.inboxCards.map((c) => (c.id === card.id ? card : c))
      : s.inboxCards,
  };
}

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
  // Initial state
  boards: [],
  inboxCards: [],
  inboxLoading: false,
  inboxTotal: 0,
  columns: {},
  cards: {},
  customFieldDefs: {},
  automations: [],
  boardColumnIds: {},
  columnCardIds: {},
  cardCommentCounts: {},
  cardDependencyCounts: {},
  cardLinkCounts: {},
  activeBoardId: null,
  activeBoardTitle: null,
  activeBoardPermission: null,
  activeBoardSettings: null,
  activeView: 'board',
  filters: {},
  selectedCardId: null,
  cardDetailOpen: false,
  multiSelectedIds: new Set(),
  loading: false,
  boardLoading: false,

  // ─── Board actions ───────────────────────────────────

  fetchBoards: async () => {
    set({ loading: true });
    try {
      const res = await api.get<ApiList<Board>>('/projects/boards', { archived: 'false' });
      set({ boards: res.data, loading: false });
    } catch {
      set({ loading: false });
      toast.error('Error loading boards');
    }
  },

  fetchInbox: async () => {
    set({ inboxLoading: true });
    try {
      // OJO: el envelope de lista pone el total en `meta`, no plano — el tipo
      // `ApiList` de este fichero dice lo contrario y miente desde siempre.
      const res = await api.get<{ data: Card[]; meta?: { total: number } }>('/projects/cards', {
        only_default: 'true', completed: 'false', sort: 'due_date', order: 'asc', limit: '100',
      });
      set({ inboxCards: res.data, inboxTotal: res.meta?.total ?? res.data.length, inboxLoading: false });
    } catch {
      set({ inboxLoading: false });
      toast.error('No se pudieron cargar las tareas');
    }
  },

  quickAddTask: async (title, extra) => {
    try {
      const res = await api.post<ApiEnvelope<Card>>('/projects/cards', { title, ...(extra ?? {}) });
      set((s) => ({ inboxCards: [...s.inboxCards, res.data], inboxTotal: s.inboxTotal + 1 }));
      return res.data;
    } catch {
      toast.error('No se pudo crear la tarea');
      return null;
    }
  },

  toggleTaskComplete: async (cardId, completed) => {
    // Optimista: la casilla responde al instante y se revierte si el POST falla.
    const prev = get().inboxCards;
    set((s) => ({
      inboxCards: s.inboxCards.map((c) =>
        c.id === cardId ? { ...c, completed_at: completed ? new Date().toISOString() : null } : c),
    }));
    try {
      const res = await api.post<ApiEnvelope<Card>>(`/projects/cards/${cardId}/complete`, { completed });
      // También en `cards`: si la ficha está abierta, debe reflejar el cambio.
      set((s) => aplicarTarjeta(s, res.data));
    } catch {
      set({ inboxCards: prev });
      toast.error('No se pudo actualizar la tarea');
    }
  },

  sendTaskToBoard: async (cardId, boardId) => {
    const prev = get().inboxCards;
    set((s) => ({ inboxCards: s.inboxCards.filter((c) => c.id !== cardId), inboxTotal: Math.max(0, s.inboxTotal - 1) }));
    try {
      const res = await api.post<ApiEnvelope<Card & { _target_column?: string }>>(
        `/projects/cards/${cardId}/send-to-board`, { board_id: boardId },
      );
      return res.data._target_column ?? null;
    } catch {
      set({ inboxCards: prev });
      toast.error('No se pudo mover la tarea');
      return null;
    }
  },

  fetchFullBoard: async (boardId) => {
    set({ boardLoading: true, activeBoardId: boardId });
    try {
      const res = await api.get<ApiEnvelope<FullBoard>>(`/projects/boards/${boardId}`);
      const board = res.data;

      // Normalize columns
      const columns: Record<string, Column> = {};
      const boardColumnIds: string[] = [];
      const columnCardIds: Record<string, string[]> = {};
      const cards: Record<string, Card> = {};
      const cardCommentCounts: Record<string, number> = {};
      const cardDependencyCounts: Record<string, number> = {};
      const cardLinkCounts: Record<string, number> = {};

      const sortedCols = [...board.columns].sort((a, b) => a.position - b.position);
      for (const col of sortedCols) {
        const { cards: colCards, ...colData } = col;
        columns[col.id] = colData as Column;
        boardColumnIds.push(col.id);
        const sortedCards = [...(colCards ?? [])].sort((a, b) => a.position - b.position);
        columnCardIds[col.id] = sortedCards.map(c => c.id);
        for (const card of sortedCards) {
          const cardAny = card as unknown as Record<string, unknown>;
          // Extract enrichment counts
          const cc = (cardAny._comment_count ?? 0) as number;
          const dc = (cardAny._dependency_count ?? 0) as number;
          const lc = (cardAny._link_count ?? 0) as number;
          if (cc > 0) cardCommentCounts[card.id] = cc;
          if (dc > 0) cardDependencyCounts[card.id] = dc;
          if (lc > 0) cardLinkCounts[card.id] = lc;
          cards[card.id] = card;
        }
      }

      // Normalize custom field defs
      const customFieldDefs: Record<string, CustomFieldDef> = {};
      for (const fd of board.custom_field_defs ?? []) {
        customFieldDefs[fd.id] = fd;
      }

      set({
        columns,
        cards,
        customFieldDefs,
        boardColumnIds: { [boardId]: boardColumnIds },
        columnCardIds,
        cardCommentCounts,
        cardDependencyCounts,
        cardLinkCounts,
        activeBoardTitle: board.title,
        activeBoardPermission: board._permission ?? 'owner',
        activeBoardSettings: board.settings ?? null,
        activeView: (board.default_view as ViewMode) || 'board',
        boardLoading: false,
      });
    } catch {
      set({ boardLoading: false });
      toast.error('Error loading board');
    }
  },

  createBoard: async (data) => {
    try {
      const res = await api.post<ApiEnvelope<Board>>('/projects/boards', data);
      set((s) => ({ boards: [...s.boards, res.data] }));
      return res.data;
    } catch {
      toast.error('Error creating board');
      return null;
    }
  },

  updateBoard: async (id, data) => {
    try {
      await api.patch(`/projects/boards/${id}`, data);
      set((s) => ({
        boards: s.boards.map((b) => (b.id === id ? { ...b, ...data } as Board : b)),
        activeBoardTitle: data.title ? String(data.title) : s.activeBoardTitle,
        activeBoardSettings: data.settings && s.activeBoardId === id
          ? (data.settings as Board['settings'])
          : s.activeBoardSettings,
      }));
    } catch {
      toast.error('Error updating board');
    }
  },

  deleteBoard: async (id) => {
    try {
      await api.delete(`/projects/boards/${id}`);
      set((s) => ({ boards: s.boards.filter((b) => b.id !== id) }));
    } catch {
      toast.error('Error deleting board');
    }
  },

  archiveBoard: async (id) => {
    try {
      await api.post(`/projects/boards/${id}/archive`);
      set((s) => ({ boards: s.boards.filter((b) => b.id !== id) }));
      toast.success('Board archived');
    } catch {
      toast.error('Error archiving board');
    }
  },

  unarchiveBoard: async (id) => {
    try {
      await api.post(`/projects/boards/${id}/unarchive`);
      get().fetchBoards();
      toast.success('Board unarchived');
    } catch {
      toast.error('Error unarchiving board');
    }
  },

  // ─── Column actions ──────────────────────────────────

  createColumn: async (boardId, data) => {
    try {
      const res = await api.post<ApiEnvelope<Column>>(`/projects/boards/${boardId}/columns`, data);
      const col = res.data;
      set((s) => {
        // The WS broadcast may have landed before this response (same client).
        const ids = s.boardColumnIds[boardId] ?? [];
        return {
          columns: { ...s.columns, [col.id]: col },
          boardColumnIds: {
            ...s.boardColumnIds,
            [boardId]: ids.includes(col.id) ? ids : [...ids, col.id],
          },
          columnCardIds: { ...s.columnCardIds, [col.id]: s.columnCardIds[col.id] ?? [] },
        };
      });
    } catch {
      toast.error('Error creating column');
    }
  },

  updateColumn: async (boardId, columnId, data) => {
    try {
      await api.patch(`/projects/boards/${boardId}/columns/${columnId}`, data);
      set((s) => ({
        columns: {
          ...s.columns,
          [columnId]: { ...s.columns[columnId], ...data } as Column,
        },
      }));
    } catch {
      toast.error('Error updating column');
    }
  },

  deleteColumn: async (boardId, columnId) => {
    try {
      await api.delete(`/projects/boards/${boardId}/columns/${columnId}`);
      set((s) => {
        const { [columnId]: _, ...restCols } = s.columns;
        const { [columnId]: __, ...restCardIds } = s.columnCardIds;
        return {
          columns: restCols,
          columnCardIds: restCardIds,
          boardColumnIds: {
            ...s.boardColumnIds,
            [boardId]: (s.boardColumnIds[boardId] ?? []).filter(id => id !== columnId),
          },
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting column';
      toast.error(msg);
    }
  },

  reorderColumn: async (boardId, columnId, position) => {
    const prevPosition = get().columns[columnId]?.position;
    // Optimistic update — apply immediately so the column doesn't snap back
    set((s) => ({
      columns: {
        ...s.columns,
        [columnId]: { ...s.columns[columnId], position } as Column,
      },
    }));
    try {
      await api.patch(`/projects/boards/${boardId}/columns/${columnId}/reorder`, { position });
    } catch {
      // Revert on failure
      if (prevPosition !== undefined) {
        set((s) => ({
          columns: {
            ...s.columns,
            [columnId]: { ...s.columns[columnId], position: prevPosition } as Column,
          },
        }));
      }
      toast.error('Error reordering column');
    }
  },

  collapseColumn: async (boardId, columnId, collapsed) => {
    set((s) => ({
      columns: {
        ...s.columns,
        [columnId]: { ...s.columns[columnId], collapsed } as Column,
      },
    }));
    try {
      await api.post(`/projects/boards/${boardId}/columns/${columnId}/collapse`, { collapsed });
    } catch {
      // Revert on failure
      set((s) => ({
        columns: {
          ...s.columns,
          [columnId]: { ...s.columns[columnId], collapsed: !collapsed } as Column,
        },
      }));
    }
  },

  // ─── Card actions ────────────────────────────────────

  createCard: async (boardId, data) => {
    try {
      const res = await api.post<ApiEnvelope<Card>>(`/projects/boards/${boardId}/cards`, data);
      const card = res.data;
      set((s) => {
        // The WS broadcast may have landed before this response (same client).
        const ids = s.columnCardIds[data.column_id] ?? [];
        return {
          cards: { ...s.cards, [card.id]: card },
          columnCardIds: {
            ...s.columnCardIds,
            [data.column_id]: ids.includes(card.id) ? ids : [...ids, card.id],
          },
        };
      });
    } catch {
      toast.error('Error creating card');
    }
  },

  updateCard: async (boardId, cardId, data) => {
    try {
      const res = await api.patch<ApiEnvelope<Card>>(`/projects/boards/${boardId}/cards/${cardId}`, data);
      set((s) => aplicarTarjeta(s, res.data));
    } catch {
      toast.error('Error updating card');
    }
  },

  deleteCard: async (boardId, cardId) => {
    try {
      await api.delete(`/projects/boards/${boardId}/cards/${cardId}`);
      set((s) => {
        const { [cardId]: _, ...restCards } = s.cards;
        const columnCardIds = { ...s.columnCardIds };
        for (const colId of Object.keys(columnCardIds)) {
          columnCardIds[colId] = (columnCardIds[colId] ?? []).filter(id => id !== cardId);
        }
        const estabaEnBandeja = s.inboxCards.some((c) => c.id === cardId);
        return {
          cards: restCards,
          columnCardIds,
          // La bandeja es otro slice: sin esto la tarea borrada seguía ahí.
          inboxCards: estabaEnBandeja ? s.inboxCards.filter((c) => c.id !== cardId) : s.inboxCards,
          inboxTotal: estabaEnBandeja ? Math.max(0, s.inboxTotal - 1) : s.inboxTotal,
          selectedCardId: s.selectedCardId === cardId ? null : s.selectedCardId,
          cardDetailOpen: s.selectedCardId === cardId ? false : s.cardDetailOpen,
        };
      });
    } catch {
      toast.error('Error deleting card');
    }
  },

  moveCard: async (boardId, cardId, columnId, position) => {
    // Optimistic update
    const prevCards = get().cards;
    const prevColumnCardIds = get().columnCardIds;

    set((s) => {
      const card = s.cards[cardId];
      if (!card) return s;

      const oldColumnId = card.column_id;
      const updatedCard = { ...card, column_id: columnId, position };

      // Remove from old column
      const oldColCards = (s.columnCardIds[oldColumnId] ?? []).filter(id => id !== cardId);
      // Add to new column and re-sort
      const newColCards = [...(oldColumnId === columnId ? oldColCards : (s.columnCardIds[columnId] ?? [])), cardId];

      return {
        cards: { ...s.cards, [cardId]: updatedCard },
        columnCardIds: {
          ...s.columnCardIds,
          [oldColumnId]: oldColCards,
          [columnId]: newColCards,
        },
      };
    });

    try {
      await api.patch(`/projects/boards/${boardId}/cards/${cardId}/move`, { columnId, position });
    } catch {
      set({ cards: prevCards, columnCardIds: prevColumnCardIds });
      toast.error('Error moving card');
    }
  },

  archiveCard: async (boardId, cardId) => {
    try {
      const res = await api.post<ApiEnvelope<Card>>(`/projects/boards/${boardId}/cards/${cardId}/archive`);
      // La tarjeta SIGUE en `cards` (el tablero las enseña tras el filtro
      // "Archivadas"), pero sale de la bandeja, que solo lista lo vivo.
      set((s) => {
        const estaba = s.inboxCards.some((c) => c.id === cardId);
        return {
          cards: { ...s.cards, [cardId]: res.data },
          inboxCards: estaba ? s.inboxCards.filter((c) => c.id !== cardId) : s.inboxCards,
          inboxTotal: estaba ? Math.max(0, s.inboxTotal - 1) : s.inboxTotal,
        };
      });
      toast.success('Card archived');
    } catch {
      toast.error('Error archiving card');
    }
  },

  unarchiveCard: async (boardId, cardId) => {
    try {
      const res = await api.post<ApiEnvelope<Card>>(`/projects/boards/${boardId}/cards/${cardId}/unarchive`);
      set((s) => aplicarTarjeta(s, res.data));
      toast.success('Card restored');
    } catch {
      toast.error('Error restoring card');
    }
  },

  // ─── Automation actions ──────────────────────────────

  fetchAutomations: async (boardId) => {
    try {
      const res = await api.get<ApiEnvelope<Automation[]>>(`/projects/boards/${boardId}/automations`);
      set({ automations: res.data });
    } catch {
      toast.error('Error loading automations');
    }
  },

  createAutomation: async (boardId, data) => {
    try {
      const res = await api.post<ApiEnvelope<Automation>>(`/projects/boards/${boardId}/automations`, data);
      set((s) => ({ automations: [...s.automations, res.data] }));
    } catch {
      toast.error('Error creating automation');
    }
  },

  updateAutomation: async (boardId, automationId, data) => {
    try {
      await api.patch(`/projects/boards/${boardId}/automations/${automationId}`, data);
      set((s) => ({
        automations: s.automations.map((a) => (a.id === automationId ? { ...a, ...data } as Automation : a)),
      }));
    } catch {
      toast.error('Error updating automation');
    }
  },

  deleteAutomation: async (boardId, automationId) => {
    try {
      await api.delete(`/projects/boards/${boardId}/automations/${automationId}`);
      set((s) => ({ automations: s.automations.filter((a) => a.id !== automationId) }));
    } catch {
      toast.error('Error deleting automation');
    }
  },

  // ─── Custom field def actions ───────────────────────

  createFieldDef: async (boardId, input) => {
    try {
      const res = await api.post<ApiEnvelope<CustomFieldDef>>(`/projects/boards/${boardId}/custom-fields`, input);
      set(s => ({ customFieldDefs: { ...s.customFieldDefs, [res.data.id]: res.data } }));
      toast.success('Field created');
    } catch {
      toast.error('Error creating field');
    }
  },

  updateFieldDef: async (boardId, fieldId, input) => {
    try {
      const res = await api.patch<ApiEnvelope<CustomFieldDef>>(`/projects/boards/${boardId}/custom-fields/${fieldId}`, input);
      set(s => ({ customFieldDefs: { ...s.customFieldDefs, [fieldId]: res.data } }));
    } catch {
      toast.error('Error updating field');
    }
  },

  deleteFieldDef: async (boardId, fieldId) => {
    try {
      await api.delete(`/projects/boards/${boardId}/custom-fields/${fieldId}`);
      set(s => {
        const next = { ...s.customFieldDefs };
        delete next[fieldId];
        return { customFieldDefs: next };
      });
      toast.success('Field deleted');
    } catch {
      toast.error('Error deleting field');
    }
  },

  // ─── Bulk actions ────────────────────────────────────

  bulkAction: async (boardId, action, cardIds, extra) => {
    try {
      await api.post(`/projects/boards/${boardId}/cards/bulk`, {
        action,
        card_ids: cardIds,
        ...extra,
      });
      // Refetch board to get updated state
      get().fetchFullBoard(boardId);
      set({ multiSelectedIds: new Set() });
      toast.success(`Bulk ${action} completed`);
    } catch {
      toast.error(`Error in bulk ${action}`);
    }
  },

  // ─── UI actions ──────────────────────────────────────

  selectCard: (cardId) => set({ selectedCardId: cardId, cardDetailOpen: !!cardId }),
  setView: (view) => set({ activeView: view }),
  setFilters: (filters) => set({ filters }),

  toggleMultiSelect: (cardId) => set((s) => {
    const next = new Set(s.multiSelectedIds);
    if (next.has(cardId)) next.delete(cardId);
    else next.add(cardId);
    return { multiSelectedIds: next };
  }),

  clearMultiSelect: () => set({ multiSelectedIds: new Set() }),

  // ─── Selectors ───────────────────────────────────────

  getColumnCards: (columnId) => {
    const s = get();
    const ids = s.columnCardIds[columnId] ?? [];
    return ids.map(id => s.cards[id]).filter((c): c is NonNullable<typeof c> => !!c);
  },

  getCard: (cardId) => get().cards[cardId],
  getColumn: (columnId) => get().columns[columnId],

  getOrderedColumns: () => {
    const s = get();
    const boardId = s.activeBoardId;
    if (!boardId) return [];
    const colIds = s.boardColumnIds[boardId] ?? [];
    return colIds.map(id => s.columns[id]).filter((c): c is NonNullable<typeof c> => !!c).sort((a, b) => a.position - b.position);
  },

  // ─── WebSocket handlers ──────────────────────────────

  handleWsEvent: (event, data) => {
    const state = get();
    const boardId = state.activeBoardId;
    // The WS broadcaster snake_cases every payload key (core ws/server.ts),
    // so the event data arrives as board_id/card_id/column_id.
    if (data.board_id !== boardId) return;

    switch (event) {
      case 'kanban.card.created': {
        const card = data.card as Card;
        set((s) => {
          // The originating client already added it via the HTTP response.
          if (s.cards[card.id]) return s;
          return {
            cards: { ...s.cards, [card.id]: card },
            columnCardIds: {
              ...s.columnCardIds,
              [card.column_id]: [...(s.columnCardIds[card.column_id] ?? []), card.id],
            },
          };
        });
        break;
      }

      case 'kanban.card.updated': {
        const cardId = data.card_id as string;
        const updates = data.updates as Record<string, unknown>;
        set((s) => {
          const existing = s.cards[cardId];
          if (!existing) return s;
          return {
            cards: { ...s.cards, [cardId]: { ...existing, ...updates } as Card },
          };
        });
        break;
      }

      case 'kanban.card.moved':
      case 'kanban.cards.bulk_archived': {
        // Refetch for accurate position/archive data
        state.fetchFullBoard(boardId!);
        break;
      }

      case 'kanban.card.deleted': {
        const cardId = data.card_id as string;
        set((s) => {
          const { [cardId]: _, ...restCards } = s.cards;
          const columnCardIds = { ...s.columnCardIds };
          for (const colId of Object.keys(columnCardIds)) {
            columnCardIds[colId] = (columnCardIds[colId] ?? []).filter(id => id !== cardId);
          }
          return { cards: restCards, columnCardIds };
        });
        break;
      }

      case 'kanban.column.created': {
        const col = data.column as Column;
        set((s) => {
          // The originating client already added it via the HTTP response.
          if (s.columns[col.id]) return s;
          return {
            columns: { ...s.columns, [col.id]: col },
            boardColumnIds: {
              ...s.boardColumnIds,
              [boardId!]: [...(s.boardColumnIds[boardId!] ?? []), col.id],
            },
            columnCardIds: { ...s.columnCardIds, [col.id]: [] },
          };
        });
        break;
      }

      case 'kanban.column.updated': {
        const columnId = data.column_id as string;
        const updates = data.updates as Record<string, unknown>;
        set((s) => ({
          columns: {
            ...s.columns,
            [columnId]: { ...s.columns[columnId], ...updates } as Column,
          },
        }));
        break;
      }

      case 'kanban.board.updated': {
        const updates = data.updates as Record<string, unknown>;
        if (updates.title) set({ activeBoardTitle: String(updates.title) });
        break;
      }
    }
  },
}));
