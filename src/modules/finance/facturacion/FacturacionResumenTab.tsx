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

// F2b — Resumen de Facturación (dashboard): 4 KPIs (Facturado / Cobrado /
// Pendiente / Vencido, derivados de `documents`) + caja "Por cobrar" (facturas
// sent/partial/overdue con su pendiente) + "Facturas recientes" con badge de
// estado por color. Sin jerga contable. Molde visual = ResumenTab.tsx de F1.

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useFinanceBillingStore, type FinanceDoc, type DocStatus, type InvoicingSummary, type InvoicingTopClient, type InvoicingSeriesPoint, type ApAging, type VatReport } from '@/stores/finance-billing.store';
import { STATUS_META, tintedPillStyle } from './statusMeta';
import { useFacturacionNav } from './navigation';
import { PeriodSelector, CustomRangeInputs, usePeriodRange } from '../period';

// ─── Helpers locales (self-contained, sin tocar la fundación) ─────────────

function fmtMoney(value: string | number | null | undefined, currency = 'EUR'): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: DocStatus }) {
  const m = STATUS_META[status];
  return <span style={tintedPillStyle(m.color)}>{m.label}</span>;
}

// KPI con acento semántico: barra superior tintada + cifra en el color del
// acento. `muted` apaga el acento cuando el valor es 0 (p.ej. nada vencido).
function Kpi({ label, value, hint, accent, muted, emoji }: { label: string; value: string; hint?: string; accent?: string; muted?: boolean; emoji?: string }) {
  const c = !accent || muted ? 'var(--text)' : accent;
  const barColor = !accent || muted ? 'var(--border)' : accent;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 150,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${barColor}`,
        borderRadius: 'var(--radius-md, 6px)',
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
        {emoji && <span style={{ fontSize: 13 }}>{emoji}</span>}{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: c, fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ─── Gráficas del Resumen (recharts) ───────────────────────────────────

// Tarjeta contenedora de gráfica (molde = ChartCard de la lente Personal).
function ChartCard({ title, subtitle, children, flex }: { title: string; subtitle?: string; children: React.ReactNode; flex: string }) {
  return (
    <div style={{ flex, minWidth: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ height = 200, label = 'Sin datos todavía.' }: { height?: number; label?: string }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
      {label}
    </div>
  );
}

// 'YYYY-MM' → 'jun' (mes corto, minúscula) para el eje X.
function shortMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d).replace('.', '');
}

// Etiqueta larga 'jun 2026' para tooltips.
function longMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(d).replace('.', '');
}

// € en el eje Y abreviado (sin decimales, pega el símbolo).
function moneyAxis(v: number): string {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v).replace(/\s/g, '');
  } catch {
    return `${Math.round(v)}€`;
  }
}

const INVOICED_COLOR = 'var(--amber)';        // facturado (amarillo)
const COLLECTED_COLOR = 'var(--mod-finance)'; // cobrado (verde)
const PENDING_COLOR = 'var(--info)';          // pendiente (azul)
const BILLED_COLOR = 'var(--error)';          // gastos / facturas recibidas (rojo)

// Día corto 'YYYY-MM-DD' → '12 jun' (bucketing diario del rango corto).
function shortDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(d);
}
// Etiqueta del bucket (mensual 'YYYY-MM' o diario 'YYYY-MM-DD') según su longitud.
const bucketTick = (b: string) => (b.length === 7 ? shortMonth(b) : shortDay(b));
const bucketLong = (b: string) => (b.length === 7 ? longMonth(b) : shortDay(b));

// Tooltip de la gráfica unificada: líneas acumuladas + barras del periodo.
function InvoicingTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => Number(payload.find((p) => p.dataKey === k)?.value ?? 0);
  const row = (color: string, name: string, value: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', marginTop: 2 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />
      {name}
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(value)}</span>
    </div>
  );
  const inv = get('invoiced'), col = get('collected'), bil = get('billed');
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface, #1a1a24)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', fontSize: 12, minWidth: 180 }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{label ? bucketLong(String(label)) : ''}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>Acumulado</div>
      {row(INVOICED_COLOR, 'Facturado', get('cumInvoiced'))}
      {row(COLLECTED_COLOR, 'Cobrado', get('cumCollected'))}
      {row(PENDING_COLOR, 'Pendiente', get('cumPending'))}
      {(inv > 0 || col > 0 || bil > 0) && (
        <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 }}>En el periodo</div>
      )}
      {inv > 0 && row(INVOICED_COLOR, 'Facturado', inv)}
      {col > 0 && row(COLLECTED_COLOR, 'Cobrado', col)}
      {bil > 0 && row(BILLED_COLOR, 'Gastos', bil)}
    </div>
  );
}

// (a) Facturación por periodo — líneas acumuladas (facturado/cobrado/pendiente,
// eje izq) + barras del periodo (facturado/cobrado/gastos, eje der con su escala).
function InvoicingChart({ series }: { series: InvoicingSeriesPoint[] }) {
  const data = useMemo(() => {
    let ci = 0, cc = 0;
    return series.map((p) => {
      const invoiced = Number(p.invoiced), collected = Number(p.collected), billed = Number(p.billed);
      ci += invoiced; cc += collected;
      return { bucket: p.bucket, invoiced, collected, billed, cumInvoiced: ci, cumCollected: cc, cumPending: Math.max(0, ci - cc) };
    });
  }, [series]);
  const hasData = data.some((d) => d.invoiced > 0 || d.collected > 0 || d.billed > 0);
  if (!hasData) return <EmptyChart label="Aún no hay facturas emitidas." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={1} barCategoryGap="22%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={bucketTick} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} minTickGap={20} />
        {/* Eje izquierdo: líneas acumuladas */}
        <YAxis yAxisId="left" tickFormatter={moneyAxis} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={56} />
        {/* Eje derecho: barras del periodo (escala propia) */}
        <YAxis yAxisId="right" orientation="right" tickFormatter={moneyAxis} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={50} />
        <Tooltip content={<InvoicingTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
        <Bar yAxisId="right" dataKey="invoiced" name="Facturado" fill={INVOICED_COLOR} radius={[2, 2, 0, 0]} maxBarSize={16} />
        <Bar yAxisId="right" dataKey="collected" name="Cobrado" fill={COLLECTED_COLOR} radius={[2, 2, 0, 0]} maxBarSize={16} />
        <Bar yAxisId="right" dataKey="billed" name="Gastos" fill={BILLED_COLOR} radius={[2, 2, 0, 0]} maxBarSize={16} />
        <Line yAxisId="left" type="monotone" dataKey="cumInvoiced" name="Facturado" stroke={INVOICED_COLOR} strokeWidth={2} dot={false} />
        <Line yAxisId="left" type="monotone" dataKey="cumCollected" name="Cobrado" stroke={COLLECTED_COLOR} strokeWidth={2} dot={false} />
        <Line yAxisId="left" type="monotone" dataKey="cumPending" name="Pendiente" stroke={PENDING_COLOR} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// (b) Antigüedad de cobros (aging) — 4 tramos como barra apilada + leyenda.
interface AgingBucket { key: string; label: string; value: number; color: string }

function agingBuckets(summary: InvoicingSummary): AgingBucket[] {
  const a = summary.aging;
  return [
    { key: 'current', label: 'Al día', value: Number(a.current), color: 'var(--success)' },
    { key: 'd1_30', label: '≤30 días', value: Number(a.d1_30), color: 'var(--amber)' },
    { key: 'd31_60', label: '31-60 días', value: Number(a.d31_60), color: 'var(--warning)' },
    { key: 'd60_plus', label: '+60 días', value: Number(a.d60_plus), color: 'var(--error)' },
  ];
}

function AgingChart({ summary }: { summary: InvoicingSummary }) {
  const buckets = useMemo(() => agingBuckets(summary), [summary]);
  const total = buckets.reduce((s, b) => s + b.value, 0);
  if (total <= 0) return <EmptyChart height={160} label="Nada pendiente de cobro." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barra apilada horizontal con los 4 tramos */}
      <div style={{ display: 'flex', height: 18, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-hover)' }}>
        {buckets.filter((b) => b.value > 0).map((b) => (
          <div
            key={b.key}
            title={`${b.label}: ${fmtMoney(b.value)}`}
            style={{ width: `${(b.value / total) * 100}%`, background: b.color, minWidth: 2 }}
          />
        ))}
      </div>
      {/* Celdas tintadas por tramo: importe + % */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        {buckets.map((b) => {
          const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
          return (
            <div
              key={b.key}
              style={{
                background: `color-mix(in srgb, ${b.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${b.color} 32%, transparent)`,
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, display: 'inline-block', flexShrink: 0 }} />
                {b.label}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{pct}%</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: b.color, fontFamily: 'var(--font-mono, monospace)', marginTop: 3 }}>{fmtMoney(b.value)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, paddingTop: 2, borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-dim)' }}>Total pendiente</span>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)', fontWeight: 600 }}>{fmtMoney(total)}</span>
      </div>
    </div>
  );
}

// (b-bis) Antigüedad de PAGOS (aging AP, espejo de cobros) — saldo pendiente de
// pagar a proveedores en 4 tramos. Colores de compra: al día = ámbar/aviso,
// tramos cada vez más rojos. Mismo molde visual que AgingChart de cobros.
function apAgingBuckets(aging: ApAging): AgingBucket[] {
  return [
    { key: 'current', label: 'Al día', value: Number(aging.current), color: 'var(--warning)' },
    { key: 'd1_30', label: '≤30 días', value: Number(aging.d1_30), color: 'var(--amber)' },
    { key: 'd31_60', label: '31-60 días', value: Number(aging.d31_60), color: 'var(--warning)' },
    { key: 'd60_plus', label: '+60 días', value: Number(aging.d60_plus), color: 'var(--error)' },
  ];
}

function ApAgingChart({ aging }: { aging: ApAging }) {
  const buckets = useMemo(() => apAgingBuckets(aging), [aging]);
  const total = buckets.reduce((s, b) => s + b.value, 0);
  if (total <= 0) return <EmptyChart height={160} label="Nada pendiente de pago." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barra apilada horizontal con los 4 tramos */}
      <div style={{ display: 'flex', height: 18, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-hover)' }}>
        {buckets.filter((b) => b.value > 0).map((b) => (
          <div
            key={b.key}
            title={`${b.label}: ${fmtMoney(b.value)}`}
            style={{ width: `${(b.value / total) * 100}%`, background: b.color, minWidth: 2 }}
          />
        ))}
      </div>
      {/* Celdas tintadas por tramo: importe + % */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        {buckets.map((b) => {
          const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
          return (
            <div
              key={b.key}
              style={{
                background: `color-mix(in srgb, ${b.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${b.color} 32%, transparent)`,
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, display: 'inline-block', flexShrink: 0 }} />
                {b.label}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{pct}%</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: b.color, fontFamily: 'var(--font-mono, monospace)', marginTop: 3 }}>{fmtMoney(b.value)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, paddingTop: 2, borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-dim)' }}>Total por pagar</span>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)', fontWeight: 600 }}>{fmtMoney(total)}</span>
      </div>
    </div>
  );
}

// (c) Top clientes — barras horizontales (facturado) + pendiente, clicable.
function TopClientsChart({ rows, onOpen }: { rows: InvoicingTopClient[]; onOpen: (contactId: string) => void }) {
  const data = useMemo(() => rows.map((r) => ({ ...r, invoicedNum: Number(r.invoiced), outstandingNum: Number(r.outstanding) })), [rows]);
  if (data.length === 0) return <EmptyChart height={160} label="Sin clientes facturados todavía." />;
  const max = Math.max(...data.map((d) => d.invoicedNum), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d) => {
        const rowProps: React.HTMLAttributes<HTMLDivElement> = {
          role: 'button',
          tabIndex: 0,
          onClick: () => onOpen(d.contact_id),
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(d.contact_id); } },
          onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; },
          onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
        };
        return (
          <div key={d.contact_id} {...rowProps} style={{ padding: '6px 6px', borderRadius: 4, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{d.name}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexShrink: 0 }}>
                {d.outstandingNum > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtMoney(d.outstandingNum)} pte.</span>
                )}
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>{fmtMoney(d.invoicedNum)}</span>
              </span>
            </div>
            {/* Barra de proporción de facturado vs el top */}
            <div style={{ position: 'relative', height: 6, marginTop: 5, borderRadius: 999, background: 'var(--surface-hover)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(d.invoicedNum / max) * 100}%`, background: 'var(--mod-finance)', borderRadius: 999 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente ────────────────────────────────────────────────────────

export function FacturacionResumenTab() {
  const { documents, fetchDocuments, fetchInvoicingSummary, fetchInvoicingSeries, fetchApAging, fetchVatReport } = useFinanceBillingStore();

  // Los KPIs (ventas Y compras) derivan de store.documents, que las pestañas
  // filtradas (Facturas→invoice, Recibidas→bill) SOBREESCRIBEN al montar. El
  // Resumen recarga SIN filtro al montar para ver siempre el set completo.
  useEffect(() => { void fetchDocuments(); }, [fetchDocuments]);
  const { openInvoice, openContact } = useFacturacionNav();

  // Selector de periodo (conduce la gráfica de facturación; compartido con Personal).
  const { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, range, title } = usePeriodRange('12m');

  // Resumen de gráficas (carga al montar; estado local con guard alive).
  const [invoicing, setInvoicing] = useState<InvoicingSummary | null>(null);
  const [invoicingError, setInvoicingError] = useState(false);
  // Serie por periodo para la gráfica unificada (facturado/cobrado/pendiente + gastos).
  const [series, setSeries] = useState<InvoicingSeriesPoint[]>([]);
  // Lado COMPRAS: antigüedad de pagos a proveedores (AP) + liquidación de IVA (303).
  const [apAging, setApAging] = useState<ApAging | null>(null);
  const [vat, setVat] = useState<VatReport | null>(null);

  useEffect(() => {
    let alive = true;
    setInvoicingError(false);
    void fetchInvoicingSummary(6)
      .then((d) => { if (alive) setInvoicing(d); })
      .catch(() => { if (alive) { setInvoicing(null); setInvoicingError(true); } });
    return () => { alive = false; };
  }, [fetchInvoicingSummary]);

  // Antigüedad de pagos a proveedores (espejo del aging de cobros).
  useEffect(() => {
    let alive = true;
    void fetchApAging()
      .then((d) => { if (alive) setApAging(d); })
      .catch(() => { if (alive) setApAging(null); });
    return () => { alive = false; };
  }, [fetchApAging]);

  // IVA a liquidar (Modelo 303): repercutido − soportado, en el periodo elegido
  // (con "Personalizado" puedes acotar el trimestre fiscal real).
  useEffect(() => {
    let alive = true;
    void fetchVatReport({ from: range.from, to: range.to })
      .then((d) => { if (alive) setVat(d); })
      .catch(() => { if (alive) setVat(null); });
    return () => { alive = false; };
  }, [fetchVatReport, range.from, range.to]);

  // Carga la serie según el periodo elegido (se re-dispara al cambiar el rango).
  useEffect(() => {
    let alive = true;
    void fetchInvoicingSeries({ from: range.from, to: range.to })
      .then((d) => { if (alive) setSeries(d); })
      .catch(() => { if (alive) setSeries([]); });
    return () => { alive = false; };
  }, [fetchInvoicingSeries, range.from, range.to]);

  // Fila de documento clicable → abre la factura en el editor. Estilo "enlace"
  // sutil: el número toma el color del acento al hover. Accesible (role/tab).
  const rowInteractive = (id: string): React.HTMLAttributes<HTMLDivElement> => ({
    role: 'button',
    tabIndex: 0,
    onClick: () => openInvoice(id),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInvoice(id); } },
    onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; },
    onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
  });

  // KPIs sobre facturas (invoice); los borradores no cuentan como facturado
  // (aún no emitidos).
  const invoices = documents.filter((d) => d.type === 'invoice');
  const facturado = invoices.filter((d) => d.status !== 'draft').reduce((s, d) => s + Number(d.total), 0);
  const cobrado = invoices.filter((d) => d.status === 'paid').reduce((s, d) => s + Number(d.total), 0);
  const pendienteStatuses: DocStatus[] = ['sent', 'partial', 'overdue'];
  const pendiente = invoices.filter((d) => pendienteStatuses.includes(d.status)).reduce((s, d) => s + Number(d.total), 0);
  const vencido = invoices.filter((d) => d.status === 'overdue').reduce((s, d) => s + Number(d.total), 0);

  // KPIs de COMPRAS (facturas recibidas type='bill'); los borradores no cuentan.
  const bills = documents.filter((d) => d.type === 'bill');
  const gastos = bills.filter((d) => d.status !== 'draft').reduce((s, d) => s + Number(d.total), 0);
  const pagado = bills.filter((d) => d.status === 'paid').reduce((s, d) => s + Number(d.total), 0);
  const porPagar = bills.filter((d) => pendienteStatuses.includes(d.status)).reduce((s, d) => s + Number(d.total), 0);
  const vencidoPagar = bills.filter((d) => d.status === 'overdue').reduce((s, d) => s + Number(d.total), 0);

  // Resultado del periodo: beneficio = facturado (ventas) − gastos (compras).
  const beneficio = facturado - gastos;

  // "Por cobrar": facturas abiertas (enviadas / parciales / vencidas), las
  // vencidas primero, luego por fecha de vencimiento más próxima.
  const porCobrar = invoices
    .filter((d) => pendienteStatuses.includes(d.status))
    .sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return (a.due_date ?? '').localeCompare(b.due_date ?? '');
    })
    .slice(0, 8);

  // "Facturas recientes": documentos de VENTA (excluye facturas recibidas, que
  // tienen su pestaña Recibidas), por fecha de emisión desc.
  const recientes = documents
    .filter((d) => d.type !== 'bill')
    .sort((a, b) => (b.issue_date ?? '').localeCompare(a.issue_date ?? ''))
    .slice(0, 8);

  const labelFor = (d: FinanceDoc) => d.number ?? 'Sin número';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Kpi label="Facturado" emoji="🧾" value={fmtMoney(facturado)} hint="facturas emitidas" accent="var(--amber)" />
        <Kpi label="Cobrado" emoji="💰" value={fmtMoney(cobrado)} hint="facturas pagadas" accent="var(--mod-finance)" />
        <Kpi label="Pendiente" emoji="⏳" value={fmtMoney(pendiente)} hint="por cobrar" accent="var(--info)" muted={pendiente <= 0} />
        <Kpi label="Vencido" emoji="⚠️" value={fmtMoney(vencido)} hint="fuera de plazo" accent="var(--error)" muted={vencido <= 0} />
      </div>

      {/* KPIs de COMPRAS (facturas recibidas) — acentos rojos/naranjas. */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Kpi label="Gastos" emoji="🧾" value={fmtMoney(gastos)} hint="facturas recibidas" accent="var(--error)" muted={gastos <= 0} />
        <Kpi label="Pagado" emoji="💸" value={fmtMoney(pagado)} hint="facturas saldadas" accent="var(--amber)" muted={pagado <= 0} />
        <Kpi label="Por pagar" emoji="⏳" value={fmtMoney(porPagar)} hint="pendiente de pago" accent="var(--warning)" muted={porPagar <= 0} />
        <Kpi label="Vencido a pagar" emoji="⚠️" value={fmtMoney(vencidoPagar)} hint="fuera de plazo" accent="var(--error)" muted={vencidoPagar <= 0} />
      </div>

      {/* Resultado del periodo: beneficio (ventas − gastos) + IVA a liquidar (303). */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Resultado del periodo</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: beneficio >= 0 ? 'var(--mod-finance)' : 'var(--error)', fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>
              {fmtMoney(beneficio)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {fmtMoney(facturado)} facturado − {fmtMoney(gastos)} gastos
            </div>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 180, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>IVA a liquidar (303) · {title}</div>
            {vat ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>
                  {fmtMoney(vat.to_settle)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  repercutido {fmtMoney(vat.output)} − soportado {fmtMoney(vat.input)} = {fmtMoney(vat.to_settle)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Sin datos de IVA todavía.</div>
            )}
          </div>
        </div>
      </div>

      {/* Cabecera de gráficas: título + selector de periodo (conduce la de facturación).
          Con "Personalizado" aparece una 2ª fila con dos calendarios (desde/hasta). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Gráficas</div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
        {period === 'custom' && (
          <CustomRangeInputs from={customFrom} to={customTo} onFrom={setCustomFrom} onTo={setCustomTo} />
        )}
      </div>

      {/* Gráficas: facturación unificada (líneas+barras) + aging + top clientes */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <ChartCard title={`Facturación · ${title}`} subtitle="acumulado + por periodo" flex="2 1 380px">
          <InvoicingChart series={series} />
        </ChartCard>
        {invoicing && (
          <ChartCard title="Antigüedad de cobros" subtitle="saldo pendiente" flex="1 1 320px">
            <AgingChart summary={invoicing} />
          </ChartCard>
        )}
        {apAging && (
          <ChartCard title="Antigüedad de pagos" subtitle="pendiente de pagar a proveedores" flex="1 1 320px">
            <ApAgingChart aging={apAging} />
          </ChartCard>
        )}
      </div>
      {invoicingError ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
          No se pudieron cargar las gráficas de facturación.
        </div>
      ) : invoicing ? (
        <ChartCard title="Top clientes" subtitle="por facturado" flex="1 1 100%">
          <TopClientsChart rows={invoicing.top_clients} onOpen={openContact} />
        </ChartCard>
      ) : null}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Por cobrar */}
        <div style={{ flex: '1 1 320px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Por cobrar</div>
          {porCobrar.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nada pendiente de cobro.</div>}
          {porCobrar.map((d) => (
            <div key={d.id} {...rowInteractive(d.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 10, cursor: 'pointer', borderRadius: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ color: 'var(--mod-finance)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelFor(d)}</span>
                <StatusBadge status={d.status} />
              </span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: d.status === 'overdue' ? 'var(--error)' : 'var(--text-muted)' }}>vence {fmtDate(d.due_date)}</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>{fmtMoney(d.total, d.currency)}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Facturas recientes */}
        <div style={{ flex: '2 1 400px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Documentos recientes</div>
          {recientes.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin documentos todavía. Crea uno con “+ Factura”.</div>}
          {recientes.map((d) => (
            <div key={d.id} {...rowInteractive(d.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 10, cursor: 'pointer', borderRadius: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ color: 'var(--mod-finance)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelFor(d)}</span>
                <StatusBadge status={d.status} />
              </span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(d.issue_date)}</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>{fmtMoney(d.total, d.currency)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
