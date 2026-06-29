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

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Package,
  Truck,
  Archive,
  MapPin,
  Boxes,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LabelModal } from '@/modules/inventory/components/LabelModal';
import { fmtMoney, thumbUrl } from '@/modules/inventory/types';
import type { InventoryItem, InventoryLocation } from '@/modules/inventory/types';

type LocationKind = InventoryLocation['kind'];

const KIND_OPTIONS: Array<{ value: LocationKind; label: string; icon: LucideIcon }> = [
  { value: 'room', label: 'Room', icon: Home },
  { value: 'container', label: 'Container', icon: Package },
  { value: 'vehicle', label: 'Vehicle', icon: Truck },
  { value: 'storage', label: 'Storage', icon: Archive },
  { value: 'other', label: 'Other', icon: MapPin },
];

const KIND_ICONS: Record<LocationKind, LucideIcon> = {
  room: Home,
  container: Package,
  vehicle: Truck,
  storage: Archive,
  other: MapPin,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  outline: 'none',
};

const primaryBtn: CSSProperties = {
  background: 'var(--amber)',
  color: '#06060a',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
};

const secondaryBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function LocationsTab({ deepLinkLocationId, onLocationConsumed }: {
  deepLinkLocationId?: string | null;
  onLocationConsumed?: () => void;
} = {}) {
  const locations = useInventoryStore(s => s.locations);
  const createLocation = useInventoryStore(s => s.createLocation);
  const updateLocation = useInventoryStore(s => s.updateLocation);
  const deleteLocation = useInventoryStore(s => s.deleteLocation);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deep-link (?location_id=, QR de ubicación): selecciona la ubicación y limpia
  // el param. Guarda por valor presente; al limpiarse no re-dispara.
  useEffect(() => {
    if (deepLinkLocationId) {
      setSelectedId(deepLinkLocationId);
      onLocationConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkLocationId]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // -- New location form --
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formKind, setFormKind] = useState<LocationKind>('room');
  const [formParent, setFormParent] = useState('');
  const [creating, setCreating] = useState(false);

  // -- Edit state --
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editKind, setEditKind] = useState<LocationKind>('room');
  const [editParent, setEditParent] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showLabel, setShowLabel] = useState(false);

  // -- Items of selected location (local state, do NOT clobber Catalog filters) --
  const [locItems, setLocItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const byId = useMemo(() => {
    const m = new Map<string, InventoryLocation>();
    for (const loc of locations) m.set(loc.id, loc);
    return m;
  }, [locations]);

  const childrenMap = useMemo(() => {
    const m = new Map<string, InventoryLocation[]>();
    for (const loc of locations) {
      const key = loc.parent_id && byId.has(loc.parent_id) ? loc.parent_id : '';
      const arr = m.get(key) ?? [];
      arr.push(loc);
      m.set(key, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [locations, byId]);

  // When searching: a node is visible if it matches or any descendant matches.
  const visibleIds = useMemo<Set<string> | null>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const visible = new Set<string>();
    const visit = (loc: InventoryLocation): boolean => {
      const kids = childrenMap.get(loc.id) ?? [];
      let hit = loc.name.toLowerCase().includes(q);
      for (const kid of kids) {
        if (visit(kid)) hit = true;
      }
      if (hit) visible.add(loc.id);
      return hit;
    };
    for (const root of childrenMap.get('') ?? []) visit(root);
    return visible;
  }, [search, childrenMap]);

  // Flattened ordered list with depth, for the parent <select>.
  const flatTree = useMemo(() => {
    const out: Array<{ loc: InventoryLocation; depth: number }> = [];
    const walk = (loc: InventoryLocation, depth: number) => {
      out.push({ loc, depth });
      for (const kid of childrenMap.get(loc.id) ?? []) walk(kid, depth + 1);
    };
    for (const root of childrenMap.get('') ?? []) walk(root, 0);
    return out;
  }, [childrenMap]);

  // Totales ROLLUP: cada nodo agrega su conteo/valor DIRECTO + el de todos sus
  // descendientes (una habitación "vale" lo que hay en ella y en sus contenedores).
  const rollup = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    const compute = (loc: InventoryLocation): { count: number; value: number } => {
      const cached = m.get(loc.id);
      if (cached) return cached;
      let count = loc.item_count ?? 0;
      let value = parseFloat(loc.total_value) || 0;
      for (const kid of childrenMap.get(loc.id) ?? []) {
        const r = compute(kid);
        count += r.count;
        value += r.value;
      }
      const res = { count, value };
      m.set(loc.id, res);
      return res;
    };
    for (const root of childrenMap.get('') ?? []) compute(root);
    return m;
  }, [childrenMap]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // self + descendientes del seleccionado: no pueden ser su propio padre (ciclo).
  const selfAndDescendants = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    const visit = (loc: InventoryLocation) => {
      s.add(loc.id);
      for (const kid of childrenMap.get(loc.id) ?? []) visit(kid);
    };
    visit(selected);
    return s;
  }, [selected, childrenMap]);

  const ancestors = useMemo(() => {
    if (!selected) return [];
    const chain: InventoryLocation[] = [];
    let cur = selected.parent_id ? byId.get(selected.parent_id) : undefined;
    let guard = 0;
    while (cur && guard < 50) {
      chain.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      guard++;
    }
    return chain;
  }, [selected, byId]);

  const subLocations = selected ? childrenMap.get(selected.id) ?? [] : [];

  useEffect(() => {
    setEditing(false);
    if (!selectedId) {
      setLocItems([]);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    api
      .get<{ data: InventoryItem[] }>('/inventory/items', { location_id: selectedId, limit: 100 })
      .then(res => {
        if (!cancelled) setLocItems(res.data);
      })
      .catch(() => {
        if (!cancelled) setLocItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const toggleCollapsed = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const name = formName.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    setCreating(true);
    try {
      const loc = await createLocation({
        name,
        kind: formKind,
        parent_id: formParent || null,
      });
      toast.success('Location created');
      setFormName('');
      setFormParent('');
      setFormKind('room');
      setShowForm(false);
      setSelectedId(loc.id);
    } catch (err) {
      toast.error(errMessage(err, 'Could not create location'));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const name = editName.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await updateLocation(selected.id, { name, kind: editKind, parent_id: editParent || null });
      toast.success('Location updated');
      setEditing(false);
    } catch (err) {
      toast.error(errMessage(err, 'Could not update location'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteLocation(selected.id);
      toast.success('Location deleted');
      setSelectedId(null);
    } catch (err) {
      toast.error(errMessage(err, 'Could not delete location'));
    }
  };

  const renderNode = (loc: InventoryLocation, depth: number): ReactNode => {
    if (visibleIds && !visibleIds.has(loc.id)) return null;
    const kids = childrenMap.get(loc.id) ?? [];
    const hasChildren = kids.length > 0;
    const isCollapsed = !visibleIds && collapsed.has(loc.id); // search expands everything
    const isSelected = loc.id === selectedId;
    const KindIcon = KIND_ICONS[loc.kind];
    const r = rollup.get(loc.id) ?? { count: loc.item_count ?? 0, value: parseFloat(loc.total_value) || 0 };

    return (
      <div key={loc.id}>
        <div
          onClick={() => setSelectedId(loc.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            paddingLeft: 8 + depth * 14,
            cursor: 'pointer',
            borderLeft: isSelected ? '2px solid var(--amber)' : '2px solid transparent',
            background: isSelected ? 'var(--surface-hover)' : 'transparent',
            fontSize: '0.8125rem',
            color: 'var(--text)',
            minWidth: 0,
          }}
        >
          {hasChildren ? (
            <span
              onClick={e => {
                e.stopPropagation();
                toggleCollapsed(loc.id);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-dim)', flexShrink: 0 }}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </span>
          ) : (
            <span style={{ width: 12, flexShrink: 0 }} />
          )}
          <KindIcon size={14} style={{ color: 'var(--mod-inventory)', flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loc.name}
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', flexShrink: 0 }}>
            {r.count}
            {r.value > 0 ? ` · ${fmtMoney(r.value)}` : ''}
          </span>
        </div>
        {hasChildren && !isCollapsed && kids.map(kid => renderNode(kid, depth + 1))}
      </div>
    );
  };

  const roots = childrenMap.get('') ?? [];
  const FormKindIcon = KIND_ICONS[formKind];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ---- Left panel: search + create + tree ---- */}
      <div
        style={{
          width: 300,
          minWidth: 300,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="Search locations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ ...primaryBtn, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={14} />
            New location
          </button>
          {showForm && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 10,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <input
                type="text"
                placeholder="Name *"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FormKindIcon size={14} style={{ color: 'var(--mod-inventory)', flexShrink: 0 }} />
                <select
                  value={formKind}
                  onChange={e => setFormKind(e.target.value as LocationKind)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  {KIND_OPTIONS.map(k => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <select value={formParent} onChange={e => setFormParent(e.target.value)} style={inputStyle}>
                <option value="">No parent (top level)</option>
                {flatTree.map(({ loc, depth }) => (
                  <option key={loc.id} value={loc.id}>
                    {' '.repeat(depth * 2)}
                    {loc.name}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleCreate} disabled={creating} style={{ ...primaryBtn, flex: 1, opacity: creating ? 0.6 : 1 }}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button onClick={() => setShowForm(false)} style={secondaryBtn}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto', paddingBottom: 12 }}>
          {roots.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              No locations yet.
            </div>
          ) : (
            roots.map(root => renderNode(root, 0))
          )}
        </div>
      </div>

      {/* ---- Right panel: detail ---- */}
      <div style={{ flex: 1, padding: 16, overflow: 'auto', minWidth: 0 }}>
        {!selected ? (
          <EmptyState
            icon={MapPin}
            title="Select a location"
            description="Pick a location from the tree to see its details and the items stored there."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {ancestors.map(a => (
                    <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        onClick={() => setSelectedId(a.id)}
                        style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', cursor: 'pointer' }}
                      >
                        {a.name}
                      </span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>▸</span>
                    </span>
                  ))}
                  {editing ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ ...inputStyle, width: 200 }}
                        autoFocus
                      />
                      <select
                        value={editKind}
                        onChange={e => setEditKind(e.target.value as LocationKind)}
                        style={{ ...inputStyle, width: 120 }}
                      >
                        {KIND_OPTIONS.map(k => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editParent}
                        onChange={e => setEditParent(e.target.value)}
                        style={{ ...inputStyle, width: 150 }}
                        aria-label="Parent location"
                        title="Move under another location"
                      >
                        <option value="">No parent (top level)</option>
                        {flatTree
                          .filter(({ loc }) => !selfAndDescendants.has(loc.id))
                          .map(({ loc, depth }) => (
                            <option key={loc.id} value={loc.id}>
                              {' '.repeat(depth * 2)}
                              {loc.name}
                            </option>
                          ))}
                      </select>
                      <button onClick={handleSaveEdit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditing(false)} style={secondaryBtn}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                      {selected.name}
                    </h2>
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                  {selected.item_count} items here · {fmtMoney(selected.total_value)}
                  {subLocations.length > 0 && (() => {
                    const r = rollup.get(selected.id);
                    if (!r || r.count === selected.item_count) return null;
                    return (
                      <span style={{ marginLeft: 8, color: 'var(--mod-inventory)' }}>
                        · {r.count} incl. sub-locations · {fmtMoney(r.value)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              {!editing && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      setShowForm(true);
                      setFormParent(selected.id);
                      setFormName('');
                      setFormKind('container');
                    }}
                    style={secondaryBtn}
                    title="Add a sub-location inside this one"
                  >
                    <Plus size={13} />
                    Sub-location
                  </button>
                  <button
                    onClick={() => {
                      setEditName(selected.name);
                      setEditKind(selected.kind);
                      setEditParent(selected.parent_id ?? '');
                      setEditing(true);
                    }}
                    style={secondaryBtn}
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button onClick={() => setShowLabel(true)} style={secondaryBtn} title="Print a QR label for this location">
                    🏷 Label
                  </button>
                  <button onClick={() => setConfirmingDelete(true)} style={secondaryBtn}>
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              )}
            </div>

            {subLocations.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6 }}>Sub-locations</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {subLocations.map(sub => {
                    const SubIcon = KIND_ICONS[sub.kind];
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedId(sub.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 999,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <SubIcon size={12} style={{ color: 'var(--mod-inventory)' }} />
                        {sub.name}
                        <span style={{ color: 'var(--text-dim)' }}>{sub.item_count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6 }}>Items here</div>
              {itemsLoading ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
              ) : locItems.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No items in this location.</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                    gap: 12,
                  }}
                >
                  {locItems.map(item => {
                    const photoId = item.photo_file_ids?.[0];
                    return (
                      <div
                        key={item.id}
                        onClick={() => useInventoryStore.getState().selectItem(item.id)}
                        style={{ cursor: 'pointer', minWidth: 0 }}
                      >
                        {photoId ? (
                          <img
                            src={thumbUrl(photoId)}
                            alt={item.name}
                            style={{
                              width: '100%',
                              aspectRatio: '1 / 1',
                              objectFit: 'cover',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--surface)',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              aspectRatio: '1 / 1',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Boxes size={16} style={{ color: 'var(--text-dim)' }} />
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: '0.75rem',
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={item.name}
                        >
                          {item.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete && !!selected}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => { void handleDelete(); setConfirmingDelete(false); }}
        title="Delete location"
        description={selected
          ? `Delete "${selected.name}"? Items and sub-locations inside it will be left without a location.`
          : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      {showLabel && selected && (
        <LabelModal target="locations" ids={[selected.id]} onClose={() => setShowLabel(false)} />
      )}
    </div>
  );
}
