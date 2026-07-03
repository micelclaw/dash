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

import {
  daysUntil,
  fmtMeter,
  fmtMoney,
  type InventoryEvent,
  type InventoryItem,
} from '@/modules/inventory/types';
import { fmtDate, sectionLabel } from './drawer-ui';

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

interface TimelineSectionProps {
  item: InventoryItem;
  /** Eventos YA filtrados para este item. */
  events: InventoryEvent[];
}

export function TimelineSection({ item, events }: TimelineSectionProps) {
  const warrantyDays = daysUntil(item.warranty_until);

  // Merge real events with synthetic purchase/warranty entries, sorted desc.
  const timeline: TimelineEntry[] = events.map<TimelineEntry>(ev => ({
    kind: 'event',
    id: ev.id,
    date: ev.date,
    ev,
  }));
  // Items created via purchase_in already get an 'acquired' event — don't duplicate.
  if (item.purchase_date && !events.some(e => e.type === 'acquired')) {
    timeline.push({ kind: 'purchased', id: '__synthetic_purchased', date: item.purchase_date });
  }
  if (item.warranty_until) {
    timeline.push({ kind: 'warranty', id: '__synthetic_warranty', date: item.warranty_until });
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
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
  );
}
