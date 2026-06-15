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
import { AlertTriangle, Boxes, Check, Coins, HandHeart, Inbox, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from '@/modules/gateway/components/MetricCard';
import { useInventoryStore } from '@/stores/inventory.store';
import { daysSince, daysUntil, fmtMoney, thumbUrl } from '@/modules/inventory/types';
import type { InventoryProposal } from '@/modules/inventory/types';

const GREEN = '#34d399';
const RED = '#f87171';

const primaryBtn: CSSProperties = {
  background: 'var(--amber)',
  color: '#06060a',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
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

const inputStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 8px',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  outline: 'none',
  width: '100%',
};

const fieldLabel: CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-dim)',
  marginBottom: 4,
  display: 'block',
};

function fmtDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShortDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Thumb({ fileId, size = 36 }: { fileId: string | null | undefined; size?: number }) {
  if (fileId) {
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

function SourceChip({ source }: { source: InventoryProposal['source'] }) {
  return (
    <span
      style={{
        fontSize: '0.625rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        padding: '1px 6px',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      {source}
    </span>
  );
}

function WidgetCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
          {title}
        </div>
        {action}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function HoverRow({ onClick, title, children }: { onClick?: () => void; title?: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        fontSize: '0.8125rem',
        color: 'var(--text)',
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

interface ProposalEditForm {
  name: string;
  category: string;
  purchase_price: string;
  location_id: string;
}

function ProposalRow({ proposal }: { proposal: InventoryProposal }) {
  const { locations, approveProposal, rejectProposal } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ProposalEditForm>({ name: '', category: '', purchase_price: '', location_id: '' });

  const p = proposal.payload;

  const openEdit = () => {
    setForm({
      name: p.name ?? '',
      category: p.category ?? '',
      purchase_price: p.purchase_price !== undefined ? String(p.purchase_price) : '',
      location_id: p.location_id ?? '',
    });
    setEditing(true);
  };

  const approve = async (payload?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await approveProposal(proposal.id, payload);
      toast.success(`"${payload && typeof payload.name === 'string' ? payload.name : p.name}" added to inventory`);
      setEditing(false);
    } catch {
      toast.error('Could not approve proposal');
    } finally {
      setBusy(false);
    }
  };

  const approveEdited = async () => {
    const price = parseFloat(form.purchase_price);
    const payload: Record<string, unknown> = {
      ...p,
      name: form.name.trim() || p.name,
      category: form.category.trim() || undefined,
      purchase_price: Number.isFinite(price) ? price : undefined,
      location_id: form.location_id || undefined,
    };
    await approve(payload);
  };

  const reject = async () => {
    setBusy(true);
    try {
      await rejectProposal(proposal.id);
      toast.success('Proposal rejected');
    } catch {
      toast.error('Could not reject proposal');
    } finally {
      setBusy(false);
    }
  };

  const metaParts: string[] = [];
  if (p.purchase_price !== undefined) metaParts.push(fmtMoney(p.purchase_price, p.currency ?? 'EUR'));
  if (p.purchase_date) metaParts.push(fmtDate(p.purchase_date));
  if (p.warranty_until) metaParts.push(`warranty until ${fmtDate(p.warranty_until)}`);

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Thumb fileId={p.photo_file_ids?.[0]} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {metaParts.length > 0 && <span>{metaParts.join(' · ')}</span>}
            <SourceChip source={proposal.source} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button style={primaryBtn} disabled={busy} onClick={() => approve()} title="Approve proposal">
            <Check size={13} /> Approve
          </button>
          <button
            style={{ ...secondaryBtn, padding: 6 }}
            disabled={busy}
            onClick={() => (editing ? setEditing(false) : openEdit())}
            title="Edit before approving"
          >
            <Pencil size={13} />
          </button>
          <button style={{ ...secondaryBtn, padding: 6 }} disabled={busy} onClick={reject} title="Reject proposal">
            <X size={13} />
          </button>
        </div>
      </div>

      {editing && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div>
            <label style={fieldLabel}>Name</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div>
              <label style={fieldLabel}>Category</label>
              <input style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label style={fieldLabel}>Purchase price</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                value={form.purchase_price}
                onChange={e => setForm({ ...form, purchase_price: e.target.value })}
              />
            </div>
            <div>
              <label style={fieldLabel}>Location</label>
              <select style={inputStyle} value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })}>
                <option value="">No location</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button style={primaryBtn} disabled={busy} onClick={approveEdited}>
              <Check size={13} /> Approve with changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PanelTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    items,
    itemsTotal,
    alerts,
    proposals,
    moves,
    fetchMoves,
    selectItem,
    completeMaintenance,
  } = useInventoryStore();

  useEffect(() => {
    fetchMoves({ limit: 6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalValue = useMemo(
    () =>
      items.reduce((sum, item) => {
        const price = parseFloat(item.purchase_price ?? '');
        if (!Number.isFinite(price)) return sum;
        const qty = parseFloat(item.quantity);
        return sum + price * (Number.isFinite(qty) ? qty : 1);
      }, 0),
    [items],
  );

  const activeLoans = alerts?.active_loans ?? [];
  const expiring = alerts?.warranties_expiring ?? [];
  const maintenance = alerts?.upcoming_maintenance ?? [];
  const lowStockCount = alerts?.low_stock.length ?? 0;

  const overdueLoans = useMemo(
    () =>
      activeLoans.filter(item => {
        const d = daysUntil(item.lent_until);
        return d !== null && d < 0;
      }).length,
    [activeLoans],
  );

  const recentMoves = moves.slice(0, 6);

  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

  const handleCompleteMaintenance = async (eventId: string) => {
    try {
      await completeMaintenance(eventId);
      toast.success('Maintenance marked as completed');
    } catch {
      toast.error('Could not complete maintenance');
    }
  };

  const loanDotColor = (lentAt: string | null, lentUntil: string | null): string => {
    const until = daysUntil(lentUntil);
    if (until !== null && until < 0) return RED;
    const days = daysSince(lentAt) ?? 0;
    if (days > 90) return RED;
    if (days >= 30) return 'var(--amber)';
    return GREEN;
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <MetricCard
          icon={Boxes}
          label="Items"
          value={items.length}
          subtitle={`${itemsTotal} total`}
          accentColor="var(--mod-inventory)"
        />
        <MetricCard
          icon={Coins}
          label="Total value"
          value={fmtMoney(totalValue)}
          accentColor="var(--mod-inventory)"
        />
        <MetricCard
          icon={HandHeart}
          label="On loan"
          value={activeLoans.length}
          subtitle={overdueLoans > 0 ? `${overdueLoans} overdue` : undefined}
          accentColor="var(--mod-inventory)"
        />
        {lowStockCount > 0 && (
          <MetricCard
            icon={AlertTriangle}
            label="Low stock"
            value={lowStockCount}
            subtitle="below min qty"
            accentColor="var(--amber)"
          />
        )}
      </div>

      {/* Review queue */}
      {proposals.length > 0 && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
            <Inbox size={15} style={{ color: 'var(--mod-inventory)' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
              Review queue · {proposals.length} proposal{proposals.length === 1 ? '' : 's'} from your agent
            </span>
          </div>
          {proposals.map(proposal => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {/* Widgets */}
      {(expiring.length > 0 || activeLoans.length > 0 || maintenance.length > 0 || recentMoves.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))', gap: 12 }}>
          {expiring.length > 0 && (
            <WidgetCard title="Expiring < 90 days">
              {expiring.map(item => {
                const d = daysUntil(item.warranty_until);
                return (
                  <HoverRow key={item.id} onClick={() => selectItem(item.id)}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                      expires {fmtDate(item.warranty_until)}
                    </span>
                    {d !== null && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--amber)',
                          border: '1px solid var(--border)',
                          borderRadius: 999,
                          padding: '1px 6px',
                          background: 'var(--surface)',
                          flexShrink: 0,
                        }}
                      >
                        {d}d
                      </span>
                    )}
                  </HoverRow>
                );
              })}
            </WidgetCard>
          )}

          {activeLoans.length > 0 && (
            <WidgetCard
              title="Active loans"
              action={
                <button style={{ ...secondaryBtn, padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => onNavigate('lending')}>
                  View all
                </button>
              }
            >
              {activeLoans.map(item => (
                <HoverRow key={item.id} onClick={() => selectItem(item.id)}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: loanDotColor(item.lent_at, item.lent_until),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                    {daysSince(item.lent_at) ?? 0}d
                  </span>
                </HoverRow>
              ))}
            </WidgetCard>
          )}

          {maintenance.length > 0 && (
            <WidgetCard title="Upcoming maintenance">
              {maintenance.map(event => (
                <HoverRow key={event.id} onClick={() => selectItem(event.item_id)}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                    {event.type}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                    {fmtDate(event.next_due)}
                  </span>
                  <button
                    style={{ ...secondaryBtn, padding: '2px 8px', fontSize: '0.75rem', flexShrink: 0 }}
                    onClick={e => {
                      e.stopPropagation();
                      handleCompleteMaintenance(event.id);
                    }}
                  >
                    Complete
                  </button>
                </HoverRow>
              ))}
            </WidgetCard>
          )}

          {recentMoves.length > 0 && (
            <WidgetCard title="Recent moves">
              {recentMoves.map(move => {
                const delta = parseFloat(move.qty_delta);
                const deltaColor = delta > 0 ? GREEN : delta < 0 ? RED : 'var(--text-dim)';
                const moveItem = itemsById.get(move.item_id);
                return (
                  <HoverRow
                    key={move.id}
                    onClick={() => selectItem(move.item_id)}
                    title={moveItem ? undefined : 'Deleted item'}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', width: 52, flexShrink: 0 }}>
                      {fmtShortDate(move.occurred_at)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.625rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                        borderRadius: 999,
                        padding: '1px 6px',
                        background: 'var(--surface)',
                        flexShrink: 0,
                      }}
                    >
                      {move.type}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: moveItem ? 'var(--text)' : 'var(--text-dim)',
                      }}
                    >
                      {moveItem ? moveItem.name : '(deleted item)'}
                    </span>
                    {move.created_by === 'agent' && (
                      <span
                        style={{
                          fontSize: '0.625rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'var(--mod-inventory)',
                          border: '1px solid var(--border)',
                          borderRadius: 999,
                          padding: '1px 6px',
                          background: 'var(--surface)',
                          flexShrink: 0,
                        }}
                      >
                        agent
                      </span>
                    )}
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: deltaColor, flexShrink: 0 }}>
                      {Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${delta}` : move.qty_delta}
                    </span>
                  </HoverRow>
                );
              })}
            </WidgetCard>
          )}
        </div>
      )}
    </div>
  );
}
