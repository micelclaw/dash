/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Área INFORMES: estados contables formales. Sumas y saldos · Balance de situación
// · Pérdidas y ganancias · IVA (303). Todos filtran por el periodo global y se
// exportan a CSV; clic en una cuenta abre su Libro Mayor (navegación encadenada).

import { useEffect, useState } from 'react';
import { Scale, BookOpen, TrendingUp, Receipt } from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { api } from '@/services/api';
import { useFinancePeriod } from '../period';
import { ReportTable, ExportMenu, Money, fmt, Tip, type Account } from './shared';
import type { DataColumn } from '@/components/ui/data-table';

interface TrialRow { account_id: string; code: string | null; group_code: string | null; name: string; type: string; debit: string; credit: string; balance: string; }
interface TrialBalance { rows: TrialRow[]; total_debit: string; total_credit: string; from: string; to: string; }
interface AmountRow { account_id: string; code: string | null; name: string; amount: string; }
interface ProfitLoss { income: AmountRow[]; expense: AmountRow[]; total_income: string; total_expense: string; result: string; }
interface BalanceSheet { assets: AmountRow[]; liabilities: AmountRow[]; equity: AmountRow[]; result: string; total_assets: string; total_liabilities_equity: string; balanced: boolean; to: string; }
interface Vat { model: string; output: string; input: string; to_settle: string; devengado: { rate: number; base: string; cuota: string }[]; soportado: { rate: number; base: string; cuota: string }[]; }

type Sub = 'trial' | 'balance' | 'pl' | 'vat';
const SUBS = [
  { id: 'trial', label: 'Sumas y saldos', icon: Scale },
  { id: 'balance', label: 'Balance de situación', icon: BookOpen },
  { id: 'pl', label: 'Pérdidas y ganancias', icon: TrendingUp },
  { id: 'vat', label: 'IVA (303)', icon: Receipt },
];

export function InformesArea({ onOpenLedger }: { onOpenLedger: (id: string) => void }) {
  const { range } = useFinancePeriod();
  const [sub, setSub] = useState<Sub>('trial');
  const [trial, setTrial] = useState<TrialBalance | null>(null);
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [vat, setVat] = useState<Vat | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const qs = `from=${range.from}&to=${range.to}`;
      try {
        if (sub === 'trial') { const r = (await api.get<{ data: TrialBalance }>(`/finance/reports/trial-balance?${qs}`)).data; if (alive) setTrial(r); }
        else if (sub === 'pl') { const r = (await api.get<{ data: ProfitLoss }>(`/finance/reports/profit-loss?${qs}`)).data; if (alive) setPl(r); }
        else if (sub === 'balance') { const r = (await api.get<{ data: BalanceSheet }>(`/finance/reports/balance-sheet?to=${range.to}`)).data; if (alive) setBs(r); }
        else if (sub === 'vat') { const r = (await api.get<{ data: Vat }>(`/finance/reports/modelo/303?${qs}`)).data; if (alive) setVat(r); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [sub, range.from, range.to]);

  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={SUBS} activeTab={sub} onChange={(s) => setSub(s as Sub)} variant="pills" />

      {sub === 'trial' && <TrialView data={trial} loading={loading} onOpenLedger={onOpenLedger} />}
      {sub === 'pl' && <PlView data={pl} loading={loading} onOpenLedger={onOpenLedger} />}
      {sub === 'balance' && <BalanceView data={bs} loading={loading} onOpenLedger={onOpenLedger} />}
      {sub === 'vat' && <VatView data={vat} loading={loading} />}
    </div>
  );
}

function TrialView({ data, loading, onOpenLedger }: { data: TrialBalance | null; loading: boolean; onOpenLedger: (id: string) => void }) {
  const cuadra = data && Math.abs(Number(data.total_debit) - Number(data.total_credit)) < 0.01;
  const cols: DataColumn<TrialRow>[] = [
    { key: 'code', header: 'Cuenta', sortable: true, width: '80px', render: (r) => <span className="font-mono text-[var(--text-dim)]">{r.code ?? '—'}</span> },
    { key: 'name', header: 'Nombre', sortable: true },
    { key: 'debit', header: 'Debe', align: 'right', sortable: true, sortValue: (r) => Number(r.debit), render: (r) => <Money v={r.debit} /> },
    { key: 'credit', header: 'Haber', align: 'right', sortable: true, sortValue: (r) => Number(r.credit), render: (r) => <Money v={r.credit} /> },
    { key: 'balance', header: 'Saldo', align: 'right', sortable: true, sortValue: (r) => Number(r.balance), render: (r) => <Money v={r.balance} color /> },
  ];
  return (
    <ReportTable
      title={<>Sumas y saldos <span className="text-[var(--text-dim)] font-normal">(balance de comprobación)</span></>}
      tip="sumas_y_saldos"
      columns={cols} rows={data?.rows ?? []} getRowKey={(r) => r.account_id} loading={loading}
      onRowClick={(r) => onOpenLedger(r.account_id)} initialSort={{ key: 'code', dir: 'asc' }}
      search={(r) => `${r.code ?? ''} ${r.name}`} searchPlaceholder="Buscar cuenta…"
      empty="Sin movimientos en el periodo."
      exportName="sumas-y-saldos" exportHeaders={['Codigo', 'Nombre', 'Debe', 'Haber', 'Saldo']}
      exportRow={(r) => [r.code ?? '', r.name, r.debit, r.credit, r.balance]}
      serverReport="trial-balance"
      footer={data && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--border)] text-[13px] font-semibold">
          <span>Totales · clic en una cuenta para ver su Mayor</span>
          <span className="flex items-center gap-5">
            <span>Debe <Money v={data.total_debit} /></span>
            <span>Haber <Money v={data.total_credit} /></span>
            <span style={{ color: cuadra ? 'var(--green)' : 'var(--red)' }}>{cuadra ? '✓ cuadra' : '¡descuadre!'}</span>
          </span>
        </div>
      )}
    />
  );
}

function AmountTable({ title, rows, total, totalLabel, onOpenLedger, exportName, serverReport }: { title: string; rows: AmountRow[]; total: string; totalLabel: string; onOpenLedger: (id: string) => void; exportName: string; serverReport?: string }) {
  const cols: DataColumn<AmountRow>[] = [
    { key: 'code', header: 'Cuenta', width: '80px', sortable: true, render: (r) => <span className="font-mono text-[var(--text-dim)]">{r.code ?? '—'}</span> },
    { key: 'name', header: 'Nombre', sortable: true },
    { key: 'amount', header: 'Importe', align: 'right', sortable: true, sortValue: (r) => Number(r.amount), render: (r) => <Money v={r.amount} /> },
  ];
  return (
    <ReportTable title={title} columns={cols} rows={rows} getRowKey={(r) => r.account_id} onRowClick={(r) => onOpenLedger(r.account_id)} serverReport={serverReport}
      empty="Sin importes en el periodo." exportName={exportName} exportHeaders={['Codigo', 'Nombre', 'Importe']} exportRow={(r) => [r.code ?? '', r.name, r.amount]}
      footer={<div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--border)] text-[13px] font-semibold"><span>{totalLabel}</span><Money v={total} /></div>} />
  );
}

function PlView({ data, loading, onOpenLedger }: { data: ProfitLoss | null; loading: boolean; onOpenLedger: (id: string) => void }) {
  if (loading && !data) return <Skeleton />;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AmountTable title="Ingresos" rows={data.income} total={data.total_income} totalLabel="Total ingresos" onOpenLedger={onOpenLedger} exportName="pyg-ingresos" serverReport="profit-loss" />
        <AmountTable title="Gastos" rows={data.expense} total={data.total_expense} totalLabel="Total gastos" onOpenLedger={onOpenLedger} exportName="pyg-gastos" />
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 flex items-center justify-between text-[15px] font-bold">
        <span className="flex items-center gap-1.5">Resultado ({Number(data.result) >= 0 ? 'beneficio' : 'pérdida'}) <Tip k="resultados" /></span>
        <span className="font-mono" style={{ color: Number(data.result) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(data.result)} €</span>
      </div>
    </div>
  );
}

function BalanceView({ data, loading, onOpenLedger }: { data: BalanceSheet | null; loading: boolean; onOpenLedger: (id: string) => void }) {
  if (loading && !data) return <Skeleton />;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AmountTable title="Activo" rows={data.assets} total={data.total_assets} totalLabel="Total activo" onOpenLedger={onOpenLedger} exportName="balance-activo" serverReport="balance-sheet" />
        <div className="flex flex-col gap-4">
          <AmountTable title="Pasivo" rows={data.liabilities} total={String(data.liabilities.reduce((s, r) => s + Number(r.amount), 0).toFixed(2))} totalLabel="Total pasivo" onOpenLedger={onOpenLedger} exportName="balance-pasivo" />
          <AmountTable title="Patrimonio neto" rows={[...data.equity, { account_id: '__result__', code: '129', name: 'Resultado del ejercicio', amount: data.result }]} total={String((data.equity.reduce((s, r) => s + Number(r.amount), 0) + Number(data.result)).toFixed(2))} totalLabel="Total patrimonio neto" onOpenLedger={onOpenLedger} exportName="balance-patrimonio" />
        </div>
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-[13px] flex items-center justify-between" style={{ color: data.balanced ? 'var(--green)' : 'var(--red)', background: 'var(--card)' }}>
        <span className="flex items-center gap-1.5">{data.balanced ? '✓ El balance cuadra (Activo = Pasivo + Patrimonio neto)' : '¡El balance NO cuadra!'} <Tip k="balance" /></span>
        <span className="font-mono">Activo {fmt(data.total_assets)} · Pasivo + PN {fmt(data.total_liabilities_equity)}</span>
      </div>
    </div>
  );
}

function VatView({ data, loading }: { data: Vat | null; loading: boolean }) {
  if (loading && !data) return <Skeleton />;
  if (!data) return null;
  const toSettle = Number(data.to_settle);
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex justify-end"><ExportMenu serverReport="vat" /></div>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="IVA repercutido" value={data.output} hint="ventas" />
        <Kpi label="IVA soportado" value={data.input} hint="compras" />
        <Kpi label={toSettle >= 0 ? 'A ingresar' : 'A compensar'} value={String(Math.abs(toSettle).toFixed(2))} accent />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VatBreakdown title="IVA repercutido (devengado)" rows={data.devengado} />
        <VatBreakdown title="IVA soportado (deducible)" rows={data.soportado} />
      </div>
      <p className="text-xs text-[var(--text-dim)]">Modelo 303 · liquidación de IVA del periodo seleccionado. Repercutido − soportado = {fmt(data.to_settle)} €.</p>
    </div>
  );
}

function VatBreakdown({ title, rows }: { title: string; rows: { rate: number; base: string; cuota: string }[] }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="px-3 py-2 text-[13px] font-semibold bg-[var(--surface)] border-b border-[var(--border)]">{title}</div>
      <table className="w-full text-[13px]">
        <thead><tr className="text-[var(--text-dim)]"><th className="text-left font-medium px-3 py-1.5">Tipo</th><th className="text-right font-medium px-3 py-1.5">Base</th><th className="text-right font-medium px-3 py-1.5">Cuota</th></tr></thead>
        <tbody>
          {rows.filter((r) => Number(r.cuota) !== 0).map((r, i) => (
            <tr key={i} className="border-t border-[var(--border)]"><td className="px-3 py-1.5">{(r.rate * 100).toFixed(0)}%</td><td className="px-3 py-1.5 text-right"><Money v={r.base} /></td><td className="px-3 py-1.5 text-right"><Money v={r.cuota} /></td></tr>
          ))}
          {rows.filter((r) => Number(r.cuota) !== 0).length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-[var(--text-dim)]">Sin importes.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{label}{hint && <span className="normal-case"> · {hint}</span>}</div>
      <div className="text-lg font-bold font-mono mt-0.5" style={accent ? { color: 'var(--mod-finance)' } : undefined}>{fmt(value)} €</div>
    </div>
  );
}

function Skeleton() {
  return <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center text-[var(--text-dim)] text-sm">Cargando…</div>;
}

export type { Account };
