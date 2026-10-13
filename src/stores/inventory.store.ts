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
import type {
  InventoryItem,
  InventoryLocation,
  InventoryEvent,
  InventoryMove,
  InventoryProposal,
  InventoryAlerts,
  InventoryValuation,
  InventoryMeta,
} from '@/modules/inventory/types';

export interface ItemFilters {
  search?: string;
  category?: string;
  status?: string;
  location_id?: string;
  tag?: string;
  low_stock?: boolean;
}

interface InventoryState {
  items: InventoryItem[];
  itemsTotal: number;
  itemFilters: ItemFilters;
  locations: InventoryLocation[];
  alerts: InventoryAlerts | null;
  moves: InventoryMove[];
  movesTotal: number;
  proposals: InventoryProposal[];
  events: InventoryEvent[];
  upcomingEvents: InventoryEvent[];
  meta: InventoryMeta | null;
  tags: string[];
  categories: string[];
  valuation: InventoryValuation | null;
  loading: boolean;
  selectedItemId: string | null;

  fetchItems: (filters?: ItemFilters, opts?: { limit?: number; offset?: number }) => Promise<void>;
  fetchLocations: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchMoves: (filters?: { item_id?: string; type?: string; limit?: number }) => Promise<void>;
  fetchProposals: () => Promise<void>;
  fetchItemEvents: (itemId: string) => Promise<void>;
  fetchUpcoming: () => Promise<void>;
  fetchMeta: () => Promise<void>;
  fetchTags: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchValuation: (opts?: { at?: string; group_by?: 'category' | 'location' }) => Promise<void>;

  createItem: (body: Record<string, unknown>) => Promise<InventoryItem>;
  updateItem: (id: string, body: Record<string, unknown>) => Promise<InventoryItem>;
  generateAssetTag: (id: string) => Promise<InventoryItem>;
  deleteItem: (id: string) => Promise<void>;
  bulkMoveItems: (ids: string[], locationId: string | null) => Promise<void>;
  bulkSetStatusItems: (ids: string[], status: string) => Promise<void>;
  bulkAddTagItems: (ids: string[], tag: string) => Promise<void>;
  bulkDeleteItems: (ids: string[]) => Promise<void>;
  lendItem: (id: string, body: { contact_id: string; lent_until?: string; notes?: string }) => Promise<void>;
  returnItem: (id: string, body?: { notes?: string }) => Promise<void>;
  setStatus: (id: string, status: string) => Promise<void>;
  recordMove: (body: Record<string, unknown>) => Promise<void>;
  reverseMove: (id: string) => Promise<void>;
  updateMoveType: (id: string, type: string) => Promise<void>;
  deleteMove: (id: string) => Promise<void>;
  createLocation: (body: Record<string, unknown>) => Promise<InventoryLocation>;
  updateLocation: (id: string, body: Record<string, unknown>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  createEvent: (body: Record<string, unknown>) => Promise<void>;
  completeMaintenance: (eventId: string, body?: { cost?: number; notes?: string; meter_reading?: number }) => Promise<void>;
  updateMeter: (itemId: string, value: number, unit?: string) => Promise<void>;
  approveProposal: (id: string, payload?: Record<string, unknown>) => Promise<void>;
  rejectProposal: (id: string) => Promise<void>;
  uploadItemFile: (itemId: string, file: File, type: 'photo' | 'receipt' | 'manual' | 'doc') => Promise<string>;
  selectItem: (id: string | null) => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  itemsTotal: 0,
  itemFilters: {},
  locations: [],
  alerts: null,
  moves: [],
  movesTotal: 0,
  proposals: [],
  events: [],
  upcomingEvents: [],
  meta: null,
  tags: [],
  categories: [],
  valuation: null,
  loading: false,
  selectedItemId: null,

  fetchItems: async (filters, opts) => {
    const f = filters ?? get().itemFilters;
    set({ loading: true, itemFilters: f });
    try {
      const res = await api.get<{ data: InventoryItem[]; pagination?: { total: number } }>('/inventory/items', {
        search: f.search || undefined,
        category: f.category || undefined,
        status: f.status || undefined,
        location_id: f.location_id || undefined,
        tag: f.tag || undefined,
        low_stock: f.low_stock || undefined,
        limit: opts?.limit ?? 100,
        offset: opts?.offset ?? 0,
      });
      set({ items: res.data, itemsTotal: res.pagination?.total ?? res.data.length, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchLocations: async () => {
    const res = await api.get<{ data: InventoryLocation[] }>('/inventory/locations');
    set({ locations: res.data });
  },

  fetchAlerts: async () => {
    const res = await api.get<{ data: InventoryAlerts }>('/inventory/alerts');
    set({ alerts: res.data });
  },

  fetchMoves: async (filters) => {
    const res = await api.get<{ data: InventoryMove[]; pagination?: { total: number } }>('/inventory/moves', {
      item_id: filters?.item_id || undefined,
      type: filters?.type || undefined,
      limit: filters?.limit ?? 100,
    });
    set({ moves: res.data, movesTotal: res.pagination?.total ?? res.data.length });
  },

  fetchProposals: async () => {
    const res = await api.get<{ data: InventoryProposal[] }>('/inventory/proposals', { status: 'pending' });
    set({ proposals: res.data });
  },

  fetchItemEvents: async (itemId) => {
    const res = await api.get<{ data: InventoryEvent[] }>('/inventory/events', { item_id: itemId });
    set({ events: res.data });
  },

  fetchUpcoming: async () => {
    const res = await api.get<{ data: InventoryEvent[] }>('/inventory/events', { upcoming: true });
    set({ upcomingEvents: res.data });
  },

  fetchMeta: async () => {
    if (get().meta) return;
    const res = await api.get<{ data: InventoryMeta }>('/inventory/meta');
    set({ meta: res.data });
  },

  fetchTags: async () => {
    const res = await api.get<{ data: string[] }>('/inventory/tags');
    set({ tags: res.data });
  },

  fetchCategories: async () => {
    const res = await api.get<{ data: string[] }>('/inventory/categories');
    set({ categories: res.data });
  },

  fetchValuation: async (opts) => {
    const res = await api.get<{ data: InventoryValuation }>('/inventory/reports/valuation', {
      at: opts?.at || undefined,
      group_by: opts?.group_by || undefined,
    });
    set({ valuation: res.data });
  },

  createItem: async (body) => {
    const res = await api.post<{ data: InventoryItem }>('/inventory/items', body);
    await get().fetchItems();
    return res.data;
  },

  updateItem: async (id, body) => {
    const res = await api.patch<{ data: InventoryItem }>(`/inventory/items/${id}`, body);
    set({ items: get().items.map(i => (i.id === id ? res.data : i)) });
    return res.data;
  },

  generateAssetTag: async (id) => {
    const res = await api.post<{ data: InventoryItem }>(`/inventory/items/${id}/asset-tag`);
    set({ items: get().items.map(i => (i.id === id ? res.data : i)) });
    return res.data;
  },

  deleteItem: async (id) => {
    await api.delete(`/inventory/items/${id}`);
    set({ items: get().items.filter(i => i.id !== id), selectedItemId: null });
  },

  // Acciones masivas: aplican una operación a N items y refrescan una sola vez
  // (en vez de N veces). Respetan el ledger — solo tocan metadatos del item
  // (ubicación/tags/estado) o lo borran (soft-delete); la cantidad sigue siendo
  // derivada y los movimientos de stock no se tocan.
  bulkMoveItems: async (ids, locationId) => {
    await Promise.all(ids.map(id => api.patch(`/inventory/items/${id}`, { location_id: locationId })));
    await Promise.all([get().fetchItems(), get().fetchLocations()]);
  },

  bulkSetStatusItems: async (ids, status) => {
    await Promise.all(ids.map(id => api.post(`/inventory/items/${id}/status`, { status })));
    await Promise.all([get().fetchItems(), get().fetchAlerts()]);
  },

  bulkAddTagItems: async (ids, tag) => {
    const byId = new Map(get().items.map(i => [i.id, i]));
    await Promise.all(ids.map(id => {
      const it = byId.get(id);
      const existing = it?.tags ?? [];
      if (existing.includes(tag)) return Promise.resolve(undefined);
      return api.patch(`/inventory/items/${id}`, { tags: [...existing, tag] }).then(() => undefined);
    }));
    await Promise.all([get().fetchItems(), get().fetchTags()]);
  },

  bulkDeleteItems: async (ids) => {
    await Promise.all(ids.map(id => api.delete(`/inventory/items/${id}`)));
    const removed = new Set(ids);
    set({ items: get().items.filter(i => !removed.has(i.id)), selectedItemId: null });
    void get().fetchAlerts();
  },

  lendItem: async (id, body) => {
    await api.post(`/inventory/items/${id}/lend`, body);
    await Promise.all([get().fetchItems(), get().fetchAlerts()]);
  },

  returnItem: async (id, body) => {
    await api.post(`/inventory/items/${id}/return`, body ?? {});
    await Promise.all([get().fetchItems(), get().fetchAlerts()]);
  },

  setStatus: async (id, status) => {
    await api.post(`/inventory/items/${id}/status`, { status });
    await get().fetchItems();
  },

  recordMove: async (body) => {
    await api.post('/inventory/moves', body);
    await Promise.all([get().fetchMoves(), get().fetchItems()]);
  },

  reverseMove: async (id) => {
    await api.post(`/inventory/moves/${id}/reverse`);
    await Promise.all([get().fetchMoves(), get().fetchItems()]);
  },

  updateMoveType: async (id, type) => {
    await api.patch(`/inventory/moves/${id}`, { type });
    await Promise.all([get().fetchMoves(), get().fetchItems()]);
  },

  deleteMove: async (id) => {
    await api.delete(`/inventory/moves/${id}`);
    await Promise.all([get().fetchMoves(), get().fetchItems()]);
  },

  createLocation: async (body) => {
    const res = await api.post<{ data: InventoryLocation }>('/inventory/locations', body);
    await get().fetchLocations();
    return res.data;
  },

  updateLocation: async (id, body) => {
    await api.patch(`/inventory/locations/${id}`, body);
    await get().fetchLocations();
  },

  deleteLocation: async (id) => {
    await api.delete(`/inventory/locations/${id}`);
    await get().fetchLocations();
  },

  createEvent: async (body) => {
    await api.post('/inventory/events', body);
    if (typeof body.item_id === 'string') await get().fetchItemEvents(body.item_id);
    await get().fetchUpcoming();
  },

  completeMaintenance: async (eventId, body) => {
    await api.post(`/inventory/events/${eventId}/complete`, body ?? {});
    await Promise.all([get().fetchUpcoming(), get().fetchAlerts()]);
  },

  updateMeter: async (itemId, value, unit) => {
    await api.post(`/inventory/items/${itemId}/meter`, unit ? { value, unit } : { value });
    await Promise.all([get().fetchItems(), get().fetchUpcoming(), get().fetchAlerts()]);
  },

  approveProposal: async (id, payload) => {
    await api.post(`/inventory/proposals/${id}/approve`, payload ? { payload } : {});
    await Promise.all([get().fetchProposals(), get().fetchItems(), get().fetchAlerts()]);
  },

  rejectProposal: async (id) => {
    await api.post(`/inventory/proposals/${id}/reject`);
    await get().fetchProposals();
  },

  uploadItemFile: async (itemId, file, type) => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.upload<{ data: { file: { id: string }; item: InventoryItem } }>(`/inventory/items/${itemId}/upload?type=${type}`, form);
    set({ items: get().items.map(item => item.id === itemId ? res.data.item : item) });
    return res.data.file.id;
  },

  selectItem: (id) => set({ selectedItemId: id }),
}));
