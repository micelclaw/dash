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

// P1 — Resumen (dashboard Personal): 4 KPIs + gráficas + cuentas + movimientos recientes.

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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useFinancePersonalStore, type FinanceSeriesPoint, type FinanceAccountSeries, type FinanceCategoryTotal, type FinanceSummary, type FinanceTransaction } from '@/stores/finance-personal.store';
import { fmtMoney, movementFace, categoryVisual, tintBackground, CATEGORY_FALLBACK_COLOR } from './lib';
import { usePersonalNav } from './navigation';
import { RecurrenceBadge } from './RecurrenceBadge';
import { useFinancePeriod } from '../period';

function Kpi({ label, value, hint, accent, emoji }: { label: string; value: string; hint?: string; accent?: string; emoji?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 150, position: 'relative', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14, overflow: 'hidden' }}>
      {accent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
        {emoji && <span style={{ fontSize: 13 }}>{emoji}</span>}{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent ?? 'var(--text)', fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ── Tarjeta contenedora de gráfica ─────────────────────────────────
// `action` (opcional) se pinta a la derecha del título, en la misma fila. Si no
// se pasa, la cabecera es idéntica a la versión previa (retrocompatible).
export function ChartCard({ title, children, flex, action }: { title: string; children: React.ReactNode; flex: string; action?: React.ReactNode }) {
  return (
    <div style={{ flex, minWidth: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Toggle segmentado "Gasto / Ingreso" del donut. El pill activo se distingue por
// color: rojo (var(--error)) para gasto, verde (var(--mod-finance)) para ingreso.
function SpendKindToggle({ value, onChange }: { value: 'expense' | 'income'; onChange: (k: 'expense' | 'income') => void }) {
  const opts: { id: 'expense' | 'income'; label: string; accent: string }[] = [
    { id: 'expense', label: 'Expense', accent: 'var(--error)' },
    { id: 'income', label: 'Income', accent: 'var(--mod-finance)' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)' }}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          padding: '4px 10px', borderRadius: 'var(--radius-sm, 4px)', border: 'none', cursor: 'pointer', fontSize: 12,
          background: value === o.id ? o.accent : 'transparent',
          color: value === o.id ? '#0a0a0a' : 'var(--text-dim)', fontWeight: value === o.id ? 600 : 500,
          whiteSpace: 'nowrap',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function EmptyChart({ height = 200 }: { height?: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
      No data yet.
    </div>
  );
}

// Fecha corta para el eje X (ej. "12 jun").
function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
}

// ── Tooltip de la gráfica de patrimonio ────────────────────────────
const NET_WORTH_COLOR = 'var(--info)';          // línea de patrimonio (azul)
const INCOME_BAR_COLOR = 'var(--mod-finance)';  // barra de ingreso (verde)
const EXPENSE_BAR_COLOR = 'var(--error)';        // barra de gasto (rojo)

// € abreviado para el eje de movimientos (sin decimales, pega el símbolo).
function moneyAxisShort(v: number): string {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v).replace(/\s/g, '');
  } catch {
    return `${Math.round(v)}€`;
  }
}

function NetWorthTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => Number(payload.find((p) => p.dataKey === k)?.value ?? 0);
  const income = get('income'), expense = get('expense');
  const row = (color: string, name: string, value: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', marginTop: 2 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />
      {name}
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(value)}</span>
    </div>
  );
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface, #1a1a24)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', fontSize: 12, minWidth: 150 }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{label ? shortDate(String(label)) : ''}</div>
      {row(NET_WORTH_COLOR, 'Net worth', get('net_worth'))}
      {income > 0 && row(INCOME_BAR_COLOR, 'Income', income)}
      {expense > 0 && row(EXPENSE_BAR_COLOR, 'Expense', expense)}
    </div>
  );
}

// ── Gráfica de evolución del patrimonio ────────────────────────────
// Línea AZUL = patrimonio (eje izq). Barras verde/roja = ingreso/gasto del día
// sobre un SEGUNDO eje a la derecha con su propia escala.
function NetWorthChart({ series }: { series: FinanceSeriesPoint[] }) {
  const data = useMemo(
    () => series.map((p) => ({ date: p.date, net_worth: Number(p.net_worth), income: Number(p.income), expense: Number(p.expense) })),
    [series],
  );
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={1} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={moneyAxisShort}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        {/* Eje derecho: movimientos (barras), escala propia */}
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={moneyAxisShort}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<NetWorthTooltip />} cursor={{ stroke: 'var(--border)' }} />
        <Bar yAxisId="right" dataKey="income" name="Income" fill={INCOME_BAR_COLOR} radius={[2, 2, 0, 0]} maxBarSize={22} />
        <Bar yAxisId="right" dataKey="expense" name="Expense" fill={EXPENSE_BAR_COLOR} radius={[2, 2, 0, 0]} maxBarSize={22} />
        <Line yAxisId="left" type="monotone" dataKey="net_worth" name="Net worth" stroke={NET_WORTH_COLOR} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const ACCOUNT_LINE_COLORS = ['#4f8cff', '#3ecf8e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

function AccountSeriesTooltip({
  active,
  payload,
  label,
  accounts,
  seriesCurrency,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; color?: string }[];
  label?: string;
  accounts: FinanceAccountSeries['accounts'];
  seriesCurrency: string;
}) {
  if (!active || !payload?.length) return null;
  const byId = new Map(accounts.map((account) => [account.account_id, account]));
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface, #1a1a24)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', fontSize: 12, minWidth: 170 }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{label ? shortDate(String(label)) : ''}</div>
      {payload.map((point) => {
        const account = byId.get(String(point.dataKey));
        if (!account) return null;
        return (
          <div key={account.account_id} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', marginTop: 2 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: point.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.name}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(point.value, seriesCurrency)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function buildAccountSeriesLines(accounts: FinanceAccountSeries['accounts']): React.ReactElement[] {
  return accounts.map((account, index) => (
    <Line key={account.account_id} type="monotone" dataKey={account.account_id} name={account.name} stroke={ACCOUNT_LINE_COLORS[index % ACCOUNT_LINE_COLORS.length]} strokeWidth={2} dot={false} />
  ));
}

export function AccountBalanceChart({ series }: { series: FinanceAccountSeries }) {
  const data = useMemo(
    () => series.dates.map((date, index) => ({
      date,
      ...Object.fromEntries(series.accounts.map((account) => [account.account_id, Number(account.values[index] ?? 0)])),
    })),
    [series],
  );
  if (data.length === 0 || series.accounts.length === 0) return <EmptyChart />;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 8 }}>
        {series.accounts.map((account, index) => (
          <span key={account.account_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)', fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCOUNT_LINE_COLORS[index % ACCOUNT_LINE_COLORS.length] }} />
            {account.name}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis tickFormatter={moneyAxisShort} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<AccountSeriesTooltip accounts={series.accounts} seriesCurrency={series.base_currency} />} cursor={{ stroke: 'var(--border)' }} />
          {buildAccountSeriesLines(series.accounts)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AccountSeriesChartCard({ series, title }: { series: FinanceAccountSeries; title: string }) {
  return (
    <ChartCard title={`Account balances over time · ${title}${series.base_currency ? ` · ${series.base_currency}` : ''}`} flex="1 1 100%">
      <AccountBalanceChart series={series} />
    </ChartCard>
  );
}

// ── Cash flow mensual (ingresos vs gastos + ahorro) ────────────
// 'YYYY-MM' → 'jun' (mes corto) para el eje X.
function shortMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d).replace('.', '');
}

function CashflowTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => Number(payload.find((p) => p.dataKey === k)?.value ?? 0);
  const inc = get('income'), exp = get('expense'), net = inc - exp;
  const row = (color: string, name: string, value: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', marginTop: 2 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />{name}
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(value)}</span>
    </div>
  );
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface, #1a1a24)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', fontSize: 12, minWidth: 150 }}>
      <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>{label ? shortMonth(String(label)) : ''}</div>
      {row(INCOME_BAR_COLOR, 'Income', inc)}
      {row(EXPENSE_BAR_COLOR, 'Expenses', exp)}
      {row(NET_WORTH_COLOR, 'Savings', net)}
    </div>
  );
}

// Agrupa la serie diaria por mes → barras ingresos/gastos + línea de ahorro neto.
function CashflowChart({ series }: { series: FinanceSeriesPoint[] }) {
  const data = useMemo(() => {
    const m = new Map<string, { bucket: string; income: number; expense: number }>();
    for (const p of series) {
      const k = p.date.slice(0, 7);
      const cur = m.get(k) ?? { bucket: k, income: 0, expense: 0 };
      cur.income += Number(p.income); cur.expense += Number(p.expense);
      m.set(k, cur);
    }
    return [...m.values()].map((d) => ({ ...d, net: Math.round((d.income - d.expense) * 100) / 100 }));
  }, [series]);
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) return <EmptyChart height={200} />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={shortMonth} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tickFormatter={moneyAxisShort} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<CashflowTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
        <Bar dataKey="income" name="Income" fill={INCOME_BAR_COLOR} radius={[2, 2, 0, 0]} maxBarSize={26} />
        <Bar dataKey="expense" name="Expenses" fill={EXPENSE_BAR_COLOR} radius={[2, 2, 0, 0]} maxBarSize={26} />
        <Line type="monotone" dataKey="net" name="Savings" stroke={NET_WORTH_COLOR} strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Tooltip del donut de gasto por categoría ───────────────────────
function CategoryTooltip({ active, payload }: { active?: boolean; payload?: { payload?: CatSlice }[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface, #1a1a24)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', fontSize: 12 }}>
      <div style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{d.emoji}</span>{d.name}
      </div>
      <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>{fmtMoney(d.value)}</div>
    </div>
  );
}

interface CatSlice {
  id: string;
  name: string;
  emoji: string;
  color: string;
  value: number;
}

// ── Donut de gasto por categoría + leyenda ─────────────────────────
function SpendByCategoryChart({ rows }: { rows: FinanceCategoryTotal[] }) {
  const slices = useMemo<CatSlice[]>(
    () =>
      rows
        .map((r) => ({
          id: r.category_id ?? '__none__',
          name: r.name ?? 'Uncategorised',
          emoji: r.icon?.trim() || '🏷️',
          color: r.color?.trim() || CATEGORY_FALLBACK_COLOR,
          value: Number(r.total),
        }))
        .filter((s) => s.value > 0),
    [rows],
  );

  if (slices.length === 0) return <EmptyChart />;
  const total = slices.reduce((a, s) => a + s.value, 0);

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: '1 1 180px', minWidth: 160, height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={84} paddingAngle={1.5} stroke="var(--card)" strokeWidth={2}>
              {slices.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<CategoryTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Leyenda: emoji + nombre + importe, ordenada como llega (desc por total). */}
      <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', flexShrink: 0, fontSize: 12, background: tintBackground(s.color) }}>{s.emoji}</span>
              <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{s.name}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{pct}%</span>
              <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>{fmtMoney(s.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResumenTab() {
  const { summary: storeSummary, accounts, categories, fetchSeries, fetchAccountSeries, fetchSpendByCategory, fetchSummaryRange, fetchRecentTransactions } = useFinancePersonalStore();
  const catById = new Map(categories.map((c) => [c.id, c]));
  const userAccounts = accounts.filter((a) => a.type === 'asset' || a.type === 'liability');

  const nav = usePersonalNav();
  // Periodo compartido (selector en el header de la lente) — conduce KPIs, gráficas y recientes.
  const { range, title } = useFinancePeriod();
  const [series, setSeries] = useState<FinanceSeriesPoint[]>([]);
  const [accountSeries, setAccountSeries] = useState<FinanceAccountSeries>({ base_currency: '', dates: [], accounts: [] });
  const [spend, setSpend] = useState<FinanceCategoryTotal[]>([]);
  const [spendKind, setSpendKind] = useState<'expense' | 'income'>('expense');
  // Resumen y movimientos recientes ACOTADOS al periodo. net_worth/available siguen
  // siendo all-time (el backend los devuelve fijos); solo expenses_period/income_period
  // dependen del rango.
  const [periodSummary, setPeriodSummary] = useState<FinanceSummary | null>(null);
  const [recent, setRecent] = useState<FinanceTransaction[]>([]);

  // Resumen del periodo (KPIs). Se re-dispara al cambiar el rango y cuando el resumen
  // global del store cambia (proxy de "ha habido un movimiento" → refresco en vivo WS).
  useEffect(() => {
    let alive = true;
    void fetchSummaryRange({ from: range.from, to: range.to }).then((d) => { if (alive) setPeriodSummary(d); }).catch(() => { if (alive) setPeriodSummary(null); });
    return () => { alive = false; };
  }, [fetchSummaryRange, range.from, range.to, storeSummary?.net_worth]);

  // Movimientos recientes DEL PERIODO (orden date desc, máx 8). Si el periodo termina
  // en fecha pasada, muestra los de ese periodo (no los últimos absolutos).
  useEffect(() => {
    let alive = true;
    void fetchRecentTransactions({ from: range.from, to: range.to, limit: 8 }).then((d) => { if (alive) setRecent(d); }).catch(() => { if (alive) setRecent([]); });
    return () => { alive = false; };
  }, [fetchRecentTransactions, range.from, range.to, storeSummary?.net_worth]);

  // Carga la serie de patrimonio según el periodo elegido. Se re-dispara al
  // cambiar el periodo y cuando cambia el patrimonio del resumen (proxy de "ha
  // habido un movimiento"), así refleja los nuevos datos. NO depende de spendKind.
  useEffect(() => {
    let alive = true;
    void fetchSeries({ from: range.from, to: range.to }).then((d) => { if (alive) setSeries(d); }).catch(() => { if (alive) setSeries([]); });
    return () => { alive = false; };
  }, [fetchSeries, range.from, range.to, storeSummary?.net_worth]);

  useEffect(() => {
    let alive = true;
    void fetchAccountSeries({ from: range.from, to: range.to })
      .then((data) => { if (alive) setAccountSeries(data); })
      .catch(() => { if (alive) setAccountSeries({ base_currency: '', dates: [], accounts: [] }); });
    return () => { alive = false; };
  }, [fetchAccountSeries, range.from, range.to, storeSummary?.net_worth]);

  // Carga el reparto por categoría del donut. Depende además de spendKind (gasto
  // vs ingreso), así cambiar el toggle recarga solo el donut, no la serie.
  useEffect(() => {
    let alive = true;
    void fetchSpendByCategory({ from: range.from, to: range.to, kind: spendKind }).then((d) => { if (alive) setSpend(d); }).catch(() => { if (alive) setSpend([]); });
    return () => { alive = false; };
  }, [fetchSpendByCategory, range.from, range.to, spendKind, storeSummary?.net_worth, storeSummary?.expenses_period]);

  // Derivados pro: tasa de ahorro (ingresos−gastos)/ingresos y variación del
  // patrimonio en el periodo (último − primer punto de la serie).
  const incomeP = Number(periodSummary?.income_period ?? 0);
  const expenseP = Number(periodSummary?.expenses_period ?? 0);
  const netSaved = incomeP - expenseP;
  const savingsRate = incomeP > 0.005 ? Math.max(0, Math.round(((incomeP - expenseP) / incomeP) * 100)) : 0;
  const nwDelta = series.length >= 2 ? Number(series[series.length - 1]?.net_worth ?? 0) - Number(series[0]?.net_worth ?? 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Kpi label="Net worth" emoji="💎" value={fmtMoney(periodSummary?.net_worth)} hint={series.length >= 2 ? `${nwDelta >= 0 ? '▲ +' : '▼ −'}${fmtMoney(Math.abs(nwDelta))} · ${title.toLowerCase()}` : 'activo − pasivo'} accent={Number(periodSummary?.net_worth ?? 0) < 0 ? 'var(--error)' : 'var(--mod-finance)'} />
        <Kpi label="Spent" emoji="💸" value={fmtMoney(periodSummary?.expenses_period)} hint={title} accent="var(--error)" />
        <Kpi label="Income" emoji="💰" value={fmtMoney(periodSummary?.income_period)} hint={title} accent="var(--mod-finance)" />
        <Kpi label="Savings rate" emoji="🐷" value={`${savingsRate} %`} hint={netSaved >= 0 ? `you save ${fmtMoney(netSaved)}` : `you overspend by ${fmtMoney(-netSaved)}`} accent={netSaved >= 0 ? 'var(--mod-finance)' : 'var(--error)'} />
        <Kpi label="Available balance" emoji="🏦" value={fmtMoney(periodSummary?.available)} hint="asset accounts" />
      </div>

      {/* Gráficas: evolución del patrimonio + gasto por categoría (el selector de
          periodo vive en el header de la lente). */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <ChartCard title={`Net worth over time · ${title}`} flex="2 1 360px">
          <NetWorthChart series={series} />
        </ChartCard>
        <ChartCard
          title={`${spendKind === 'income' ? 'Income' : 'Expense'} by category · ${title}`}
          flex="1 1 320px"
          action={<SpendKindToggle value={spendKind} onChange={setSpendKind} />}
        >
          <SpendByCategoryChart rows={spend} />
        </ChartCard>
      </div>

      {/* Cash flow mensual: ingresos vs gastos + ahorro neto (línea). */}
      <ChartCard title={`Cash flow · ${title}`} flex="1 1 100%">
        <CashflowChart series={series} />
      </ChartCard>

      <AccountSeriesChartCard series={accountSeries} title={title} />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Cuentas */}
        <div style={{ flex: '1 1 280px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Accounts</div>
          {userAccounts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No accounts yet.</div>}
          {userAccounts.map((a) => (
            <div key={a.id} role="button" tabIndex={0}
              title="Abrir cuenta"
              onClick={() => nav.openAccount(a.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav.openAccount(a.id); } }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 6px', margin: '0 -6px', borderRadius: 'var(--radius-sm, 4px)', borderBottom: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
              <span style={{ color: 'var(--text-dim)' }}>{a.name}</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', color: Number(a.balance) < 0 ? 'var(--error)' : 'var(--text)' }}>{fmtMoney(a.balance, a.currency)}</span>
            </div>
          ))}
        </div>

        {/* Movimientos recientes */}
        <div style={{ flex: '2 1 400px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Recent movements</div>
          {recent.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No movements yet. Create one with “+ New movement”.</div>}
          {recent.map((tx) => {
            const f = movementFace(tx, accounts);
            const cat = f.categoryId ? catById.get(f.categoryId) : undefined;
            const cv = cat ? categoryVisual(cat) : null;
            return (
              <div key={tx.id} role="button" tabIndex={0}
                title="Ver movimiento"
                onClick={() => nav.openMovement(tx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav.openMovement(tx); } }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', margin: '0 -6px', borderRadius: 'var(--radius-sm, 4px)', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 10, cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', minWidth: 0 }}>
                  <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', flexShrink: 0, fontSize: 13, background: cv ? tintBackground(cv.color) : 'var(--surface-hover)' }}>{cv ? cv.emoji : f.glyph}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || (f.isTransfer ? 'Transfer' : 'Movement')}</span>
                  {tx.recurring_rule_id && <RecurrenceBadge compact />}
                </span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cv ? cv.name : f.accountName}</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: f.signed >= 0 ? 'var(--mod-finance)' : 'var(--text)' }}>{f.signed >= 0 ? '+' : ''}{fmtMoney(f.signed)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
