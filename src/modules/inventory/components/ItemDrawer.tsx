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

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  X,
  Plus,
  Boxes,
  FileText,
  HandHeart,
  Undo2,
  ArrowRightLeft,
  RefreshCw,
  Upload,
  Trash2,
  ChevronDown,
  ChevronRight,
  PackageX,
  Gauge,
  Check,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import { useInventoryLinks } from '@/modules/inventory/hooks/use-inventory-links';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { TagInput } from '@/components/shared/TagInput';
import { TagChip } from '@/components/shared/TagChip';
import { AddLinkPopover } from './AddLinkPopover';
import { CustomFieldsEditor } from './CustomFieldsEditor';
import { StatusPill } from '@/modules/gateway/components/StatusPill';
import type { InventoryItem, InventoryEvent } from '@/modules/inventory/types';
import {
  fmtMoney,
  fmtMeter,
  daysUntil,
  daysSince,
  thumbUrl,
  SYSTEM_STATUS_LABELS,
  STATUS_PILL_MAP,
} from '@/modules/inventory/types';

interface ContactHit {
  id: string;
  display_name: string;
}

type ActionPanel = 'lend' | 'move' | 'status' | null;

/** Timeline = real inventory_events + synthetic entries derived from the item. */
type TimelineEntry =
  | { kind: 'event'; id: string; date: string; ev: InventoryEvent }
  | { kind: 'purchased'; id: string; date: string }
  | { kind: 'warranty'; id: string; date: string };

const EVENT_DOT_COLORS: Record<string, string> = {
  acquired: 'var(--success)',
  returned: 'var(--success)',
  lent: 'var(--warning)',
  maintenance: '#3b82f6', // sin token azul en el sistema de diseño
  repair: '#3b82f6',
  moved: 'var(--text-muted)',
  disposed: 'var(--error)',
};
const DOT_FALLBACK = 'var(--text-muted)';

const btnSecondary: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

const btnPrimary: CSSProperties = {
  background: 'var(--amber)',
  color: '#06060a',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '6px 8px',
  fontSize: '0.8125rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const sectionLabel: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
};

const cardStyle: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

function fmtDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface EditCoreForm {
  name: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  purchase_price: string;
  warranty_until: string;
}

const EMPTY_EDIT_FORM: EditCoreForm = {
  name: '', category: '', brand: '', model: '', serial_number: '', purchase_date: '', purchase_price: '', warranty_until: '',
};

/** Una fecha ISO del backend → valor para <input type="date"> (YYYY-MM-DD). */
function toDateInput(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v.slice(0, 10) : '';
  return d.toISOString().slice(0, 10);
}

function buildEditForm(item: InventoryItem): EditCoreForm {
  return {
    name: item.name ?? '',
    category: item.category ?? '',
    brand: item.brand ?? '',
    model: item.model ?? '',
    serial_number: item.serial_number ?? '',
    purchase_date: toDateInput(item.purchase_date),
    purchase_price: item.purchase_price != null ? String(parseFloat(item.purchase_price)) : '',
    warranty_until: toDateInput(item.warranty_until),
  };
}

const editLabelStyle: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 3, display: 'block' };

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ width: 110, flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
        {label}
      </span>
      <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text)', wordBreak: 'break-word', lineHeight: '1.5' }}>
        {value}
      </span>
    </div>
  );
}

function PhotoThumb({ fileId, size }: { fileId: string; size: number }) {
  return (
    <img
      src={thumbUrl(fileId)}
      alt=""
      style={{
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        objectFit: 'cover',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    />
  );
}

export function ItemDrawer({ itemId }: { itemId: string }) {
  // Remount on item change so every bit of local form state resets cleanly.
  return <ItemDrawerInner key={itemId} itemId={itemId} />;
}

function ItemDrawerInner({ itemId }: { itemId: string }) {
  const {
    items,
    locations,
    meta,
    events,
    selectItem,
    updateItem,
    deleteItem,
    lendItem,
    returnItem,
    setStatus,
    recordMove,
    uploadItemFile,
    fetchItemEvents,
    updateMeter,
  } = useInventoryStore();

  const storeItem = items.find(i => i.id === itemId);
  const [fetched, setFetched] = useState<InventoryItem | null>(null);
  // Item exists only as a soft-deleted record → read-only mode.
  const [fetchedDeleted, setFetchedDeleted] = useState(false);
  // Item is gone entirely (404 even with include_deleted) → empty state.
  const [loadFailed, setLoadFailed] = useState(false);
  const item: InventoryItem | undefined = storeItem ?? fetched ?? undefined;
  const { links: relatedLinks, loading: relatedLoading, refresh: refreshLinks } = useInventoryLinks(itemId);

  // Local UI state
  const [panel, setPanel] = useState<ActionPanel>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Edición de campos core (nombre/categoría/marca/modelo/serial/compra/garantía).
  // Antes no había forma de editarlos tras crear el item; updateItem ya soporta
  // cualquier campo, así que el drawer es el lugar natural.
  const [editMode, setEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditCoreForm>(EMPTY_EDIT_FORM);
  const [qtyDraft, setQtyDraft] = useState('');
  const [fieldsDraft, setFieldsDraft] = useState<Record<string, unknown>>({});
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteTimer = useRef<number | null>(null);

  // Meter (wear counter) state
  const [meterEditOpen, setMeterEditOpen] = useState(false);
  const [meterAddOpen, setMeterAddOpen] = useState(false);
  const [meterDraft, setMeterDraft] = useState('');
  const [meterUnitDraft, setMeterUnitDraft] = useState('km');
  const [meterUnitCustom, setMeterUnitCustom] = useState('');
  const [meterConfirmLower, setMeterConfirmLower] = useState(false);

  // Custom status creation (Set Status panel)
  const [newStatusOpen, setNewStatusOpen] = useState(false);
  const [newStatusDraft, setNewStatusDraft] = useState('');

  // Lend form state
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactHit[]>([]);
  const [lendContact, setLendContact] = useState<ContactHit | null>(null);
  const [lentUntil, setLentUntil] = useState('');
  const [lendNotes, setLendNotes] = useState('');

  // Fetch item locally if it isn't in the store list. If it 404s (e.g. opened
  // from a ledger entry of a deleted item), retry with include_deleted to show
  // a read-only snapshot; only if that fails too, show the empty state.
  useEffect(() => {
    if (storeItem) return;
    let alive = true;
    (async () => {
      try {
        const res = await api.get<{ data: InventoryItem }>(`/inventory/items/${itemId}`);
        if (alive) setFetched(res.data);
      } catch {
        try {
          const res = await api.get<{ data: InventoryItem }>(`/inventory/items/${itemId}`, {
            include_deleted: true,
          });
          if (alive) {
            setFetched(res.data);
            setFetchedDeleted(true);
          }
        } catch {
          if (alive) setLoadFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [itemId, storeItem]);

  // Timeline
  useEffect(() => {
    fetchItemEvents(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Keep quantity draft in sync with the loaded item.
  useEffect(() => {
    if (item) setQtyDraft(item.quantity);
  }, [item?.quantity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-init the custom fields draft when the item (re)loads. The component
  // remounts per itemId (key in ItemDrawer), so this only tracks async load +
  // post-save refreshes of the same item.
  useEffect(() => {
    setFieldsDraft({ ...(item?.custom_fields ?? {}) });
  }, [item?.custom_fields]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contact search (debounced).
  useEffect(() => {
    if (panel !== 'lend' || !contactSearch.trim()) {
      setContactResults([]);
      return;
    }
    let alive = true;
    const t = window.setTimeout(() => {
      api
        .get<{ data: ContactHit[] }>('/contacts', { search: contactSearch.trim(), limit: 5 })
        .then(res => {
          if (alive) setContactResults(res.data);
        })
        .catch(() => {});
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [contactSearch, panel]);

  useEffect(
    () => () => {
      if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
    },
    [],
  );

  // Cerrar el drawer con Escape — salvo si se está escribiendo en un campo
  // (los inputs del medidor ya usan Escape para resetear su propio formulario,
  // y no queremos robarle ese Escape ni cerrar el panel a media edición).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      selectItem(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectItem]);

  /** Re-fetch the local copy after a mutation when the item lives outside the store list. */
  const refreshLocal = async () => {
    if (storeItem) return;
    try {
      const res = await api.get<{ data: InventoryItem }>(`/inventory/items/${itemId}`);
      setFetched(res.data);
    } catch {
      /* ignore */
    }
  };

  const handleUpdate = async (body: Record<string, unknown>) => {
    const updated = await updateItem(itemId, body);
    if (!storeItem) setFetched(updated);
  };

  const openEdit = () => {
    if (!item) return;
    setEditForm(buildEditForm(item));
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!item) return;
    const name = editForm.name.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    const body: Record<string, unknown> = {
      name,
      category: editForm.category.trim() || null,
      brand: editForm.brand.trim() || null,
      model: editForm.model.trim() || null,
      serial_number: editForm.serial_number.trim() || null,
      purchase_date: editForm.purchase_date || null,
      warranty_until: editForm.warranty_until || null,
    };
    if (editForm.purchase_price.trim() === '') {
      body.purchase_price = null;
    } else {
      const p = parseFloat(editForm.purchase_price);
      if (Number.isFinite(p)) body.purchase_price = p;
    }
    setEditSaving(true);
    try {
      await handleUpdate(body);
      toast.success('Item updated');
      setEditMode(false);
    } catch {
      toast.error('Failed to update item');
    } finally {
      setEditSaving(false);
    }
  };

  const handleTagsChange = (next: string[]) => {
    handleUpdate({ tags: next }).catch(() => toast.error('Failed to update tags'));
  };

  const commitQty = async () => {
    if (!item) return;
    const n = parseFloat(qtyDraft);
    if (!Number.isFinite(n) || n < 0) {
      setQtyDraft(item.quantity);
      return;
    }
    if (n === parseFloat(item.quantity)) return;
    try {
      await handleUpdate({ quantity: n });
      toast.success('Quantity updated');
    } catch {
      toast.error('Failed to update quantity');
      setQtyDraft(item.quantity);
    }
  };

  const resetMeterForms = () => {
    setMeterEditOpen(false);
    setMeterAddOpen(false);
    setMeterDraft('');
    setMeterUnitCustom('');
    setMeterConfirmLower(false);
  };

  const submitMeter = async (value: number, unit?: string) => {
    try {
      await updateMeter(itemId, value, unit);
      await Promise.all([refreshLocal(), fetchItemEvents(itemId)]);
      toast.success('Reading logged');
      resetMeterForms();
    } catch {
      toast.error('Failed to log reading');
    }
  };

  const commitMeterUpdate = () => {
    if (!item) return;
    const n = parseFloat(meterDraft);
    if (!Number.isFinite(n) || n < 0) return;
    const current = item.meter_value !== null ? parseFloat(item.meter_value) : NaN;
    if (Number.isFinite(current) && n < current && !meterConfirmLower) {
      setMeterConfirmLower(true);
      return;
    }
    void submitMeter(n);
  };

  const commitMeterAdd = () => {
    const n = parseFloat(meterDraft);
    const unit = meterUnitDraft === 'other' ? meterUnitCustom.trim() : meterUnitDraft;
    if (!Number.isFinite(n) || n < 0 || !unit) return;
    void submitMeter(n, unit);
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      await uploadItemFile(itemId, file, 'photo');
      await refreshLocal();
      toast.success('Photo uploaded');
    } catch {
      toast.error('Failed to upload photo');
    }
  };

  const handleDocUpload = async (file: File) => {
    try {
      await uploadItemFile(itemId, file, 'doc');
      await refreshLocal();
      toast.success('Document uploaded');
    } catch {
      toast.error('Failed to upload document');
    }
  };

  const handleLend = async () => {
    if (!lendContact) return;
    try {
      await lendItem(itemId, {
        contact_id: lendContact.id,
        lent_until: lentUntil || undefined,
        notes: lendNotes.trim() || undefined,
      });
      await Promise.all([refreshLocal(), fetchItemEvents(itemId)]);
      toast.success(`Lent to ${lendContact.display_name}`);
      setPanel(null);
      setLendContact(null);
      setContactSearch('');
      setLentUntil('');
      setLendNotes('');
    } catch {
      toast.error('Failed to lend item');
    }
  };

  const handleReturn = async () => {
    try {
      await returnItem(itemId);
      await Promise.all([refreshLocal(), fetchItemEvents(itemId)]);
      toast.success('Item returned');
    } catch {
      toast.error('Failed to return item');
    }
  };

  const handleMove = async (toLocationId: string) => {
    if (!toLocationId) return;
    try {
      await recordMove({ item_id: itemId, type: 'transfer', to_location_id: toLocationId });
      await Promise.all([refreshLocal(), fetchItemEvents(itemId)]);
      toast.success('Item moved');
      setPanel(null);
    } catch {
      toast.error('Failed to move item');
    }
  };

  const handleStatus = async (status: string) => {
    if (!status) return;
    try {
      await setStatus(itemId, status);
      await Promise.all([refreshLocal(), fetchItemEvents(itemId)]);
      toast.success(`Status set to ${SYSTEM_STATUS_LABELS[status] ?? status}`);
      setPanel(null);
      setNewStatusOpen(false);
      setNewStatusDraft('');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const commitNewStatus = async () => {
    const slug = newStatusDraft.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!slug.replace(/_/g, '')) return;
    await handleStatus(slug);
  };

  const handleSaveFields = async () => {
    try {
      await handleUpdate({ custom_fields: fieldsDraft });
      toast.success('Fields saved');
    } catch {
      toast.error('Failed to save fields');
    }
  };

  const handleDelete = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeleteArmed(false), 3000);
      return;
    }
    try {
      await deleteItem(itemId);
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const statuses = meta?.system_statuses ?? Object.keys(SYSTEM_STATUS_LABELS);
  // Custom statuses already in use across the catalog (anything non-system).
  const customStatuses = Array.from(
    new Set(items.map(i => i.status).filter(s => !(s in SYSTEM_STATUS_LABELS) && !statuses.includes(s))),
  ).sort();
  const readOnly = fetchedDeleted;
  const itemEvents = events.filter(e => e.item_id === itemId);
  const locationName = item?.location_id
    ? (locations.find(l => l.id === item.location_id)?.name ?? item.location_id)
    : '—';
  const warrantyDays = item ? daysUntil(item.warranty_until) : null;
  const lentDays = item ? daysSince(item.lent_at) : null;
  const isLent = item?.status === 'lent';
  const fieldsDirty = item
    ? JSON.stringify(fieldsDraft) !== JSON.stringify(item.custom_fields ?? {})
    : false;

  // Merge real events with synthetic purchase/warranty entries, sorted desc.
  const timeline: TimelineEntry[] = itemEvents.map<TimelineEntry>(ev => ({
    kind: 'event',
    id: ev.id,
    date: ev.date,
    ev,
  }));
  // Items created via purchase_in already get an 'acquired' event — don't duplicate.
  if (item?.purchase_date && !itemEvents.some(e => e.type === 'acquired')) {
    timeline.push({ kind: 'purchased', id: '__synthetic_purchased', date: item.purchase_date });
  }
  if (item?.warranty_until) {
    timeline.push({ kind: 'warranty', id: '__synthetic_warranty', date: item.warranty_until });
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div
      role="dialog"
      aria-label={item ? `Item: ${item.name}` : 'Item details'}
      style={{
        width: 400,
        maxWidth: '40%',
        flexShrink: 0,
        height: '100%',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Boxes size={16} style={{ color: 'var(--mod-inventory)' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Item</span>
        </div>
        <button
          onClick={() => selectItem(null)}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {loadFailed ? (
        <div
          style={{
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            textAlign: 'center',
          }}
        >
          <PackageX size={32} style={{ color: 'var(--text-dim)' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            This item no longer exists
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            It was probably deleted — its ledger entries remain.
          </span>
          <button style={{ ...btnSecondary, marginTop: 8 }} onClick={() => selectItem(null)}>
            Close
          </button>
        </div>
      ) : !item ? (
        <div style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
      ) : (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Deleted item banner (read-only mode) */}
          {readOnly && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
              }}
            >
              Deleted item
            </div>
          )}

          {/* 1. Gallery */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {(item.photo_file_ids ?? []).map(fid => (
              <PhotoThumb key={fid} fileId={fid} size={72} />
            ))}
            {!readOnly && (
              <label
                style={{
                  width: 72,
                  height: 72,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhotoUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          {/* 2. Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)' }}>{item.name}</span>
              <StatusPill
                status={STATUS_PILL_MAP[item.status] ?? 'stopped'}
                label={SYSTEM_STATUS_LABELS[item.status] ?? item.status}
              />
              {!readOnly && !editMode && (
                <button
                  onClick={openEdit}
                  title="Edit item"
                  aria-label="Edit item"
                  style={{
                    marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-dim)',
                    cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {[
                item.category,
                [item.brand, item.model].filter(Boolean).join(' ') || null,
                item.serial_number ? `SN ${item.serial_number}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </div>
          </div>

          {/* 2b. Edit core fields */}
          {!readOnly && editMode && (
            <div style={{ ...cardStyle, gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={sectionLabel}>Edit item</span>
              </div>
              <div>
                <label style={editLabelStyle}>Name *</label>
                <input
                  style={inputStyle}
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  aria-label="Item name"
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={editLabelStyle}>Category</label>
                  <input style={inputStyle} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <label style={editLabelStyle}>Serial number</label>
                  <input style={inputStyle} value={editForm.serial_number} onChange={e => setEditForm(f => ({ ...f, serial_number: e.target.value }))} />
                </div>
                <div>
                  <label style={editLabelStyle}>Brand</label>
                  <input style={inputStyle} value={editForm.brand} onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <label style={editLabelStyle}>Model</label>
                  <input style={inputStyle} value={editForm.model} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} />
                </div>
                <div>
                  <label style={editLabelStyle}>Purchase date</label>
                  <input style={inputStyle} type="date" value={editForm.purchase_date} onChange={e => setEditForm(f => ({ ...f, purchase_date: e.target.value }))} />
                </div>
                <div>
                  <label style={editLabelStyle}>Purchase price</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" value={editForm.purchase_price} onChange={e => setEditForm(f => ({ ...f, purchase_price: e.target.value }))} />
                </div>
                <div>
                  <label style={editLabelStyle}>Warranty until</label>
                  <input style={inputStyle} type="date" value={editForm.warranty_until} onChange={e => setEditForm(f => ({ ...f, warranty_until: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button style={btnSecondary} disabled={editSaving} onClick={() => setEditMode(false)}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: editSaving ? 0.6 : 1 }} disabled={editSaving} onClick={() => void saveEdit()}>
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* 3. Purchase / warranty */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
              Purchased {fmtDate(item.purchase_date)} · {fmtMoney(item.purchase_price, item.currency)}
            </div>
            {item.warranty_until && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)' }}>
                <span>Warranty until {fmtDate(item.warranty_until)}</span>
                {warrantyDays !== null && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background:
                        warrantyDays < 0 ? 'color-mix(in srgb, var(--error) 13%, transparent)' : warrantyDays < 90 ? 'color-mix(in srgb, var(--amber) 16%, transparent)' : 'var(--surface)',
                      color: warrantyDays < 0 ? 'var(--error)' : warrantyDays < 90 ? 'var(--amber)' : 'var(--text-dim)',
                    }}
                  >
                    {warrantyDays < 0 ? `expired ${Math.abs(warrantyDays)}d ago` : `${warrantyDays}d left`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3b. Meter (wear counter) */}
          {item.meter_unit || item.meter_value ? (
            <div style={{ ...cardStyle, gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Gauge size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                  Meter: {fmtMeter(item.meter_value, item.meter_unit)}
                </span>
                {item.meter_updated_at && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                    updated {fmtDate(item.meter_updated_at)}
                  </span>
                )}
                {!readOnly && !meterEditOpen && (
                  <button
                    style={{ ...btnSecondary, marginLeft: 'auto', padding: '2px 8px', fontSize: '0.6875rem' }}
                    onClick={() => {
                      setMeterDraft('');
                      setMeterConfirmLower(false);
                      setMeterEditOpen(true);
                    }}
                  >
                    Update
                  </button>
                )}
              </div>
              {!readOnly && meterEditOpen && (
                <>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      value={meterDraft}
                      onChange={e => {
                        setMeterDraft(e.target.value);
                        setMeterConfirmLower(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitMeterUpdate();
                        if (e.key === 'Escape') resetMeterForms();
                      }}
                      placeholder={`New reading${item.meter_unit ? ` (${item.meter_unit})` : ''}`}
                      autoFocus
                      style={{ ...inputStyle, flex: 1 }}
                      aria-label="New meter reading"
                    />
                    <button
                      style={{ ...btnPrimary, padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
                      onClick={commitMeterUpdate}
                      aria-label="Save reading"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                  {meterConfirmLower && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--amber)', flexWrap: 'wrap' }}>
                      <span>Lower than current — confirm?</span>
                      <button
                        style={{ ...btnSecondary, padding: '2px 8px', fontSize: '0.6875rem', color: 'var(--amber)', borderColor: 'var(--amber)' }}
                        onClick={commitMeterUpdate}
                      >
                        Confirm
                      </button>
                      <button
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.6875rem', padding: 0 }}
                        onClick={() => setMeterConfirmLower(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : !readOnly ? (
            meterAddOpen ? (
              <div style={{ ...cardStyle, gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Gauge size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Add meter</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    value={meterUnitDraft}
                    onChange={e => setMeterUnitDraft(e.target.value)}
                    style={{ ...inputStyle, width: 88, flexShrink: 0 }}
                    aria-label="Meter unit"
                  >
                    <option value="km">km</option>
                    <option value="h">h</option>
                    <option value="cycles">cycles</option>
                    <option value="uses">uses</option>
                    <option value="other">other…</option>
                  </select>
                  {meterUnitDraft === 'other' && (
                    <input
                      value={meterUnitCustom}
                      onChange={e => setMeterUnitCustom(e.target.value)}
                      placeholder="unit"
                      style={{ ...inputStyle, width: 72, flexShrink: 0 }}
                      aria-label="Custom meter unit"
                    />
                  )}
                  <input
                    type="number"
                    min={0}
                    value={meterDraft}
                    onChange={e => setMeterDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitMeterAdd();
                      if (e.key === 'Escape') resetMeterForms();
                    }}
                    placeholder="Value"
                    autoFocus
                    style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    aria-label="Meter value"
                  />
                  <button
                    style={{ ...btnPrimary, padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
                    onClick={commitMeterAdd}
                    aria-label="Save meter"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMeterDraft('');
                  setMeterAddOpen(true);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  alignSelf: 'flex-start',
                }}
              >
                <Gauge size={12} /> + Add meter (km, hours…)
              </button>
            )
          ) : null}

          {/* Lent card */}
          {isLent && (
            <div
              style={{
                ...cardStyle,
                background: 'color-mix(in srgb, var(--warning) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: 'var(--warning)', fontWeight: 600 }}>
                Lent{lentDays !== null ? ` · ${lentDays} days` : ''}
              </div>
              {item.lent_until && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Due back {fmtDate(item.lent_until)}</div>
              )}
            </div>
          )}

          {/* 4. Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={sectionLabel}>Tags</span>
            {readOnly ? (
              (item.tags ?? []).length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>No tags.</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(item.tags ?? []).map(tag => (
                    <TagChip key={tag} tag={tag} size="sm" />
                  ))}
                </div>
              )
            ) : (
              <TagInput tags={item.tags ?? []} onChange={handleTagsChange} size="sm" />
            )}
          </div>

          {/* 5. Actions */}
          {!readOnly && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={sectionLabel}>Actions</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button style={btnSecondary} onClick={() => setPanel(panel === 'lend' ? null : 'lend')}>
                <HandHeart size={14} /> Lend
              </button>
              {isLent && (
                <button style={btnSecondary} onClick={() => void handleReturn()}>
                  <Undo2 size={14} /> Return
                </button>
              )}
              <button style={btnSecondary} onClick={() => setPanel(panel === 'move' ? null : 'move')}>
                <ArrowRightLeft size={14} /> Move
              </button>
              <button
                style={btnSecondary}
                onClick={() => {
                  setPanel(panel === 'status' ? null : 'status');
                  setNewStatusOpen(false);
                  setNewStatusDraft('');
                }}
              >
                <RefreshCw size={14} /> Status
              </button>
              <label style={{ ...btnSecondary }}>
                <Upload size={14} /> Upload doc
                <input
                  type="file"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handleDocUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                style={{
                  ...btnSecondary,
                  border: '1px solid var(--error)',
                  color: 'var(--error)',
                  ...(deleteArmed ? { background: 'color-mix(in srgb, var(--error) 13%, transparent)' } : {}),
                }}
                onClick={() => void handleDelete()}
              >
                <Trash2 size={14} /> {deleteArmed ? 'Click again to delete' : 'Delete'}
              </button>
            </div>

            {/* Lend mini-form */}
            {panel === 'lend' && (
              <div style={{ ...cardStyle, gap: 8 }}>
                {lendContact ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)' }}>
                    <span>
                      To: <strong>{lendContact.display_name}</strong>
                    </span>
                    <button
                      onClick={() => setLendContact(null)}
                      aria-label="Clear contact"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      placeholder="Search contact…"
                      style={inputStyle}
                      autoFocus
                    />
                    {contactResults.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {contactResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setLendContact(c);
                              setContactResults([]);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              padding: '6px 8px',
                              fontSize: '0.8125rem',
                              color: 'var(--text)',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                            }}
                          >
                            {c.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <input
                  type="date"
                  value={lentUntil}
                  onChange={e => setLentUntil(e.target.value)}
                  style={inputStyle}
                  aria-label="Lent until (optional)"
                />
                <input
                  value={lendNotes}
                  onChange={e => setLendNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  style={inputStyle}
                />
                <button style={{ ...btnPrimary, opacity: lendContact ? 1 : 0.5 }} disabled={!lendContact} onClick={() => void handleLend()}>
                  Lend item
                </button>
              </div>
            )}

            {/* Move panel */}
            {panel === 'move' && (
              <div style={{ ...cardStyle, gap: 8 }}>
                <select
                  defaultValue=""
                  onChange={e => void handleMove(e.target.value)}
                  style={inputStyle}
                  aria-label="Move to location"
                >
                  <option value="" disabled>
                    Move to…
                  </option>
                  {locations
                    .filter(l => l.id !== item.location_id)
                    .map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Status panel */}
            {panel === 'status' && (
              <div style={{ ...cardStyle, gap: 8 }}>
                <select
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value === '__new__') {
                      setNewStatusOpen(true);
                      return;
                    }
                    setNewStatusOpen(false);
                    void handleStatus(e.target.value);
                  }}
                  style={inputStyle}
                  aria-label="Set status"
                >
                  <option value="" disabled>
                    Set status…
                  </option>
                  {statuses
                    .filter(s => s !== item.status)
                    .map(s => (
                      <option key={s} value={s}>
                        {SYSTEM_STATUS_LABELS[s] ?? s}
                      </option>
                    ))}
                  {customStatuses
                    .filter(s => s !== item.status)
                    .map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  <option value="__new__">+ New status…</option>
                </select>
                {newStatusOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      value={newStatusDraft}
                      onChange={e => setNewStatusDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void commitNewStatus();
                      }}
                      placeholder="e.g. for-sale"
                      autoFocus
                      style={inputStyle}
                      aria-label="New status name"
                    />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                      Custom states become columns on the Inventory board.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* 6. Details (collapsible) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setDetailsOpen(o => !o)}
              style={{
                ...sectionLabel,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
                textAlign: 'left',
              }}
            >
              {detailsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Details
            </button>
            {detailsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <DetailRow
                  label="Quantity"
                  value={
                    item.track_stock && !readOnly ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          value={qtyDraft}
                          onChange={e => setQtyDraft(e.target.value)}
                          onBlur={() => void commitQty()}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          style={{ ...inputStyle, width: 72, padding: '3px 6px' }}
                        />
                        {item.uom}
                      </span>
                    ) : (
                      `${item.quantity} ${item.uom}`
                    )
                  }
                />
                <DetailRow label="Min qty" value={item.min_qty ? `${item.min_qty} ${item.uom}` : '—'} />
                {(item.meter_unit || item.meter_value) && (
                  <DetailRow label="Meter unit" value={item.meter_unit ?? '—'} />
                )}
                <DetailRow label="Supplier SKU" value={item.supplier_sku ?? '—'} />
                <DetailRow label="Location" value={locationName} />
                <DetailRow label="Created by" value={item.created_by} />
                <DetailRow label="Description" value={item.description ?? '—'} />
                {readOnly ? (
                  item.custom_fields &&
                  Object.entries(item.custom_fields).map(([key, value]) => (
                    <DetailRow
                      key={key}
                      label={key}
                      value={typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—')}
                    />
                  ))
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--text-dim)',
                        }}
                      >
                        Custom fields
                      </span>
                      {fieldsDirty && (
                        <button
                          style={{ ...btnPrimary, padding: '2px 8px', fontSize: '0.6875rem' }}
                          onClick={() => void handleSaveFields()}
                        >
                          Save fields
                        </button>
                      )}
                    </div>
                    <CustomFieldsEditor
                      value={fieldsDraft}
                      onChange={setFieldsDraft}
                      category={item.category}
                      compact
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. Related */}
          <div style={{ position: 'relative' }}>
            {!readOnly && (
              <div style={{ position: 'absolute', top: 4, right: 16, zIndex: 2 }}>
                <AddLinkPopover itemId={itemId} onLinked={refreshLinks} />
              </div>
            )}
            <RelatedItemsPanel links={relatedLinks} loading={relatedLoading} onNavigate={() => selectItem(null)} />
          </div>

          {/* 8. Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={sectionLabel}>Timeline</span>
            {timeline.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>No events yet.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {timeline.map(entry => {
                  if (entry.kind === 'purchased') {
                    return (
                      <div key={entry.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            marginTop: 5,
                            flexShrink: 0,
                            background: 'var(--success)',
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                          {fmtDate(entry.date)} · purchased
                          {item.purchase_price && (
                            <span style={{ color: 'var(--text-dim)' }}>
                              {' '}· {fmtMoney(item.purchase_price, item.currency)}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  }
                  if (entry.kind === 'warranty') {
                    const upcoming = warrantyDays !== null && warrantyDays >= 0;
                    return (
                      <div key={entry.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            marginTop: 5,
                            flexShrink: 0,
                            boxSizing: 'border-box',
                            ...(upcoming
                              ? { background: 'transparent', border: '2px solid var(--amber)' }
                              : { background: 'var(--amber)' }),
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          {fmtDate(entry.date)} · warranty until
                          {warrantyDays !== null && (
                            <span
                              style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-sm)',
                                background: upcoming ? 'color-mix(in srgb, var(--amber) 16%, transparent)' : 'color-mix(in srgb, var(--error) 13%, transparent)',
                                color: upcoming ? 'var(--amber)' : 'var(--error)',
                              }}
                            >
                              {upcoming ? `${warrantyDays}d left` : 'expired'}
                            </span>
                          )}
                          {upcoming && (
                            <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)' }}>upcoming</span>
                          )}
                        </span>
                      </div>
                    );
                  }
                  const ev = entry.ev;
                  if (ev.type === 'meter_reading') {
                    const meterTxt = fmtMeter(ev.meter_value, item.meter_unit);
                    const notes = ev.notes?.trim() ?? '';
                    const rawVal = ev.meter_value !== null ? String(parseFloat(ev.meter_value)) : '';
                    const showNotes =
                      notes !== '' && notes !== meterTxt && notes !== rawVal && notes !== (ev.meter_value ?? '');
                    return (
                      <div key={ev.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            marginTop: 6,
                            marginLeft: 1,
                            flexShrink: 0,
                            background: 'var(--text-muted)',
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {fmtDate(ev.date)} · meter <span style={{ color: 'var(--text)' }}>{meterTxt}</span>
                          </span>
                          {showNotes && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', wordBreak: 'break-word' }}>
                              {ev.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          marginTop: 5,
                          flexShrink: 0,
                          background: EVENT_DOT_COLORS[ev.type] ?? DOT_FALLBACK,
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                          {fmtDate(ev.date)} · {ev.type}
                          {ev.cost && <span style={{ color: 'var(--text-dim)' }}> · {fmtMoney(ev.cost)}</span>}
                          {(ev.type === 'maintenance' || ev.type === 'repair') && ev.meter_value && (
                            <span style={{ color: 'var(--text-dim)' }}>
                              {' '}@ {fmtMeter(ev.meter_value, item.meter_unit)}
                            </span>
                          )}
                          {ev.next_due && <span style={{ color: 'var(--text-dim)' }}> · next: {fmtDate(ev.next_due)}</span>}
                        </span>
                        {ev.notes && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', wordBreak: 'break-word' }}>
                            {ev.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 9. Files */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={sectionLabel}>Files</span>
            {(item.file_ids ?? []).length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>No files.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(item.file_ids ?? []).map(fid => (
                  <div
                    key={fid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <FileText size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                    <span
                      style={{
                        flex: 1,
                        fontSize: '0.75rem',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-mono, monospace)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fid}
                    </span>
                    <button
                      onClick={() => window.open(`/api/v1/files/${fid}/download`)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--amber)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: 0,
                      }}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
