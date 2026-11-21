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
import { useI18n } from '@/i18n';
import { ArrowRightLeft, HandHeart, RefreshCw, Trash2, Undo2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import { SYSTEM_STATUS_LABELS, type InventoryItem } from '@/modules/inventory/types';
import { btnPrimary, btnSecondary, inputStyle } from '@/modules/inventory/ui';
import { cardStyle, sectionLabel } from './drawer-ui';

interface ContactHit {
  id: string;
  display_name: string;
}

type ActionPanel = 'lend' | 'move' | 'status' | null;

interface ActionsSectionProps {
  item: InventoryItem;
  /** Re-fetch de la copia local del item cuando vive fuera del store. */
  refreshItem: () => Promise<void>;
  /** refreshItem + timeline — para mutaciones que generan eventos. */
  refreshAfter: () => Promise<void>;
  onShowLabel: () => void;
}

/** Botonera de acciones del item + mini-paneles Lend / Move / Status. */
export function ActionsSection({ item, refreshItem, refreshAfter, onShowLabel }: ActionsSectionProps) {
  const { t } = useI18n();
  const {
    items,
    locations,
    meta,
    lendItem,
    returnItem,
    setStatus,
    recordMove,
    uploadItemFile,
    deleteItem,
  } = useInventoryStore();

  const itemId = item.id;
  const isLent = item.status === 'lent';

  const [panel, setPanel] = useState<ActionPanel>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteTimer = useRef<number | null>(null);

  // Custom status creation (Set Status panel)
  const [newStatusOpen, setNewStatusOpen] = useState(false);
  const [newStatusDraft, setNewStatusDraft] = useState('');

  // Lend form state
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactHit[]>([]);
  const [lendContact, setLendContact] = useState<ContactHit | null>(null);
  const [lentUntil, setLentUntil] = useState('');
  const [lendNotes, setLendNotes] = useState('');

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

  const handleLend = async () => {
    if (!lendContact) return;
    try {
      await lendItem(itemId, {
        contact_id: lendContact.id,
        lent_until: lentUntil || undefined,
        notes: lendNotes.trim() || undefined,
      });
      await refreshAfter();
      toast.success(t('inventory.drawer.lentTo', { name: lendContact.display_name }));
      setPanel(null);
      setLendContact(null);
      setContactSearch('');
      setLentUntil('');
      setLendNotes('');
    } catch {
      toast.error(t('inventory.drawer.lendFailed'));
    }
  };

  const handleReturn = async () => {
    try {
      await returnItem(itemId);
      await refreshAfter();
      toast.success(t('inventory.drawer.itemReturned'));
    } catch {
      toast.error(t('inventory.drawer.returnFailed'));
    }
  };

  const handleMove = async (toLocationId: string) => {
    if (!toLocationId) return;
    try {
      await recordMove({ item_id: itemId, type: 'transfer', to_location_id: toLocationId });
      await refreshAfter();
      toast.success(t('inventory.drawer.itemMoved'));
      setPanel(null);
    } catch {
      toast.error(t('inventory.drawer.moveFailed'));
    }
  };

  const handleStatus = async (status: string) => {
    if (!status) return;
    try {
      await setStatus(itemId, status);
      await refreshAfter();
      toast.success(t('inventory.drawer.statusSetTo', { status: SYSTEM_STATUS_LABELS[status] ?? status }));
      setPanel(null);
      setNewStatusOpen(false);
      setNewStatusDraft('');
    } catch {
      toast.error(t('inventory.drawer.statusFailed'));
    }
  };

  const commitNewStatus = async () => {
    const slug = newStatusDraft.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!slug.replace(/_/g, '')) return;
    await handleStatus(slug);
  };

  const handleDocUpload = async (file: File) => {
    try {
      await uploadItemFile(itemId, file, 'doc');
      await refreshItem();
      toast.success(t('inventory.drawer.documentUploaded'));
    } catch {
      toast.error(t('inventory.drawer.uploadFailed'));
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
      toast.success(t('inventory.drawer.itemDeleted'));
    } catch {
      toast.error(t('inventory.drawer.deleteFailed'));
    }
  };

  const statuses = meta?.system_statuses ?? Object.keys(SYSTEM_STATUS_LABELS);
  // Custom statuses already in use across the catalog (anything non-system).
  const customStatuses = Array.from(
    new Set(items.map(i => i.status).filter(s => !(s in SYSTEM_STATUS_LABELS) && !statuses.includes(s))),
  ).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={sectionLabel}>{t('inventory.drawer.actions')}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button style={btnSecondary} onClick={() => setPanel(panel === 'lend' ? null : 'lend')}>
          <HandHeart size={14} /> {t('inventory.drawer.lend')}
        </button>
        {isLent && (
          <button style={btnSecondary} onClick={() => void handleReturn()}>
            <Undo2 size={14} /> {t('inventory.drawer.return')}
          </button>
        )}
        <button style={btnSecondary} onClick={() => setPanel(panel === 'move' ? null : 'move')}>
          <ArrowRightLeft size={14} /> {t('inventory.drawer.move')}
        </button>
        <button
          style={btnSecondary}
          onClick={() => {
            setPanel(panel === 'status' ? null : 'status');
            setNewStatusOpen(false);
            setNewStatusDraft('');
          }}
        >
          <RefreshCw size={14} /> {t('inventory.status')}
        </button>
        <label style={{ ...btnSecondary }}>
          <Upload size={14} /> {t('inventory.drawer.uploadDoc')}
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
        <button style={btnSecondary} onClick={onShowLabel} title={t('inventory.drawer.printLabel')}>
          🏷 {t('inventory.drawer.label')}
        </button>
        <button
          style={{
            ...btnSecondary,
            border: '1px solid var(--error)',
            color: 'var(--error)',
            ...(deleteArmed ? { background: 'color-mix(in srgb, var(--error) 13%, transparent)' } : {}),
          }}
          onClick={() => void handleDelete()}
        >
          <Trash2 size={14} /> {deleteArmed ? t('inventory.drawer.clickAgainDelete') : t('inventory.delete')}
        </button>
      </div>

      {/* Lend mini-form */}
      {panel === 'lend' && (
        <div style={{ ...cardStyle, gap: 8 }}>
          {lendContact ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)' }}>
              <span>
                {t('inventory.drawer.to')} <strong>{lendContact.display_name}</strong>
              </span>
              <button
                onClick={() => setLendContact(null)}
                aria-label={t('inventory.drawer.clearContact')}
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
                placeholder={t('inventory.drawer.searchContact')}
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
            aria-label={t('inventory.drawer.lentUntil')}
          />
          <input
            value={lendNotes}
            onChange={e => setLendNotes(e.target.value)}
            placeholder={t('inventory.drawer.lendNotes')}
            style={inputStyle}
          />
          <button style={{ ...btnPrimary, opacity: lendContact ? 1 : 0.5 }} disabled={!lendContact} onClick={() => void handleLend()}>
            {t('inventory.drawer.lendItem')}
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
            aria-label={t('inventory.drawer.moveTo')}
          >
            <option value="" disabled>
              {t('inventory.drawer.moveTo')}
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
            aria-label={t('inventory.drawer.setStatus')}
          >
            <option value="" disabled>
              {t('inventory.drawer.setStatus')}
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
            <option value="__new__">{t('inventory.drawer.newStatus')}</option>
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
                aria-label={t('inventory.drawer.newStatusName')}
              />
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                {t('inventory.drawer.customStatusHelp')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
