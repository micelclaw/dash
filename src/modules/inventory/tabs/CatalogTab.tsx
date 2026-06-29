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

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Boxes, ChevronDown, ChevronUp, ChevronsUpDown, Search, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { StatusPill } from '@/modules/gateway/components/StatusPill';
import { TagChip } from '@/components/shared/TagChip';
import { EmptyState } from '@/components/shared/EmptyState';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LabelModal } from '@/modules/inventory/components/LabelModal';
import { useInventoryStore, type ItemFilters } from '@/stores/inventory.store';
import { CustomFieldsEditor, CATEGORY_FIELD_TEMPLATES } from '@/modules/inventory/components/CustomFieldsEditor';
import {
  SYSTEM_STATUS_LABELS,
  STATUS_PILL_MAP,
  thumbUrl,
  fmtMoney,
  daysUntil,
  isAsset,
  type InventoryItem,
} from '@/modules/inventory/types';

const VIEW_STORAGE_KEY = 'inventory-view';

const selectStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  padding: '5px 8px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
};

const primaryBtnStyle: CSSProperties = {
  background: 'var(--amber)',
  color: '#06060a',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const secondaryBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const thStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--bg)',
  textTransform: 'uppercase',
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  textAlign: 'left',
  padding: '6px 10px',
  whiteSpace: 'nowrap',
  zIndex: 1,
};

const tdStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  verticalAlign: 'middle',
};

function ItemThumb({ item, size }: { item: InventoryItem; size: number | '100%' }) {
  const fileId = item.photo_file_ids?.[0];
  const base: CSSProperties = {
    width: size,
    height: size === '100%' ? 'auto' : size,
    aspectRatio: '1 / 1',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    flexShrink: 0,
  };
  if (fileId) {
    return <img src={thumbUrl(fileId)} alt={item.name} style={{ ...base, objectFit: 'cover', display: 'block' }} />;
  }
  return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Boxes size={16} style={{ color: 'var(--text-dim)' }} />
    </div>
  );
}

function ItemStatusPill({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const pillStatus = STATUS_PILL_MAP[status] ?? 'loading';
  const label = SYSTEM_STATUS_LABELS[status] ?? status;
  return <StatusPill status={pillStatus} label={label} size={size} />;
}

function WarrantyCell({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  if (d < 0) return <span style={{ color: 'var(--error)' }}>expired</span>;
  return <span style={{ color: d < 90 ? 'var(--amber)' : 'var(--text)' }}>{d}d</span>;
}

function QtyCell({ item }: { item: InventoryItem }) {
  if (!item.track_stock) return <span>{item.quantity}</span>;
  const qty = parseFloat(item.quantity);
  const min = item.min_qty !== null ? parseFloat(item.min_qty) : null;
  const low = min !== null && Number.isFinite(qty) && Number.isFinite(min) && qty < min;
  return (
    <span style={{ color: low ? 'var(--error)' : 'var(--text)' }}>
      {item.quantity}/{item.min_qty ?? '—'}
    </span>
  );
}

function ItemTagChips({ tags, onTagClick }: { tags: string[] | null; onTagClick: (tag: string) => void }) {
  if (!tags || tags.length === 0) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  const visible = tags.slice(0, 3);
  const extra = tags.length - visible.length;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map(t => (
        <span key={t} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
          <TagChip tag={t} size="xs" onClick={() => onTagClick(t)} />
        </span>
      ))}
      {extra > 0 && (
        <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)' }}>+{extra}</span>
      )}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
      {label}
      {children}
    </label>
  );
}

/** Categorías sugeridas (se mergean con las ya usadas en el inventario). */
const SUGGESTED_CATEGORIES = [
  'electronics', 'appliance', 'tool', 'vehicle', 'consumable',
  'furniture', 'sport', 'clothing', 'seguro',
];

/**
 * Combo de categoría con dropdown propio. Sustituye al <datalist> nativo,
 * que filtra las opciones por el valor actual del input — al reabrirlo con
 * una categoría ya seleccionada solo mostraba esa (bug reportado).
 * Regla: si el texto actual ES una opción exacta (o está vacío), se muestra
 * la lista completa; solo se filtra mientras se escribe algo nuevo.
 */
function CategoryCombo({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const all = useMemo(
    () => [...new Set([...options, ...SUGGESTED_CATEGORIES])].sort(),
    [options],
  );
  const query = value.trim().toLowerCase();
  const visible = query && !all.includes(query)
    ? all.filter(c => c.toLowerCase().includes(query))
    : all;

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={value}
        placeholder="e.g. electronics"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      />
      {open && visible.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 2,
          maxHeight: 180,
          overflowY: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          zIndex: 120,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {visible.map(c => (
            <div
              key={c}
              onMouseDown={e => { e.preventDefault(); onChange(c); setOpen(false); }}
              style={{
                padding: '6px 10px',
                fontSize: '0.8125rem',
                color: c === query ? 'var(--amber)' : 'var(--text)',
                cursor: 'pointer',
                background: 'transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface NewItemForm {
  name: string;
  category: string;
  location_id: string;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  purchase_price: string;
  warranty_until: string;
  quantity: string;
  track_stock: boolean;
  min_qty: string;
  uom: string;
  tags: string;
  description: string;
  customFields: Record<string, unknown>;
}

const EMPTY_FORM: NewItemForm = {
  name: '',
  category: '',
  location_id: '',
  brand: '',
  model: '',
  serial_number: '',
  purchase_date: '',
  purchase_price: '',
  warranty_until: '',
  quantity: '1',
  track_stock: false,
  min_qty: '',
  uom: '',
  tags: '',
  description: '',
  customFields: {},
};

function NewItemModal({ onClose }: { onClose: () => void }) {
  const { categories, locations, createItem } = useInventoryStore();
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof NewItemForm>(key: K, value: NewItemForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Al cambiar de categoría, los campos de PLANTILLA de otras categorías que
  // sigan vacíos se eliminan (no pueden colarse campos de vehicle en clothing).
  // Los que ya tienen valor se conservan: son datos del usuario (equivalen a
  // un campo añadido manualmente, que sigue estando permitido).
  const setCategory = (category: string) => {
    setForm(prev => {
      const newTemplate = new Set(CATEGORY_FIELD_TEMPLATES[category.trim().toLowerCase()] ?? []);
      const otherTemplateKeys = new Set(
        Object.entries(CATEGORY_FIELD_TEMPLATES)
          .filter(([cat]) => cat !== category.trim().toLowerCase())
          .flatMap(([, keys]) => keys),
      );
      const pruned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(prev.customFields)) {
        const isEmpty = v === '' || v === null || v === undefined;
        const fromOtherTemplate = otherTemplateKeys.has(k) && !newTemplate.has(k);
        if (fromOtherTemplate && isEmpty) continue;
        pruned[k] = v;
      }
      return { ...prev, category, customFields: pruned };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    const body: Record<string, unknown> = { name };
    if (form.category.trim()) body.category = form.category.trim();
    if (form.location_id) body.location_id = form.location_id;
    if (form.brand.trim()) body.brand = form.brand.trim();
    if (form.model.trim()) body.model = form.model.trim();
    if (form.serial_number.trim()) body.serial_number = form.serial_number.trim();
    if (form.purchase_date) body.purchase_date = form.purchase_date;
    if (form.purchase_price !== '') {
      const price = parseFloat(form.purchase_price);
      if (Number.isFinite(price)) body.purchase_price = price;
    }
    if (form.warranty_until) body.warranty_until = form.warranty_until;
    const qty = parseFloat(form.quantity);
    body.quantity = Number.isFinite(qty) ? qty : 1;
    if (form.track_stock) {
      body.track_stock = true;
      if (form.min_qty !== '') {
        const min = parseFloat(form.min_qty);
        if (Number.isFinite(min)) body.min_qty = min;
      }
      if (form.uom.trim()) body.uom = form.uom.trim();
    }
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length > 0) body.tags = tags;
    if (form.description.trim()) body.description = form.description.trim();
    const customFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form.customFields)) {
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed !== '') customFields[k] = trimmed;
      } else if (v !== null && v !== undefined) {
        customFields[k] = v;
      }
    }
    if (Object.keys(customFields).length > 0) body.custom_fields = customFields;

    setSubmitting(true);
    try {
      await createItem(body);
      toast.success('Item created');
      onClose();
    } catch {
      toast.error('Failed to create item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '80vh',
          overflow: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>New item</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Name *">
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} autoFocus required />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Category">
              <CategoryCombo value={form.category} onChange={setCategory} options={categories} />
            </Field>
            <Field label="Location">
              <select style={{ ...selectStyle, width: '100%', padding: '6px 8px' }} value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                <option value="">No location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Brand">
              <input style={inputStyle} value={form.brand} onChange={e => set('brand', e.target.value)} />
            </Field>
            <Field label="Model">
              <input style={inputStyle} value={form.model} onChange={e => set('model', e.target.value)} />
            </Field>
          </div>

          <Field label="Serial number">
            <input style={inputStyle} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Purchase date">
              <input style={inputStyle} type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
            </Field>
            <Field label="Purchase price">
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
            </Field>
            <Field label="Warranty until">
              <input style={inputStyle} type="date" value={form.warranty_until} onChange={e => set('warranty_until', e.target.value)} />
            </Field>
            <Field label="Quantity">
              <input style={inputStyle} type="number" min="0" step="any" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.track_stock} onChange={e => set('track_stock', e.target.checked)} />
            Track stock
          </label>

          {form.track_stock && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Min quantity">
                <input style={inputStyle} type="number" min="0" step="any" value={form.min_qty} onChange={e => set('min_qty', e.target.value)} />
              </Field>
              <Field label="Unit of measure">
                <input style={inputStyle} placeholder="unit, kg, l…" value={form.uom} onChange={e => set('uom', e.target.value)} />
              </Field>
            </div>
          )}

          <Field label="Tags (comma separated)">
            <input style={inputStyle} placeholder="electronics, office" value={form.tags} onChange={e => set('tags', e.target.value)} />
          </Field>

          <Field label="Description">
            <textarea
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </Field>

          <Field label="Custom fields">
            <CustomFieldsEditor
              value={form.customFields}
              onChange={next => set('customFields', next)}
              category={form.category.trim() || undefined}
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" style={secondaryBtnStyle} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...primaryBtnStyle, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ordenación de la tabla (cliente, sobre los items cargados) ─────
type SortKey = 'name' | 'category' | 'location' | 'qty' | 'value' | 'warranty' | 'status';
type SortDir = 'asc' | 'desc';

function sortValue(item: InventoryItem, key: SortKey, locationNames: Map<string, string>): string | number {
  switch (key) {
    case 'name': return item.name?.toLowerCase() ?? '';
    case 'category': return item.category?.toLowerCase() ?? '';
    case 'location': return item.location_id ? (locationNames.get(item.location_id) ?? '').toLowerCase() : '';
    case 'qty': { const q = parseFloat(item.quantity); return Number.isFinite(q) ? q : 0; }
    case 'value': {
      const p = parseFloat(item.purchase_price ?? '');
      const q = parseFloat(item.quantity);
      return Number.isFinite(p) ? p * (Number.isFinite(q) ? q : 1) : -1;
    }
    case 'warranty': { const d = daysUntil(item.warranty_until); return d === null ? Number.POSITIVE_INFINITY : d; }
    case 'status': return (SYSTEM_STATUS_LABELS[item.status] ?? item.status ?? '').toLowerCase();
  }
}

function sortItems(items: InventoryItem[], key: SortKey | null, dir: SortDir, locationNames: Map<string, string>): InventoryItem[] {
  if (!key) return items;
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = sortValue(a, key, locationNames);
    const bv = sortValue(b, key, locationNames);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av).localeCompare(String(bv), 'es', { numeric: true }) * sign;
  });
}

/** Cabecera de columna ordenable. */
function SortTh({ label, sortKey, active, dir, onSort, style }: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onSort: (k: SortKey) => void; style: CSSProperties;
}) {
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th style={style} scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none',
          padding: 0, font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit',
          color: active ? 'var(--text)' : 'var(--text-dim)', cursor: 'pointer',
        }}
      >
        {label}
        <Icon size={12} style={{ opacity: active ? 1 : 0.5 }} />
      </button>
    </th>
  );
}

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
  const [bulkTag, setBulkTag] = useState('');
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
              ...secondaryBtnStyle,
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
        <button style={primaryBtnStyle} onClick={() => setShowModal(true)}>
          + New item
        </button>
      </div>

      {/* Barra de acciones masivas — aparece al seleccionar filas */}
      {selectedCount > 0 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 3,
            background: 'color-mix(in srgb, var(--mod-inventory) 12%, var(--card))',
            borderBottom: '1px solid var(--mod-inventory)',
            padding: '8px 16px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {selectedCount} selected
          </span>

          {/* Mover a ubicación */}
          <select
            style={selectStyle}
            value=""
            disabled={bulkBusy}
            onChange={e => { const v = e.target.value; if (v) onBulkMove(v === '__none__' ? null : v); e.currentTarget.value = ''; }}
            aria-label="Move to location"
          >
            <option value="">Move to…</option>
            <option value="__none__">No location</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          {/* Cambiar estado */}
          <select
            style={selectStyle}
            value=""
            disabled={bulkBusy}
            onChange={e => { const v = e.target.value; if (v) onBulkStatus(v); e.currentTarget.value = ''; }}
            aria-label="Set status"
          >
            <option value="">Set status…</option>
            {systemStatuses.map(s => <option key={s} value={s}>{SYSTEM_STATUS_LABELS[s] ?? s}</option>)}
          </select>

          {/* Añadir tag */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <TagIcon size={13} style={{ position: 'absolute', left: 8, color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              style={{ ...inputStyle, width: 150, padding: '5px 8px 5px 26px' }}
              placeholder="Add tag + Enter"
              value={bulkTag}
              disabled={bulkBusy}
              onChange={e => setBulkTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && bulkTag.trim()) { onBulkTag(bulkTag); setBulkTag(''); } }}
            />
          </div>

          {/* Etiquetas QR */}
          <button
            style={{ ...secondaryBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            disabled={bulkBusy}
            onClick={() => setShowLabels(true)}
            title="Print QR labels for the selected items"
          >
            🏷 Labels
          </button>

          {/* Borrar en lote */}
          <button
            style={{ ...secondaryBtnStyle, color: 'var(--error)', borderColor: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            disabled={bulkBusy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={13} /> Delete
          </button>

          <button style={{ ...secondaryBtnStyle, marginLeft: 'auto' }} disabled={bulkBusy} onClick={clearSelection}>
            Clear
          </button>
        </div>
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
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = selectedCount > 0 && !allSelected; }}
                    onChange={toggleSelectAll}
                    aria-label="Select all items"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ ...thStyle, width: 38 }} />
                <SortTh label="Name" sortKey="name" active={sortKey === 'name'} dir={sortDir} onSort={onSort} style={thStyle} />
                <SortTh label="Category" sortKey="category" active={sortKey === 'category'} dir={sortDir} onSort={onSort} style={thStyle} />
                <SortTh label="Location" sortKey="location" active={sortKey === 'location'} dir={sortDir} onSort={onSort} style={thStyle} />
                <SortTh label="Qty" sortKey="qty" active={sortKey === 'qty'} dir={sortDir} onSort={onSort} style={thStyle} />
                <SortTh label="Value" sortKey="value" active={sortKey === 'value'} dir={sortDir} onSort={onSort} style={thStyle} />
                <SortTh label="Warranty" sortKey="warranty" active={sortKey === 'warranty'} dir={sortDir} onSort={onSort} style={thStyle} />
                <th style={thStyle} scope="col">Tags</th>
                <SortTh label="Status" sortKey="status" active={sortKey === 'status'} dir={sortDir} onSort={onSort} style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {displayItems.map(item => {
                const isSel = selected.has(item.id);
                const baseBg = isSel ? 'color-mix(in srgb, var(--mod-inventory) 10%, transparent)' : 'transparent';
                return (
                <tr
                  key={item.id}
                  onClick={() => selectItem(item.id)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
                  style={{ cursor: 'pointer', background: baseBg }}
                >
                  <td style={tdStyle} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.name}`}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={tdStyle}><ItemThumb item={item} size={28} /></td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    {(item.brand || item.model) && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                        {[item.brand, item.model].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{item.category ?? <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                  <td style={tdStyle}>
                    {item.location_id
                      ? locationNames.get(item.location_id) ?? <span style={{ color: 'var(--text-dim)' }}>—</span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={tdStyle}><QtyCell item={item} /></td>
                  <td style={tdStyle}>{fmtMoney(item.purchase_price, item.currency)}</td>
                  <td style={tdStyle}><WarrantyCell date={item.warranty_until} /></td>
                  <td style={tdStyle}><ItemTagChips tags={item.tags} onTagClick={t => applyFilters({ tag: t })} /></td>
                  <td style={tdStyle}><ItemStatusPill status={item.status} /></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 8,
              padding: '12px 16px',
            }}
          >
            {displayItems.map(item => {
              const isSel = selected.has(item.id);
              return (
              <div
                key={item.id}
                onClick={() => selectItem(item.id)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isSel ? 'var(--mod-inventory)' : 'var(--border)'; }}
                style={{
                  position: 'relative',
                  background: isSel ? 'color-mix(in srgb, var(--mod-inventory) 10%, var(--card))' : 'var(--card)',
                  border: `1px solid ${isSel ? 'var(--mod-inventory)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <label
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: 6, left: 6, zIndex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(item.id)}
                    aria-label={`Select ${item.name}`}
                    style={{ cursor: 'pointer', margin: 0 }}
                  />
                </label>
                <ItemThumb item={item} size="100%" />
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.category ?? '—'} · {fmtMoney(item.purchase_price, item.currency)}
                </div>
                <div>
                  <ItemStatusPill status={item.status} size="sm" />
                </div>
              </div>
              );
            })}
          </div>
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
