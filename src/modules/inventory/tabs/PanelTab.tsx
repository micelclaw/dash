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
import { daysSince, daysUntil, fmtMoney } from '@/modules/inventory/types';
import type { InventoryProposal } from '@/modules/inventory/types';
import { PanelCharts } from '@/modules/inventory/components/PanelCharts';
import { useI18n } from '@/i18n';

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

function fmtDate(date: string | null | undefined, locale = 'en'): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShortDate(date: string, locale = 'en'): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short' });
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
  const { t } = useI18n();
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
      +{count} {t('inventory.panel.more')} →
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
  const { t, locale } = useI18n();
  const { locations, approveProposal, rejectProposal } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<ProposalEditForm>({ name: '', category: '', purchase_price: '', location_id: '' });

  const p = proposal.payload;
  // Documento de origen (el ticket/albarán/foto del que se extrajo la propuesta): las de OCR
  // lo guardan en file_ids; las de cámara en photo_file_ids. Fallback a source_ref (= file_id).
  const sourceFileId = p.photo_file_ids?.[0] ?? p.file_ids?.[0] ?? proposal.source_ref ?? undefined;

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
      toast.success(t('inventory.panel.addedToInventory', { name: payload && typeof payload.name === 'string' ? payload.name : p.name }));
      setEditing(false);
    } catch {
      toast.error(t('inventory.panel.approveFailed'));
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
      toast.success(t('inventory.panel.rejected'));
    } catch {
      toast.error(t('inventory.panel.rejectFailed'));
    } finally {
      setBusy(false);
    }
  };

  const metaParts: string[] = [];
  if (p.purchase_price !== undefined) metaParts.push(fmtMoney(p.purchase_price, p.currency ?? 'EUR'));
  if (p.purchase_date) metaParts.push(fmtDate(p.purchase_date, locale));
  if (p.warranty_until) metaParts.push(t('inventory.panel.warrantyUntil', { date: fmtDate(p.warranty_until, locale) }));

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
          <button style={primaryBtn} disabled={busy} onClick={() => approve()} title={t('inventory.panel.approve')}>
            <Check size={13} /> {t('inventory.panel.approve')}
          </button>
          <button
            style={{ ...secondaryBtn, padding: 6 }}
            disabled={busy}
            onClick={() => (editing ? setEditing(false) : openEdit())}
            title={t('inventory.panel.editBeforeApprove')}
          >
            <Pencil size={13} />
          </button>
          <button style={{ ...secondaryBtn, padding: 6 }} disabled={busy} onClick={reject} title={t('inventory.panel.reject')}>
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
            <label style={fieldLabel}>{t('inventory.panel.name')}</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div>
              <label style={fieldLabel}>{t('inventory.panel.category')}</label>
              <input style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label style={fieldLabel}>{t('inventory.panel.purchasePrice')}</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                value={form.purchase_price}
                onChange={e => setForm({ ...form, purchase_price: e.target.value })}
              />
            </div>
            <div>
              <label style={fieldLabel}>{t('inventory.panel.location')}</label>
              <select style={inputStyle} value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })}>
                <option value="">{t('inventory.panel.noLocation')}</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sourceFileId && (
            <button
              type="button"
              onClick={() => setViewing(true)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--mod-inventory)', fontSize: '0.8125rem', textDecoration: 'underline' }}
            >
              {t('inventory.panel.viewSourceReceipt')}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={secondaryBtn} disabled={busy} onClick={() => setEditing(false)}>
              {t('inventory.panel.cancel')}
            </button>
            <button style={primaryBtn} disabled={busy} onClick={approveEdited}>
              <Check size={13} /> {t('inventory.panel.approveChanges')}
            </button>
          </div>
        </div>
      )}

      {viewing && sourceFileId && (
        <div
          onClick={() => setViewing(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 2000, padding: 24 }}
        >
          <img
            src={`/api/v1/files/${sourceFileId}/download`}
            alt={t('inventory.panel.sourceDocument')}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 48px rgba(0,0,0,0.6)', background: 'var(--surface)' }}
          />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <a href={`/api/v1/files/${sourceFileId}/download`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--primary, var(--amber))' }}>
              Abrir original ↗
            </a>
            <button style={secondaryBtn} onClick={() => setViewing(false)}>{t('inventory.panel.close')}</button>
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
  const { t } = useI18n();
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
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{t('inventory.panel.emptyTitle')}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', maxWidth: 420 }}>
          {t('inventory.panel.emptyDescription')}
        </div>
        <button style={{ ...primaryBtn, padding: '8px 16px', marginTop: 4 }} onClick={onAdd}>
          <Plus size={15} /> {t('inventory.panel.addFirstItem')}
        </button>
      </div>
    </div>
  );
}

// Nota "todo en orden" cuando hay artículos pero nada pendiente ni alertas.
function AllClearNote() {
  const { t } = useI18n();
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
      {t('inventory.panel.allClear')}
    </div>
  );
}

export function PanelTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { t, locale } = useI18n();
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
      toast.success(t('inventory.panel.maintenanceCompleted'));
    } catch {
      toast.error(t('inventory.panel.maintenanceCompleteFailed'));
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
    if (until !== null && until < 0) return t('inventory.panel.overdueByDays', { count: Math.abs(until) });
    const days = daysSince(lentAt) ?? 0;
    if (days > 90) return t('inventory.panel.outForReview', { count: days });
    if (days >= 30) return t('inventory.panel.outForDays', { count: days });
    return t('inventory.panel.recentlyLent', { count: days });
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
          label={t('inventory.panel.items')}
          value={itemsTotal}
          subtitle={itemsTotal !== items.length ? t('inventory.panel.shown', { count: items.length }) : undefined}
          accentColor="var(--mod-inventory)"
        />
        <MetricCard
          icon={Coins}
          label={t('inventory.panel.totalValue')}
          value={fmtMoney(totalValue)}
          accentColor="var(--mod-inventory)"
        />
        <MetricCard
          icon={HandHeart}
            label={t('inventory.panel.onLoan')}
          value={activeLoans.length}
            subtitle={overdueLoans > 0 ? t('inventory.panel.overdue', { count: overdueLoans }) : undefined}
          accentColor="var(--mod-inventory)"
        />
        {lowStockCount > 0 && (
          <MetricCard
            icon={AlertTriangle}
            label={t('inventory.panel.lowStock')}
            value={lowStockCount}
            subtitle={t('inventory.panel.belowMinimum')}
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
            // Longhand por lado: no mezclar `border` shorthand + `borderLeft`
            // (React avisa al re-renderizar). Mismo patrón que el fix de #1167.
            borderTop: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            borderLeft: '3px solid var(--mod-inventory)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
            <Inbox size={15} style={{ color: 'var(--mod-inventory)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              {t('inventory.panel.reviewQueue')}
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
              {t('inventory.panel.fromAgent', { count: proposals.length })}
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
              title={t('inventory.panel.expiring')}
              action={
                <button style={{ ...secondaryBtn, padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => onNavigate('catalog')}>
                  {t('inventory.panel.viewAll')}
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
                      {t('inventory.panel.expires', { date: fmtDate(item.warranty_until, locale) })}
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
              title={t('inventory.panel.activeLoans')}
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
              title={t('inventory.panel.upcomingMaintenance')}
              action={
                <button style={{ ...secondaryBtn, padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => onNavigate('maintenance')}>
                  {t('inventory.panel.viewAll')}
                </button>
              }
            >
              {maintenance.slice(0, WIDGET_LIMIT).map(event => (
                <HoverRow key={event.id} onClick={() => selectItem(event.item_id)}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                    {event.type}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                    {fmtDate(event.next_due, locale)}
                  </span>
                  <button
                    style={{ ...secondaryBtn, padding: '2px 8px', fontSize: '0.75rem', flexShrink: 0 }}
                    onClick={e => {
                      e.stopPropagation();
                      handleCompleteMaintenance(event.id);
                    }}
                  >
                    {t('inventory.panel.complete')}
                  </button>
                </HoverRow>
              ))}
              {maintenance.length > WIDGET_LIMIT && (
                <MoreRow count={maintenance.length - WIDGET_LIMIT} onClick={() => onNavigate('maintenance')} />
              )}
            </WidgetCard>
          )}

          {recentMoves.length > 0 && (
            <WidgetCard title={t('inventory.panel.recentMoves')}>
              {recentMoves.map(move => {
                const delta = parseFloat(move.qty_delta);
                const deltaColor = delta > 0 ? GREEN : delta < 0 ? RED : 'var(--text-dim)';
                const moveItem = itemsById.get(move.item_id);
                return (
                  <HoverRow
                    key={move.id}
                    onClick={() => selectItem(move.item_id)}
                    title={moveItem ? undefined : t('inventory.panel.deletedItem')}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', width: 52, flexShrink: 0 }}>
                      {fmtShortDate(move.occurred_at, locale)}
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
                      {moveItem ? moveItem.name : t('inventory.panel.deletedItemLabel')}
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
                        {t('inventory.panel.agent')}
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
