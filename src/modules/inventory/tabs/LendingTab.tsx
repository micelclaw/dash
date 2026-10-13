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
import { AlertTriangle, Boxes, ChevronDown, ChevronRight, HandHeart } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { useInventoryStore } from '@/stores/inventory.store';
import { daysSince, daysUntil, thumbUrl } from '@/modules/inventory/types';
import type { InventoryEvent, InventoryItem } from '@/modules/inventory/types';

interface ContactLite {
  id: string;
  display_name: string;
}

function fmtDate(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Semáforo: verde <30d fuera, naranja 30-90d, rojo >90d o vencido. */
function loanDotColor(item: InventoryItem): string {
  const out = daysSince(item.lent_at);
  const overdue = item.lent_until !== null && (daysUntil(item.lent_until) ?? 0) < 0;
  if (overdue || (out !== null && out > 90)) return '#ef4444';
  if (out !== null && out >= 30) return '#fb923c';
  return '#4ade80';
}

function LoanPhoto({ item }: { item: InventoryItem }) {
  const fileId = item.photo_file_ids?.[0];
  if (fileId) {
    return (
      <img
        src={thumbUrl(fileId)}
        alt={item.name}
        style={{
          width: 48,
          height: 48,
          aspectRatio: '1 / 1',
          objectFit: 'cover',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Boxes size={16} style={{ color: 'var(--text-dim)' }} />
    </div>
  );
}

export function LendingTab() {
  const { alerts, items, fetchAlerts, returnItem, selectItem } = useInventoryStore();

  const [contactNames, setContactNames] = useState<Map<string, string>>(new Map());
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnBusy, setReturnBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [history, setHistory] = useState<InventoryEvent[]>([]);

  const loadHistory = async () => {
    try {
      const [lent, returned] = await Promise.all([
        api.get<{ data: InventoryEvent[] }>('/inventory/events', { type: 'lent', limit: 50 }),
        api.get<{ data: InventoryEvent[] }>('/inventory/events', { type: 'returned', limit: 50 }),
      ]);
      const merged = [...lent.data, ...returned.data]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50);
      setHistory(merged);
      setHistoryLoaded(true);
    } catch {
      toast.error('Could not load lending history');
    }
  };

  useEffect(() => {
    fetchAlerts();
    loadHistory();
    api
      .get<{ data: ContactLite[] }>('/contacts', { limit: 200 })
      .then(res => setContactNames(new Map(res.data.map(c => [c.id, c.display_name]))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loans = alerts?.active_loans ?? [];

  const itemNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) map.set(i.id, i.name);
    for (const l of loans) map.set(l.id, l.name);
    return map;
  }, [items, loans]);

  const confirmReturn = async (id: string) => {
    setReturnBusy(true);
    try {
      await returnItem(id, returnNotes.trim() ? { notes: returnNotes.trim() } : undefined);
      toast.success('Welcome back!');
      setReturningId(null);
      setReturnNotes('');
      void loadHistory();
    } catch {
      toast.error('Could not mark item as returned');
    } finally {
      setReturnBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 860 }}>
      <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
        Active loans ({loans.length})
      </h2>

      {loans.length === 0 ? (
        <div style={{ minHeight: 220 }}>
          <EmptyState
            icon={HandHeart}
            title="Nothing lent right now"
            description="Lend items from their drawer and track who has what."
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loans.map(item => {
            const contactName = (item.lent_to_contact_id && contactNames.get(item.lent_to_contact_id)) || 'contact';
            const out = daysSince(item.lent_at);
            const overdue = item.lent_until !== null && (daysUntil(item.lent_until) ?? 0) < 0;
            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <LoanPhoto item={item} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: loanDotColor(item),
                          flexShrink: 0,
                        }}
                      />
                      <button
                        onClick={() => selectItem(item.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: 'var(--text)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </button>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--mod-inventory)' }}>
                        → {contactName}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginTop: 4,
                        fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                      }}
                    >
                      {out !== null && <span>{out} days out</span>}
                      {item.lent_until && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: overdue ? '#ef4444' : 'var(--text-dim)',
                          }}
                        >
                          {overdue && <AlertTriangle size={12} />}
                          due {fmtDate(item.lent_until)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setReturningId(returningId === item.id ? null : item.id);
                        setReturnNotes('');
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                      }}
                    >
                      Returned
                    </button>
                    <button
                      disabled
                      // El tooltip prometía «flows» (MicelFlow), retirado el 2026-06-30 y
                      // sustituido por n8n: apuntaba a un destino que ya no existe. Queda
                      // honesto hasta que se decida por dónde sale el aviso (INV3).
                      title="Agent reminder — not wired up yet"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        cursor: 'not-allowed',
                        opacity: 0.6,
                      }}
                    >
                      Remind
                    </button>
                  </div>
                </div>

                {returningId === item.id && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      paddingTop: 10,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <input
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        padding: '6px 10px',
                        fontSize: '0.8125rem',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => confirmReturn(item.id)}
                      disabled={returnBusy}
                      style={{
                        background: 'var(--amber)',
                        color: '#06060a',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        cursor: returnBusy ? 'wait' : 'pointer',
                        opacity: returnBusy ? 0.7 : 1,
                      }}
                    >
                      {returnBusy ? 'Saving…' : 'Confirm return'}
                    </button>
                    <button
                      onClick={() => {
                        setReturningId(null);
                        setReturnNotes('');
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button
          onClick={() => setHistoryOpen(o => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          History
        </button>
        {historyOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {historyLoaded && history.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>No lending history yet.</span>
            )}
            {history.map(ev => {
              const isLent = ev.type === 'lent';
              const itemName = itemNames.get(ev.item_id);
              const contactName = ev.contact_id ? contactNames.get(ev.contact_id) : undefined;
              return (
                <div key={ev.id} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '2px 0' }}>
                  {fmtDate(ev.date)} ·{' '}
                  {itemName ? (
                    <span style={{ color: 'var(--text)' }}>{itemName}</span>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>(deleted item)</span>
                  )}{' '}
                  <span style={{ color: isLent ? '#fb923c' : '#4ade80' }}>{isLent ? '→' : '←'}</span>{' '}
                  {isLent ? (contactName ? `lent to ${contactName}` : 'lent') : 'returned'}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
        Lending with a date creates a return reminder in your Inventory calendar.
      </p>
    </div>
  );
}
