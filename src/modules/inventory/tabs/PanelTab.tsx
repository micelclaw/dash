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
import { AlertTriangle, Boxes, Check, CheckCircle2, Coins, HandHeart, Inbox, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from '@/modules/gateway/components/MetricCard';
import { useInventoryStore } from '@/stores/inventory.store';
import { daysSince, daysUntil, fmtMoney, thumbUrl } from '@/modules/inventory/types';
import type { InventoryProposal } from '@/modules/inventory/types';
import { PanelCharts } from '@/modules/inventory/components/PanelCharts';

// Estado por color → tokens del sistema (coherente con pills/botones del dash).
const GREEN = 'var(--success)';
const RED = 'var(--error)';

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

const WIDGET_LIMIT = 6;

// Pie "ver N más" para widgets acotados — navega a la tab correspondiente.
function MoreRow({ count, onClick }: { count: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        marginTop: 2,
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        border: 'none',
        color: 'var(--text-dim)',
        fontSize: '0.75rem',
        cursor: 'pointer',
        textAlign: 'left',
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        width: '100%',
      }}
    >
      +{count} more →
    </button>
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
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
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

// Caja shimmer reutilizable para el skeleton de carga.
function SkeletonBox({ height, radius = 'var(--radius-md)' }: { height: number; radius?: string }) {
  return (
    <div
      style={{
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 37%, var(--surface) 63%)',
        backgroundSize: '400% 100%',
        animation: 'inv-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

// Esqueleto del panel mientras cargan los primeros datos: 4 metric cards + 2
// bloques de gráfica + 2 widgets. Evita el flash de "panel vacío/roto".
function PanelSkeleton() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{'@keyframes inv-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} height={84} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <SkeletonBox height={220} />
        <SkeletonBox height={220} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <SkeletonBox height={160} />
        <SkeletonBox height={160} />
      </div>
    </div>
  );
}

// Onboarding cuando el inventario está realmente vacío (0 items, 0 propuestas).
function EmptyOnboarding({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      <div
        style={{
          background: 'var(--card)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          textAlign: 'center',
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'color-mix(in srgb, var(--mod-inventory) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Boxes size={24} style={{ color: 'var(--mod-inventory)' }} />
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Tu inventario está vacío</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', maxWidth: 420 }}>
          Añade tu primer artículo para empezar a llevar el control de tus cosas: valor, garantías, préstamos y mantenimiento.
        </div>
        <button style={{ ...primaryBtn, padding: '8px 16px', marginTop: 4 }} onClick={onAdd}>
          <Plus size={15} /> Añadir primer artículo
        </button>
      </div>
    </div>
  );
}

// Nota "todo en orden" cuando hay artículos pero nada pendiente ni alertas.
function AllClearNote() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-dim)',
        fontSize: '0.8125rem',
      }}
    >
      <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
      Todo en orden — sin propuestas ni alertas pendientes.
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
    locations,
    valuation,
    loading,
    fetchMoves,
    fetchValuation,
    selectItem,
    completeMaintenance,
  } = useInventoryStore();

  useEffect(() => {
    fetchMoves({ limit: 6 });
    fetchValuation({ group_by: 'category' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cálculo de respaldo en cliente (sobre los items cargados, tope 100). La
  // cifra autoritativa es valuation.total (servidor); este fallback solo cubre
  // el instante previo a que la valuación cargue.
  const localTotalValue = useMemo(
    () =>
      items.reduce((sum, item) => {
        const price = parseFloat(item.purchase_price ?? '');
        if (!Number.isFinite(price)) return sum;
        const qty = parseFloat(item.quantity);
        return sum + price * (Number.isFinite(qty) ? qty : 1);
      }, 0),
    [items],
  );
  const totalValue = valuation?.total ?? localTotalValue;

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

  // Descripción no-cromática del estado del préstamo (a11y: el color no es el
  // único canal de información).
  const loanDotLabel = (lentAt: string | null, lentUntil: string | null): string => {
    const until = daysUntil(lentUntil);
    if (until !== null && until < 0) return `Overdue by ${Math.abs(until)}d`;
    const days = daysSince(lentAt) ?? 0;
    if (days > 90) return `Out for ${days}d (review)`;
    if (days >= 30) return `Out for ${days}d`;
    return `Recently lent (${days}d)`;
  };

  const hasValue = (valuation?.total ?? 0) > 0;
  const hasWidgets = expiring.length > 0 || activeLoans.length > 0 || maintenance.length > 0 || recentMoves.length > 0;

  // Skeleton durante la primera carga (antes de que resuelvan los fetches).
  if (loading && !alerts) {
    return <PanelSkeleton />;
  }

  // Onboarding real: inventario vacío sin nada que revisar.
  if (!loading && items.length === 0 && proposals.length === 0) {
    return <EmptyOnboarding onAdd={() => onNavigate('catalog')} />;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <MetricCard
          icon={Boxes}
          label="Items"
          value={itemsTotal}
          subtitle={itemsTotal !== items.length ? `${items.length} shown` : undefined}
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

      {/* Gráficas: valor por categoría (donut) + por ubicación (barras) */}
      {hasValue && <PanelCharts categoryValuation={valuation} locations={locations} />}

      {/* Review queue — elevado: es lo más accionable del panel */}
      {proposals.length > 0 && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--mod-inventory)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
            <Inbox size={15} style={{ color: 'var(--mod-inventory)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Review queue
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--mod-inventory)',
                background: 'color-mix(in srgb, var(--mod-inventory) 14%, transparent)',
                borderRadius: 999,
                padding: '1px 8px',
              }}
            >
              {proposals.length} from your agent
            </span>
          </div>
          {proposals.map(proposal => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {/* Widgets */}
      {hasWidgets && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {expiring.length > 0 && (
            <WidgetCard
              title="Expiring < 90 days"
              action={
                <button style={{ ...secondaryBtn, padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => onNavigate('catalog')}>
                  View all
                </button>
              }
            >
              {expiring.slice(0, WIDGET_LIMIT).map(item => {
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
              {expiring.length > WIDGET_LIMIT && (
                <MoreRow count={expiring.length - WIDGET_LIMIT} onClick={() => onNavigate('catalog')} />
              )}
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
              {activeLoans.slice(0, WIDGET_LIMIT).map(item => (
                <HoverRow key={item.id} onClick={() => selectItem(item.id)}>
                  <span
                    role="img"
                    aria-label={loanDotLabel(item.lent_at, item.lent_until)}
                    title={loanDotLabel(item.lent_at, item.lent_until)}
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
              {activeLoans.length > WIDGET_LIMIT && (
                <MoreRow count={activeLoans.length - WIDGET_LIMIT} onClick={() => onNavigate('lending')} />
              )}
            </WidgetCard>
          )}

          {maintenance.length > 0 && (
            <WidgetCard
              title="Upcoming maintenance"
              action={
                <button style={{ ...secondaryBtn, padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => onNavigate('maintenance')}>
                  View all
                </button>
              }
            >
              {maintenance.slice(0, WIDGET_LIMIT).map(event => (
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
              {maintenance.length > WIDGET_LIMIT && (
                <MoreRow count={maintenance.length - WIDGET_LIMIT} onClick={() => onNavigate('maintenance')} />
              )}
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

      {/* Nada pendiente pero el inventario tiene artículos: confirma el estado */}
      {!hasWidgets && proposals.length === 0 && items.length > 0 && <AllClearNote />}
    </div>
  );
}
