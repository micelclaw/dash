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

import { useEffect, useState } from 'react';
import { Boxes, PackageX, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useIsMobile } from '@/hooks/use-media-query';
import { useInventoryStore } from '@/stores/inventory.store';
import { LabelModal } from '@/modules/inventory/components/LabelModal';
import { MaintenancePlansSection } from '@/modules/inventory/components/MaintenancePlansSection';
import { DepreciationSection } from '@/modules/inventory/components/DepreciationSection';
import { ProductSettingsCard } from '@/modules/inventory/components/ProductSettingsCard';
import { useInventoryLinks } from '@/modules/inventory/hooks/use-inventory-links';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { TagInput } from '@/components/shared/TagInput';
import { TagChip } from '@/components/shared/TagChip';
import { EmptyState } from '@/components/shared/EmptyState';
import { AddLinkPopover } from './AddLinkPopover';
import { StatusPill } from '@/modules/gateway/components/StatusPill';
import {
  daysSince,
  daysUntil,
  fmtMoney,
  isAsset,
  SYSTEM_STATUS_LABELS,
  STATUS_PILL_MAP,
  type InventoryItem,
  type UpdateItemPayload,
} from '@/modules/inventory/types';
import { cardStyle, fmtDate, PhotoThumb, sectionLabel } from './item-drawer/drawer-ui';
import { EditItemCard } from './item-drawer/EditItemCard';
import { MeterCard } from './item-drawer/MeterCard';
import { ActionsSection } from './item-drawer/ActionsSection';
import { DetailsSection } from './item-drawer/DetailsSection';
import { TimelineSection } from './item-drawer/TimelineSection';
import { FilesSection } from './item-drawer/FilesSection';

export function ItemDrawer({ itemId }: { itemId: string }) {
  // Remount on item change so every bit of local form state resets cleanly.
  return <ItemDrawerInner key={itemId} itemId={itemId} />;
}

function ItemDrawerInner({ itemId }: { itemId: string }) {
  const {
    items,
    locations,
    events,
    selectItem,
    updateItem,
    uploadItemFile,
    fetchItemEvents,
    updateMeter,
    generateAssetTag,
  } = useInventoryStore();

  const storeItem = items.find(i => i.id === itemId);
  const [fetched, setFetched] = useState<InventoryItem | null>(null);
  // Item exists only as a soft-deleted record → read-only mode.
  const [fetchedDeleted, setFetchedDeleted] = useState(false);
  // Item is gone entirely (404 even with include_deleted) → empty state.
  const [loadFailed, setLoadFailed] = useState(false);
  const item: InventoryItem | undefined = storeItem ?? fetched ?? undefined;
  const { links: relatedLinks, loading: relatedLoading, refresh: refreshLinks } = useInventoryLinks(itemId);

  const [editMode, setEditMode] = useState(false);
  const [showLabel, setShowLabel] = useState(false);

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

  /** Copia local + timeline — tras mutaciones que generan eventos. */
  const refreshAfter = async () => {
    await Promise.all([refreshLocal(), fetchItemEvents(itemId)]);
  };

  const handleUpdate = async (body: UpdateItemPayload) => {
    const updated = await updateItem(itemId, body);
    if (!storeItem) setFetched(updated);
  };

  const handleTagsChange = (next: string[]) => {
    handleUpdate({ tags: next }).catch(() => toast.error('Failed to update tags'));
  };

  const submitMeterReading = async (value: number, unit?: string): Promise<boolean> => {
    try {
      await updateMeter(itemId, value, unit);
      await refreshAfter();
      toast.success('Reading logged');
      return true;
    } catch {
      toast.error('Failed to log reading');
      return false;
    }
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

  const generateTag = async (): Promise<InventoryItem> => {
    const updated = await generateAssetTag(itemId);
    if (!storeItem) setFetched(updated);
    return updated;
  };

  const isMobile = useIsMobile();
  const readOnly = fetchedDeleted;
  const itemEvents = events.filter(e => e.item_id === itemId);
  const locationName = item?.location_id
    ? (locations.find(l => l.id === item.location_id)?.name ?? item.location_id)
    : '—';
  const warrantyDays = item ? daysUntil(item.warranty_until) : null;
  const lentDays = item ? daysSince(item.lent_at) : null;
  const isLent = item?.status === 'lent';

  return (
    <div
      role="dialog"
      aria-label={item ? `Item: ${item.name}` : 'Item details'}
      style={
        isMobile
          ? {
              // A 393px el drawer lateral (40%) queda inservible: pasa a overlay
              // a pantalla completa sobre el contenido (con su propio botón de cierre).
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              width: '100%',
              maxWidth: '100%',
              height: '100%',
              background: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }
          : {
              width: 400,
              maxWidth: '40%',
              flexShrink: 0,
              height: '100%',
              background: 'var(--bg)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }
      }
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
        <div style={{ flex: 1, minHeight: 0 }}>
          <EmptyState
            icon={PackageX}
            title="This item no longer exists"
            description="It was probably deleted — its ledger entries remain."
            actions={[{ label: 'Close', onClick: () => selectItem(null), variant: 'secondary' }]}
          />
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
                  onClick={() => setEditMode(true)}
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
                item.asset_tag ? `🏷 ${item.asset_tag}` : null,
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
            <EditItemCard
              item={item}
              onSubmit={handleUpdate}
              onClose={() => setEditMode(false)}
              onGenerateTag={generateTag}
            />
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
          <MeterCard item={item} readOnly={readOnly} onSubmitReading={submitMeterReading} />

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

          {/* 3c. Maintenance plans (asset-aware: solo activos fijos) */}
          {!readOnly && isAsset(item) && <MaintenancePlansSection item={item} />}

          {/* 3d. Value / Depreciation (asset-aware) */}
          {!readOnly && isAsset(item) && <DepreciationSection item={item} />}

          {/* 3e. Producto / Comercial (F1: artículos no-activo → vendibles con stock/COGS) */}
          {!readOnly && !isAsset(item) && <ProductSettingsCard item={item} onSaved={refreshLocal} />}

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
            <ActionsSection
              item={item}
              refreshItem={refreshLocal}
              refreshAfter={refreshAfter}
              onShowLabel={() => setShowLabel(true)}
            />
          )}

          {/* 6. Details (collapsible) */}
          <DetailsSection item={item} readOnly={readOnly} locationName={locationName} onUpdate={handleUpdate} />

          {/* 7. Related — `margin -16` cancela el padding del header → sin tabulación */}
          <div style={{ position: 'relative', margin: '0 -16px' }}>
            {!readOnly && (
              <div style={{ position: 'absolute', top: 4, right: 16, zIndex: 2 }}>
                <AddLinkPopover itemId={itemId} onLinked={refreshLinks} />
              </div>
            )}
            <RelatedItemsPanel links={relatedLinks} loading={relatedLoading} onNavigate={() => selectItem(null)} sourceType="inventory_item" sourceId={itemId} />
            {itemId && <SimilarContentPanel sourceType="inventory_item" sourceId={itemId} />}
            {itemId && <GraphProximityPanel sourceType="inventory_item" sourceId={itemId} />}
          </div>

          {/* 8. Timeline */}
          <TimelineSection item={item} events={itemEvents} />

          {/* 9. Files */}
          <FilesSection item={item} />
        </div>
      )}

      {showLabel && <LabelModal target="items" ids={[itemId]} onClose={() => setShowLabel(false)} />}
    </div>
  );
}
