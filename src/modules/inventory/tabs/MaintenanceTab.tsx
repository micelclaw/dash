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

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Boxes, Plus, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import { EmptyState } from '@/components/shared/EmptyState';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import { daysUntil, fmtMeter, fmtMoney, thumbUrl } from '@/modules/inventory/types';
import type { InventoryEvent, InventoryItem } from '@/modules/inventory/types';

const RED = '#ef4444';

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

const primaryBtnSm: CSSProperties = {
  ...primaryBtn,
  padding: '4px 10px',
  fontSize: '0.75rem',
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

const sectionHeader: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
};

const fieldLabel: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  marginBottom: 4,
  display: 'block',
};

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function fmtDate(date: string | null): string {
  if (!date) return '—';
  const t = new Date(date);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function typeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function dueColor(days: number | null): string {
  if (days === null) return 'var(--text-dim)';
  if (days < 0) return RED;
  if (days < 14) return 'var(--amber)';
  return 'var(--text-dim)';
}

function dueText(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `in ${days}d`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

interface MeterDue {
  due: number;
  unit: string | null;
  remaining: number | null;
  overdue: boolean;
  warn: boolean;
}

/** Meter threshold status of an event against its item's current meter. */
function meterDue(ev: InventoryEvent, item: InventoryItem | undefined): MeterDue | null {
  const due = num(ev.due_meter);
  if (due === null) return null;
  const unit = item?.meter_unit ?? null;
  const current = num(item?.meter_value);
  const remaining = current === null ? null : due - current;
  const rec = num(ev.recurrence_meter);
  const overdue = remaining !== null && remaining <= 0;
  const warn = !overdue && remaining !== null && rec !== null && rec > 0 && remaining <= rec * 0.15;
  return { due, unit, remaining, overdue, warn };
}

function basisBtn(active: boolean, disabled = false): CSSProperties {
  return {
    flex: 1,
    background: active ? 'var(--amber)' : 'var(--surface)',
    color: active ? '#06060a' : 'var(--text-dim)',
    fontWeight: active ? 600 : 500,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 10px',
    fontSize: '0.75rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEscapeToClose(onClose);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: '92vw',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'inline-flex' }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ItemThumb({ photoId, name, size }: { photoId: string | undefined; name: string; size: number }) {
  if (photoId) {
    return (
      <img
        src={thumbUrl(photoId)}
        alt={name}
        style={{
          width: size,
          height: size,
          aspectRatio: '1 / 1',
          objectFit: 'cover',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)',
          display: 'block',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        aspectRatio: '1 / 1',
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

interface ItemChain {
  itemId: string;
  name: string;
  photoId: string | undefined;
  currency: string;
  last: InventoryEvent | null;
  next: InventoryEvent | null;
  totalSpent: number;
}

export function MaintenanceTab() {
  const items = useInventoryStore(s => s.items);
  const upcomingEvents = useInventoryStore(s => s.upcomingEvents);
  const fetchUpcoming = useInventoryStore(s => s.fetchUpcoming);
  const createEvent = useInventoryStore(s => s.createEvent);
  const completeMaintenance = useInventoryStore(s => s.completeMaintenance);

  // Local copy of the full event log to build the per-item chains.
  const [allEvents, setAllEvents] = useState<InventoryEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  // -- Complete modal --
  const [completing, setCompleting] = useState<InventoryEvent | null>(null);
  const [completeCost, setCompleteCost] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeDate, setCompleteDate] = useState(todayIso());
  const [completeMeter, setCompleteMeter] = useState('');
  const [completeBusy, setCompleteBusy] = useState(false);

  // -- Schedule modal --
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedItemId, setSchedItemId] = useState('');
  const [schedType, setSchedType] = useState<'maintenance' | 'repair'>('maintenance');
  const [schedByDate, setSchedByDate] = useState(true);
  const [schedByMeter, setSchedByMeter] = useState(false);
  const [schedNextDue, setSchedNextDue] = useState('');
  const [schedRecurrence, setSchedRecurrence] = useState('');
  const [schedDueMeter, setSchedDueMeter] = useState('');
  const [schedRecurrenceMeter, setSchedRecurrenceMeter] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedBusy, setSchedBusy] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.get<{ data: InventoryEvent[] }>('/inventory/events', { limit: 200 });
      setAllEvents(res.data);
    } catch {
      // keep whatever we have
    } finally {
      setEventsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
    loadEvents();
  }, [fetchUpcoming, loadEvents]);

  const itemById = useMemo(() => {
    const m = new Map<string, (typeof items)[number]>();
    for (const item of items) m.set(item.id, item);
    return m;
  }, [items]);

  const upcomingSorted = useMemo(() => {
    const isOverdue = (ev: InventoryEvent): boolean => {
      const days = daysUntil(ev.next_due);
      if (days !== null && days < 0) return true;
      return meterDue(ev, itemById.get(ev.item_id))?.overdue ?? false;
    };
    return upcomingEvents
      .filter(ev => ev.next_due || ev.due_meter)
      .slice()
      .sort((a, b) => {
        // Overdue first (past date or meter exceeded), then date asc; meter-only entries close their group.
        const ao = isOverdue(a);
        const bo = isOverdue(b);
        if (ao !== bo) return ao ? -1 : 1;
        if (a.next_due && b.next_due) return a.next_due.localeCompare(b.next_due);
        if (a.next_due) return -1;
        if (b.next_due) return 1;
        const am = meterDue(a, itemById.get(a.item_id));
        const bm = meterDue(b, itemById.get(b.item_id));
        return (am?.remaining ?? am?.due ?? 0) - (bm?.remaining ?? bm?.due ?? 0);
      });
  }, [upcomingEvents, itemById]);

  const chains = useMemo<ItemChain[]>(() => {
    const byItem = new Map<string, InventoryEvent[]>();
    for (const ev of allEvents) {
      if (ev.type !== 'maintenance' && ev.type !== 'repair') continue;
      const arr = byItem.get(ev.item_id) ?? [];
      arr.push(ev);
      byItem.set(ev.item_id, arr);
    }
    const out: ItemChain[] = [];
    for (const [itemId, evs] of byItem) {
      evs.sort((a, b) => b.date.localeCompare(a.date));
      const last = evs[0] ?? null;
      const next = upcomingSorted.find(u => u.item_id === itemId) ?? null;
      let totalSpent = 0;
      for (const ev of evs) {
        const c = ev.cost === null ? NaN : parseFloat(ev.cost);
        if (Number.isFinite(c)) totalSpent += c;
      }
      const item = itemById.get(itemId);
      out.push({
        itemId,
        name: item?.name ?? 'Unknown item',
        photoId: item?.photo_file_ids?.[0],
        currency: item?.currency ?? 'EUR',
        last,
        next,
        totalSpent,
      });
    }
    // Items with an upcoming due date first (next_due asc), then meter-only nexts, then the rest.
    out.sort((a, b) => {
      const ad = a.next?.next_due ?? null;
      const bd = b.next?.next_due ?? null;
      if (ad && bd) return ad.localeCompare(bd);
      if (ad) return -1;
      if (bd) return 1;
      if (a.next && !b.next) return -1;
      if (!a.next && b.next) return 1;
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [allEvents, upcomingSorted, itemById]);

  const openComplete = (ev: InventoryEvent) => {
    setCompleteCost('');
    setCompleteNotes('');
    setCompleteDate(todayIso());
    setCompleteMeter(itemById.get(ev.item_id)?.meter_value ?? '');
    setCompleting(ev);
  };

  const handleComplete = async () => {
    if (!completing) return;
    setCompleteBusy(true);
    try {
      const body: { cost?: number; notes?: string; meter_reading?: number } = {};
      const cost = parseFloat(completeCost);
      if (Number.isFinite(cost)) body.cost = cost;
      if (completeNotes.trim()) body.notes = completeNotes.trim();
      const reading = parseFloat(completeMeter);
      if (Number.isFinite(reading)) body.meter_reading = reading;
      const recMeter = num(completing.recurrence_meter);
      const hadRecurrence =
        (completing.recurrence_months !== null && completing.recurrence_months > 0) || (recMeter !== null && recMeter > 0);
      const unit = itemById.get(completing.item_id)?.meter_unit;
      await completeMaintenance(completing.id, body);
      if (recMeter !== null && recMeter > 0 && Number.isFinite(reading)) {
        toast.success(`Done — next at ${fmtMeter(reading + recMeter, unit)}`);
      } else {
        toast.success(hadRecurrence ? 'Done — next one scheduled' : 'Maintenance completed');
      }
      setCompleting(null);
      await loadEvents();
    } catch (err) {
      toast.error(errMessage(err, 'Could not complete maintenance'));
    } finally {
      setCompleteBusy(false);
    }
  };

  const openSchedule = () => {
    setSchedItemId('');
    setSchedType('maintenance');
    setSchedByDate(true);
    setSchedByMeter(false);
    setSchedNextDue('');
    setSchedRecurrence('');
    setSchedDueMeter('');
    setSchedRecurrenceMeter('');
    setSchedNotes('');
    setShowSchedule(true);
  };

  const handleSchedule = async () => {
    if (!schedItemId) {
      toast.error('Item is required');
      return;
    }
    if (!schedByDate && !schedByMeter) {
      toast.error('Pick at least one basis: date or meter');
      return;
    }
    if (schedByDate && !schedNextDue) {
      toast.error('Due date is required');
      return;
    }
    const dueMeter = parseFloat(schedDueMeter);
    if (schedByMeter && !(Number.isFinite(dueMeter) && dueMeter > 0)) {
      toast.error('Due meter value is required');
      return;
    }
    setSchedBusy(true);
    try {
      const body: Record<string, unknown> = {
        item_id: schedItemId,
        type: schedType,
      };
      if (schedByDate) {
        body.next_due = schedNextDue;
        const rec = parseInt(schedRecurrence, 10);
        if (Number.isFinite(rec) && rec > 0) body.recurrence_months = rec;
      }
      if (schedByMeter) {
        body.due_meter = dueMeter;
        const recMeter = parseFloat(schedRecurrenceMeter);
        if (Number.isFinite(recMeter) && recMeter > 0) body.recurrence_meter = recMeter;
      }
      if (schedNotes.trim()) body.notes = schedNotes.trim();
      await createEvent(body);
      toast.success('Maintenance scheduled');
      setShowSchedule(false);
      await loadEvents();
    } catch (err) {
      toast.error(errMessage(err, 'Could not schedule maintenance'));
    } finally {
      setSchedBusy(false);
    }
  };

  const schedItem = itemById.get(schedItemId);
  const schedHasMeter = !!schedItem?.meter_unit;

  const completingItem = completing ? itemById.get(completing.item_id) : undefined;
  const showCompleteMeter =
    !!completing &&
    !!(completing.due_meter || completing.recurrence_meter || completingItem?.meter_unit || completingItem?.meter_value);

  const isEmpty = eventsLoaded && upcomingSorted.length === 0 && chains.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {isEmpty ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <EmptyState
            icon={Wrench}
            title="No maintenance scheduled"
            description="Schedule ITV, boiler service or any recurring care — completing one reschedules the next automatically."
            actions={[{ label: 'Schedule maintenance', onClick: openSchedule, variant: 'primary' }]}
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* ---- Left: upcoming ---- */}
          <div
            style={{
              width: 380,
              minWidth: 380,
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={sectionHeader}>Upcoming</span>
              <button onClick={openSchedule} style={secondaryBtn}>
                <Plus size={13} />
                Schedule maintenance
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 12px' }}>
              {upcomingSorted.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
                  Nothing due. Schedule the next one above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcomingSorted.map(ev => {
                    const item = itemById.get(ev.item_id);
                    const days = daysUntil(ev.next_due);
                    const meter = meterDue(ev, item);
                    const meterColor = meter?.overdue ? RED : meter?.warn ? 'var(--amber)' : 'var(--text-dim)';
                    return (
                      <div
                        key={ev.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <Wrench size={14} style={{ color: 'var(--mod-inventory)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={`${typeLabel(ev.type)} · ${item?.name ?? 'Unknown item'}`}
                          >
                            {typeLabel(ev.type)} · {item?.name ?? 'Unknown item'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                            {ev.next_due ? (
                              <span style={{ color: dueColor(days) }}>
                                {fmtDate(ev.next_due)}
                                {dueText(days) ? ` · ${dueText(days)}` : ''}
                              </span>
                            ) : null}
                            {meter ? (
                              <>
                                {ev.next_due ? ' · ' : ''}
                                at {fmtMeter(meter.due, meter.unit)}
                                {meter.remaining !== null ? (
                                  <span style={{ color: meterColor }}>
                                    {' · '}
                                    {meter.overdue
                                      ? `overdue by ${fmtMeter(Math.abs(meter.remaining), meter.unit)}`
                                      : `in ${fmtMeter(meter.remaining, meter.unit)}`}
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                            {ev.recurrence_months ? (
                              <span style={{ color: 'var(--text-dim)' }}> · every {ev.recurrence_months}mo</span>
                            ) : null}
                            {ev.recurrence_meter ? (
                              <span style={{ color: 'var(--text-dim)' }}> · every {fmtMeter(ev.recurrence_meter, meter?.unit ?? item?.meter_unit)}</span>
                            ) : null}
                          </div>
                        </div>
                        <button onClick={() => openComplete(ev)} style={primaryBtnSm}>
                          Complete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ---- Right: per-item chains ---- */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px 8px' }}>
              <span style={sectionHeader}>Chains · last / next</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 12px' }}>
              {chains.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
                  No maintenance history yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chains.map(chain => {
                    const chainItem = itemById.get(chain.itemId);
                    const unit = chainItem?.meter_unit ?? null;
                    const nextDays = daysUntil(chain.next?.next_due ?? null);
                    const nextMeter = chain.next ? meterDue(chain.next, chainItem) : null;
                    const nextColor = nextMeter?.overdue ? RED : dueColor(nextDays);
                    return (
                      <div
                        key={chain.itemId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '8px 12px',
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <ItemThumb photoId={chain.photoId} name={chain.name} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={chain.name}
                          >
                            {chain.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                            {chain.last ? (
                              <>
                                last {chain.last.type} {fmtDate(chain.last.date)} ({fmtMoney(chain.last.cost, chain.currency)})
                                {chain.last.meter_value ? <> @ {fmtMeter(chain.last.meter_value, unit)}</> : null}
                              </>
                            ) : (
                              'no history'
                            )}
                            {' '}
                            {chain.next ? (
                              <span style={{ color: nextColor }}>
                                → next{chain.next.next_due ? ` ${fmtDate(chain.next.next_due)}` : ''}
                                {nextMeter ? ` @ ${fmtMeter(nextMeter.due, unit)}` : ''}
                              </span>
                            ) : (
                              <span>— </span>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', flexShrink: 0, textAlign: 'right' }}>
                          total spent: <span style={{ color: 'var(--text)' }}>{fmtMoney(chain.totalSpent, chain.currency)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '0.75rem',
          color: 'var(--text-dim)',
          flexShrink: 0,
        }}
      >
        Each due date will appear in your Inventory calendar with reminders.
      </div>

      {/* ---- Complete modal ---- */}
      {completing && (
        <Modal title={`Complete ${completing.type}`} onClose={() => setCompleting(null)}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            {typeLabel(completing.type)} · {itemById.get(completing.item_id)?.name ?? 'Unknown item'}
          </div>
          <div>
            <label style={fieldLabel}>Date</label>
            <input type="date" value={completeDate} onChange={e => setCompleteDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Cost</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={completeCost}
              onChange={e => setCompleteCost(e.target.value)}
              style={inputStyle}
            />
          </div>
          {showCompleteMeter ? (
            <div>
              <label style={fieldLabel}>
                Meter reading{completingItem?.meter_unit ? ` (${completingItem.meter_unit})` : ''}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 87400"
                value={completeMeter}
                onChange={e => setCompleteMeter(e.target.value)}
                style={inputStyle}
              />
            </div>
          ) : null}
          <div>
            <label style={fieldLabel}>Notes</label>
            <textarea
              rows={3}
              placeholder="What was done?"
              value={completeNotes}
              onChange={e => setCompleteNotes(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          {completing.recurrence_months || completing.recurrence_meter ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Recurring
              {completing.recurrence_months ? ` every ${completing.recurrence_months}mo` : ''}
              {completing.recurrence_months && completing.recurrence_meter ? ' /' : ''}
              {completing.recurrence_meter
                ? ` every ${fmtMeter(completing.recurrence_meter, completingItem?.meter_unit)}`
                : ''}
              {' '}— the next one will be scheduled automatically.
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
            <button onClick={() => setCompleting(null)} style={secondaryBtn}>
              Cancel
            </button>
            <button onClick={handleComplete} disabled={completeBusy} style={{ ...primaryBtn, opacity: completeBusy ? 0.6 : 1 }}>
              {completeBusy ? 'Completing…' : 'Complete'}
            </button>
          </div>
        </Modal>
      )}

      {/* ---- Schedule modal ---- */}
      {showSchedule && (
        <Modal title="Schedule maintenance" onClose={() => setShowSchedule(false)}>
          <div>
            <label style={fieldLabel}>Item *</label>
            <select
              value={schedItemId}
              onChange={e => {
                const id = e.target.value;
                setSchedItemId(id);
                if (!itemById.get(id)?.meter_unit) setSchedByMeter(false);
              }}
              style={inputStyle}
            >
              <option value="">Select an item…</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Type</label>
            <select
              value={schedType}
              onChange={e => setSchedType(e.target.value as 'maintenance' | 'repair')}
              style={inputStyle}
            >
              <option value="maintenance">Maintenance</option>
              <option value="repair">Repair</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Due basis *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setSchedByDate(v => !v)} style={basisBtn(schedByDate)}>
                By date
              </button>
              <button
                type="button"
                disabled={!schedHasMeter}
                onClick={() => schedHasMeter && setSchedByMeter(v => !v)}
                style={basisBtn(schedByMeter, !schedHasMeter)}
              >
                By meter
              </button>
            </div>
            {schedItemId && !schedHasMeter ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                Add a meter to this item first (in its drawer)
              </div>
            ) : null}
            {schedByDate && schedByMeter ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                With both, whichever comes first triggers it.
              </div>
            ) : null}
          </div>
          {schedByDate && (
            <>
              <div>
                <label style={fieldLabel}>Due date *</label>
                <input type="date" value={schedNextDue} onChange={e => setSchedNextDue(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={fieldLabel}>Repeat every (months)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 12 for yearly"
                  value={schedRecurrence}
                  onChange={e => setSchedRecurrence(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          )}
          {schedByMeter && schedHasMeter && (
            <>
              <div>
                <label style={fieldLabel}>Due at ({schedItem?.meter_unit}) *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 90000"
                  value={schedDueMeter}
                  onChange={e => setSchedDueMeter(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>Repeat every ({schedItem?.meter_unit})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 15000"
                  value={schedRecurrenceMeter}
                  onChange={e => setSchedRecurrenceMeter(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          )}
          <div>
            <label style={fieldLabel}>Notes</label>
            <textarea
              rows={3}
              placeholder="ITV, boiler service, filter change…"
              value={schedNotes}
              onChange={e => setSchedNotes(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
            <button onClick={() => setShowSchedule(false)} style={secondaryBtn}>
              Cancel
            </button>
            <button onClick={handleSchedule} disabled={schedBusy} style={{ ...primaryBtn, opacity: schedBusy ? 0.6 : 1 }}>
              {schedBusy ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
