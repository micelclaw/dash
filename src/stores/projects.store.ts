import { create } from 'zustand';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type {
  Board, Card, Column, FullBoard, CardFilters, ViewMode, Automation,
  Label, CustomFieldDef, Checklist, Comment, Dependency, EntityLink,
  BoardTemplate,
} from '@/modules/projects/types';

interface ApiEnvelope<T> { data: T }
interface ApiList<T> { data: T[]; total: number; limit: number; offset: number }

// ─── Normalized state ────────────────────────────────

interface ProjectsState {
  // Normalized entities
  boards: Board[];
  columns: Record<string, Column>;
  cards: Record<string, Card>;
  labels: Record<string, Label>;
  customFieldDefs: Record<string, CustomFieldDef>;
  automations: Automation[];

  // Relationship arrays (ordered)
  boardColumnIds: Record<string, string[]>;   // boardId → columnId[]
  columnCardIds: Record<string, string[]>;    // columnId → cardId[]
  cardLabelIds: Record<string, string[]>;     // cardId → labelId[]

  // Active board
  activeBoardId: string | null;
  activeBoardTitle: string | null;
  activeBoardPermission: 'owner' | 'edit' | 'view' | null;

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
  createBoard: (data: { title: string; description?: string; color?: string; icon?: string }) => Promise<Board | null>;
  updateBoard: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  archiveBoard: (id: string) => Promise<void>;
  unarchiveBoard: (id: string) => Promise<void>;

  // Column actions
  createColumn: (boardId: string, data: { title: string; color?: string; wip_limit?: number; is_done_column?: boolean }) => Promise<void>;
  updateColumn: (boardId: string, columnId: string, data: Record<string, unknown>) => Promise<void>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  reorderColumn: (boardId: string, columnId: string, position: number) => Promise<void>;
  collapseColumn: (boardId: string, columnId: string, collapsed: boolean) => Promise<void>;

  // Card actions
  createCard: (boardId: string, data: { column_id: string; title: string; priority?: string }) => Promise<void>;
  updateCard: (boardId: string, cardId: string, data: Record<string, unknown>) => Promise<void>;
  deleteCard: (boardId: string, cardId: string) => Promise<void>;
  moveCard: (boardId: string, cardId: string, columnId: string, position: number) => Promise<void>;

  // Automation actions
  fetchAutomations: (boardId: string) => Promise<void>;
  createAutomation: (boardId: string, data: Record<string, unknown>) => Promise<void>;
  updateAutomation: (boardId: string, automationId: string, data: Record<string, unknown>) => Promise<void>;
  deleteAutomation: (boardId: string, automationId: string) => Promise<void>;

  // Label actions
  createLabel: (boardId: string, data: { name: string; color: string }) => Promise<void>;
  updateLabel: (boardId: string, labelId: string, data: Record<string, unknown>) => Promise<void>;
  deleteLabel: (boardId: string, labelId: string) => Promise<void>;
  addLabelToCard: (boardId: string, cardId: string, labelId: string) => Promise<void>;
  removeLabelFromCard: (boardId: string, cardId: string, labelId: string) => Promise<void>;

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

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
  // Initial state
  boards: [],
  columns: {},
  cards: {},
  labels: {},
  customFieldDefs: {},
  automations: [],
  boardColumnIds: {},
  columnCardIds: {},
  cardLabelIds: {},
  activeBoardId: null,
  activeBoardTitle: null,
  activeBoardPermission: null,
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
      const cardLabelIds: Record<string, string[]> = {};

      const sortedCols = [...board.columns].sort((a, b) => a.position - b.position);
      for (const col of sortedCols) {
        const { cards: colCards, ...colData } = col;
        columns[col.id] = colData as Column;
        boardColumnIds.push(col.id);
        const sortedCards = [...(colCards ?? [])].sort((a, b) => a.position - b.position);
        columnCardIds[col.id] = sortedCards.map(c => c.id);
        for (const card of sortedCards) {
          // Extract embedded labels into cardLabelIds relationship
          const cardAny = card as Record<string, unknown>;
          const embeddedLabels = cardAny.labels as Array<{ id: string }> | undefined;
          if (embeddedLabels && embeddedLabels.length > 0) {
            cardLabelIds[card.id] = embeddedLabels.map(l => l.id);
          }
          cards[card.id] = card;
        }
      }

      // Normalize labels
      const labels: Record<string, Label> = {};
      for (const label of board.labels ?? []) {
        labels[label.id] = label;
      }

      // Normalize custom field defs
      const customFieldDefs: Record<string, CustomFieldDef> = {};
      for (const fd of board.custom_field_defs ?? []) {
        customFieldDefs[fd.id] = fd;
      }

      set({
        columns,
        cards,
        labels,
        customFieldDefs,
        boardColumnIds: { [boardId]: boardColumnIds },
        columnCardIds,
        cardLabelIds,
        activeBoardTitle: board.title,
        activeBoardPermission: board._permission ?? 'owner',
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
      set((s) => ({
        columns: { ...s.columns, [col.id]: col },
        boardColumnIds: {
          ...s.boardColumnIds,
          [boardId]: [...(s.boardColumnIds[boardId] ?? []), col.id],
        },
        columnCardIds: { ...s.columnCardIds, [col.id]: [] },
      }));
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
        [columnId]: { ...s.columns[columnId], position },
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
            [columnId]: { ...s.columns[columnId], position: prevPosition },
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
        [columnId]: { ...s.columns[columnId], collapsed },
      },
    }));
    try {
      await api.post(`/projects/boards/${boardId}/columns/${columnId}/collapse`, { collapsed });
    } catch {
      // Revert on failure
      set((s) => ({
        columns: {
          ...s.columns,
          [columnId]: { ...s.columns[columnId], collapsed: !collapsed },
        },
      }));
    }
  },

  // ─── Card actions ────────────────────────────────────

  createCard: async (boardId, data) => {
    try {
      const res = await api.post<ApiEnvelope<Card>>(`/projects/boards/${boardId}/cards`, data);
      const card = res.data;
      set((s) => ({
        cards: { ...s.cards, [card.id]: card },
        columnCardIds: {
          ...s.columnCardIds,
          [data.column_id]: [...(s.columnCardIds[data.column_id] ?? []), card.id],
        },
      }));
    } catch {
      toast.error('Error creating card');
    }
  },

  updateCard: async (boardId, cardId, data) => {
    try {
      const res = await api.patch<ApiEnvelope<Card>>(`/projects/boards/${boardId}/cards/${cardId}`, data);
      set((s) => ({
        cards: { ...s.cards, [cardId]: res.data },
      }));
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
          columnCardIds[colId] = columnCardIds[colId].filter(id => id !== cardId);
        }
        return {
          cards: restCards,
          columnCardIds,
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

  // ─── Label actions ───────────────────────────────────

  createLabel: async (boardId, data) => {
    try {
      const res = await api.post<ApiEnvelope<Label>>(`/projects/boards/${boardId}/labels`, data);
      set((s) => ({
        labels: { ...s.labels, [res.data.id]: res.data },
      }));
    } catch {
      toast.error('Error creating label');
    }
  },

  updateLabel: async (boardId, labelId, data) => {
    try {
      await api.patch(`/projects/boards/${boardId}/labels/${labelId}`, data);
      set((s) => ({
        labels: {
          ...s.labels,
          [labelId]: { ...s.labels[labelId], ...data } as Label,
        },
      }));
    } catch {
      toast.error('Error updating label');
    }
  },

  deleteLabel: async (boardId, labelId) => {
    try {
      await api.delete(`/projects/boards/${boardId}/labels/${labelId}`);
      set((s) => {
        const { [labelId]: _, ...rest } = s.labels;
        return { labels: rest };
      });
    } catch {
      toast.error('Error deleting label');
    }
  },

  addLabelToCard: async (boardId, cardId, labelId) => {
    try {
      await api.post(`/projects/boards/${boardId}/cards/${cardId}/labels/${labelId}`);
      set((s) => ({
        cardLabelIds: {
          ...s.cardLabelIds,
          [cardId]: [...(s.cardLabelIds[cardId] ?? []), labelId],
        },
      }));
    } catch {
      toast.error('Error adding label');
    }
  },

  removeLabelFromCard: async (boardId, cardId, labelId) => {
    try {
      await api.delete(`/projects/boards/${boardId}/cards/${cardId}/labels/${labelId}`);
      set((s) => ({
        cardLabelIds: {
          ...s.cardLabelIds,
          [cardId]: (s.cardLabelIds[cardId] ?? []).filter(id => id !== labelId),
        },
      }));
    } catch {
      toast.error('Error removing label');
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
    return ids.map(id => s.cards[id]).filter(Boolean);
  },

  getCard: (cardId) => get().cards[cardId],
  getColumn: (columnId) => get().columns[columnId],

  getOrderedColumns: () => {
    const s = get();
    const boardId = s.activeBoardId;
    if (!boardId) return [];
    const colIds = s.boardColumnIds[boardId] ?? [];
    return colIds.map(id => s.columns[id]).filter(Boolean).sort((a, b) => a.position - b.position);
  },

  // ─── WebSocket handlers ──────────────────────────────

  handleWsEvent: (event, data) => {
    const state = get();
    const boardId = state.activeBoardId;

    switch (event) {
      case 'kanban.card.created': {
        if (data.boardId !== boardId) return;
        const card = data.card as Card;
        set((s) => ({
          cards: { ...s.cards, [card.id]: card },
          columnCardIds: {
            ...s.columnCardIds,
            [card.column_id]: [...(s.columnCardIds[card.column_id] ?? []), card.id],
          },
        }));
        break;
      }

      case 'kanban.card.updated': {
        if (data.boardId !== boardId) return;
        const cardId = data.cardId as string;
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

      case 'kanban.card.moved': {
        if (data.boardId !== boardId) return;
        // Refetch for accurate position data
        state.fetchFullBoard(boardId!);
        break;
      }

      case 'kanban.card.deleted': {
        if (data.boardId !== boardId) return;
        const cardId = data.cardId as string;
        set((s) => {
          const { [cardId]: _, ...restCards } = s.cards;
          const columnCardIds = { ...s.columnCardIds };
          for (const colId of Object.keys(columnCardIds)) {
            columnCardIds[colId] = columnCardIds[colId].filter(id => id !== cardId);
          }
          return { cards: restCards, columnCardIds };
        });
        break;
      }

      case 'kanban.column.created': {
        if (data.boardId !== boardId) return;
        const col = data.column as Column;
        set((s) => ({
          columns: { ...s.columns, [col.id]: col },
          boardColumnIds: {
            ...s.boardColumnIds,
            [boardId!]: [...(s.boardColumnIds[boardId!] ?? []), col.id],
          },
          columnCardIds: { ...s.columnCardIds, [col.id]: [] },
        }));
        break;
      }

      case 'kanban.column.updated': {
        if (data.boardId !== boardId) return;
        const columnId = data.columnId as string;
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
        if (data.boardId !== boardId) return;
        const updates = data.updates as Record<string, unknown>;
        if (updates.title) set({ activeBoardTitle: String(updates.title) });
        break;
      }
    }
  },
}));
