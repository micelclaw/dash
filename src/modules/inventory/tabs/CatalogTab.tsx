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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, Search } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LabelModal } from '@/modules/inventory/components/LabelModal';
import { useInventoryStore, type ItemFilters } from '@/stores/inventory.store';
import { SYSTEM_STATUS_LABELS, isAsset } from '@/modules/inventory/types';
import { btnPrimary, btnSecondary, inputStyle, selectStyle } from '@/modules/inventory/ui';
import { NewItemModal } from './catalog/NewItemModal';
import { BulkActionsBar } from './catalog/BulkActionsBar';
import { ItemsTable } from './catalog/ItemsTable';
import { ItemsGrid } from './catalog/ItemsGrid';
import { sortItems, type SortDir, type SortKey } from './catalog/sorting';

const VIEW_STORAGE_KEY = 'inventory-view';

export function CatalogTab() {
  const {
    items,
    itemsTotal,
    loading,
    locations,
    categories,
    tags,
    meta,
    itemFilters,
    fetchItems,
    fetchCategories,
    fetchTags,
    selectItem,
    bulkMoveItems,
    bulkSetStatusItems,
    bulkAddTagItems,
    bulkDeleteItems,
  } = useInventoryStore();

  const [view, setView] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === 'grid' || saved === 'list' ? saved : 'list';
  });
  const [search, setSearch] = useState(itemFilters.search ?? '');
  const [filters, setFilters] = useState<ItemFilters>(itemFilters);
  const [showModal, setShowModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assetsOnly, setAssetsOnly] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const filtersRef = useRef<ItemFilters>(filters);
  filtersRef.current = filters;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchCategories();
    void fetchTags();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations) map.set(l.id, l.name);
    return map;
  }, [locations]);

  const hasStockItems = useMemo(() => items.some(i => i.track_stock), [items]);

  const sortedItems = useMemo(
    () => sortItems(items, sortKey, sortDir, locationNames),
    [items, sortKey, sortDir, locationNames],
  );

  // Lente "Activos": filtro cliente sobre lo cargado (no hay filtro server-side
  // de is_asset; es una propiedad derivada). Distingue activos fijos de stock.
  const hasAssets = useMemo(() => items.some(isAsset), [items]);
  const displayItems = useMemo(
    () => (assetsOnly ? sortedItems.filter(isAsset) : sortedItems),
    [sortedItems, assetsOnly],
  );

  // La selección se limita a los items actualmente cargados: si cambian los
  // filtros/búsqueda, se purga lo que ya no esté presente.
  useEffect(() => {
    setSelected(prev => {
      if (prev.size === 0) return prev;
      const present = new Set(items.map(i => i.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) { if (present.has(id)) next.add(id); else changed = true; }
      return changed ? next : prev;
    });
  }, [items]);

  const selectedCount = selected.size;
  const allSelected = items.length > 0 && selectedCount === items.length;

  const changeView = (v: 'grid' | 'list') => {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const runBulk = async (label: string, fn: () => Promise<void>) => {
    setBulkBusy(true);
    try {
      await fn();
      toast.success(label);
      setSelected(new Set());
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const ids = () => [...selected];
  const onBulkMove = (locationId: string | null) =>
    runBulk(`${selectedCount} item(s) moved`, () => bulkMoveItems(ids(), locationId));
  const onBulkStatus = (status: string) =>
    runBulk(`${selectedCount} item(s) updated`, () => bulkSetStatusItems(ids(), status));
  const onBulkTag = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    void runBulk(`Tag "${t}" added to ${selectedCount} item(s)`, () => bulkAddTagItems(ids(), t));
  };
  const onBulkDelete = () =>
    runBulk(`${selectedCount} item(s) deleted`, () => bulkDeleteItems(ids()));

  const applyFilters = (patch: Partial<ItemFilters>) => {
    const next: ItemFilters = { ...filtersRef.current, ...patch };
    setFilters(next);
    void fetchItems(next);
  };

  const clearFilters = () => {
    setSearch('');
    const cleared: ItemFilters = {};
    setFilters(cleared);
    void fetchItems(cleared);
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      applyFilters({ search: value.trim() || undefined });
    }, 300);
  };

  const systemStatuses = meta?.system_statuses ?? [];
  const empty = items.length === 0 && !loading;
  // Distinguir "inventario vacío" de "el filtro/búsqueda no casó nada".
  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== null && v !== '' && v !== false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--bg)',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <ViewToggle view={view} onChange={changeView} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input
            style={{ ...inputStyle, width: 200, padding: '5px 8px 5px 26px' }}
            placeholder="Search items…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <select style={selectStyle} value={filters.category ?? ''} onChange={e => applyFilters({ category: e.target.value || undefined })}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select style={selectStyle} value={filters.status ?? ''} onChange={e => applyFilters({ status: e.target.value || undefined })}>
          <option value="">All statuses</option>
          {systemStatuses.map(s => <option key={s} value={s}>{SYSTEM_STATUS_LABELS[s] ?? s}</option>)}
        </select>

        <select style={selectStyle} value={filters.location_id ?? ''} onChange={e => applyFilters({ location_id: e.target.value || undefined })}>
          <option value="">All locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <select style={selectStyle} value={filters.tag ?? ''} onChange={e => applyFilters({ tag: e.target.value || undefined })}>
          <option value="">All tags</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {hasStockItems && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!filters.low_stock}
              onChange={e => applyFilters({ low_stock: e.target.checked || undefined })}
            />
            Low stock
          </label>
        )}

        {hasAssets && (
          <button
            type="button"
            onClick={() => setAssetsOnly(a => !a)}
            title="Show only fixed assets (machines, vehicles, equipment)"
            style={{
              ...btnSecondary,
              padding: '5px 10px',
              ...(assetsOnly
                ? { background: 'color-mix(in srgb, var(--mod-inventory) 16%, transparent)', borderColor: 'var(--mod-inventory)', color: 'var(--mod-inventory)', fontWeight: 600 }
                : {}),
            }}
          >
            🏭 Assets
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
          {!loading && (assetsOnly
            ? `${displayItems.length} ${displayItems.length === 1 ? 'asset' : 'assets'}`
            : items.length === itemsTotal
              ? `${itemsTotal} ${itemsTotal === 1 ? 'item' : 'items'}`
              : `${items.length} of ${itemsTotal}`)}
        </span>
        <button style={btnPrimary} onClick={() => setShowModal(true)}>
          + New item
        </button>
      </div>

      {/* Barra de acciones masivas — aparece al seleccionar filas */}
      {selectedCount > 0 && (
        <BulkActionsBar
          selectedCount={selectedCount}
          busy={bulkBusy}
          locations={locations}
          systemStatuses={systemStatuses}
          onMove={onBulkMove}
          onStatus={onBulkStatus}
          onAddTag={onBulkTag}
          onShowLabels={() => setShowLabels(true)}
          onDelete={() => setConfirmDelete(true)}
          onClear={clearSelection}
        />
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {empty ? (
          hasActiveFilters ? (
            <EmptyState
              icon={Search}
              title="No matching items"
              description="No items match your current search or filters."
              actions={[{ label: 'Clear filters', onClick: clearFilters, variant: 'primary' }]}
            />
          ) : (
            <EmptyState
              icon={Boxes}
              title="No items yet"
              description="Add your first possession or send a photo of a receipt to your agent."
              actions={[{ label: '+ New item', onClick: () => setShowModal(true), variant: 'primary' }]}
            />
          )
        ) : view === 'list' ? (
          <ItemsTable
            items={displayItems}
            locationNames={locationNames}
            selected={selected}
            allSelected={allSelected}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpen={selectItem}
            onTagClick={t => applyFilters({ tag: t })}
          />
        ) : (
          <ItemsGrid
            items={displayItems}
            selected={selected}
            onToggleSelect={toggleSelect}
            onOpen={selectItem}
          />
        )}

        {loading && items.length === 0 && !empty && (
          <div style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
        )}
      </div>

      {showModal && <NewItemModal onClose={() => setShowModal(false)} />}

      {showLabels && selectedCount > 0 && (
        <LabelModal target="items" ids={[...selected]} onClose={() => setShowLabels(false)} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onBulkDelete}
        title={`Delete ${selectedCount} item${selectedCount === 1 ? '' : 's'}?`}
        description="This soft-deletes the selected items. Their stock ledger is preserved and they can be recovered from the database."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
