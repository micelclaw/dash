/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Lente CONTABILIDAD reorganizada en 5 ÁREAS (estilo programa profesional):
//   Resumen · Contabilidad (libro) · Gestión · Informes · Configuración.
// Entendible para un no-contable (doble etiqueta + tooltips de jerga) pero con la
// potencia de un programa de verdad (tablas con orden/búsqueda/exportar, Diario,
// asientos manuales, plan de cuentas gestionable, navegación encadenada).

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { LayoutDashboard, BookOpen, FolderKanban, FileBarChart, Settings, Plus, Wallet, Scale, Receipt, ArrowRight } from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { api } from '@/services/api';
import { useFinancePeriod, PeriodControl } from '../period';
import { InformesArea } from './InformesArea';
import { LibroArea } from './LibroArea';
import { GestionArea, ConfiguracionArea } from './GestionConfigArea';
import { fmt, Money, Tip } from './shared';

type Area = 'resumen' | 'contabilidad' | 'gestion' | 'informes' | 'config';
const AREAS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'contabilidad', label: 'Contabilidad', icon: BookOpen },
  { id: 'gestion', label: 'Gestión', icon: FolderKanban },
  { id: 'informes', label: 'Informes', icon: FileBarChart },
  { id: 'config', label: 'Configuración', icon: Settings },
];

export function ContabilidadLens() {
  const [, setParams] = useSearchParams();
  const [area, setArea] = useState<Area>('resumen');
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);

  const openLedger = (id: string) => { setLedgerAccountId(id); setArea('contabilidad'); };
  const openDocument = (docId: string) => setParams((p) => { p.set('tab', 'facturacion'); p.set('doc', docId); p.delete('contact'); return p; }, { replace: true });
  // Cierra la cadena Sumas→Mayor→Asiento→Factura→Contacto: salta a Facturación con la
  // ficha del contacto abierta (?tab=facturacion&contact=).
  const openContact = (contactId: string) => setParams((p) => { p.set('tab', 'facturacion'); p.set('contact', contactId); p.delete('doc'); return p; }, { replace: true });
  const goArea = (a: Area) => { setLedgerAccountId(null); setArea(a); };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-6 pt-1 pb-2 flex-wrap border-b border-[var(--border)]">
        <Tabs tabs={AREAS} activeTab={area} onChange={(a) => goArea(a as Area)} variant="underline" />
        <div className="flex-1" />
        {area !== 'config' && <PeriodControl />}
      </div>

      <div className="px-6 py-4">
        {area === 'resumen' && <ResumenArea onGo={goArea} onOpenLedger={openLedger} />}
        {area === 'contabilidad' && <LibroArea initialLedgerAccountId={ledgerAccountId} onOpenDocument={openDocument} onOpenContact={openContact} />}
        {area === 'gestion' && <GestionArea />}
        {area === 'informes' && <InformesArea onOpenLedger={openLedger} />}
        {area === 'config' && <ConfiguracionArea />}
      </div>
    </div>
  );
}

// ─── Área RESUMEN (dashboard contable) ───────────────────────────────────────
interface PL { result: string; total_income: string; total_expense: string; }
interface Vat { to_settle: string; }
interface WalletAccount { id: string; subtype: string | null; balance: string; }
interface BalanceSheet { total_assets: string; total_liabilities_equity: string; result: string; equity: { amount: string }[]; balanced: boolean; }

function ResumenArea({ onGo }: { onGo: (a: Area) => void; onOpenLedger: (id: string) => void }) {
  const { range, title } = useFinancePeriod();
  const [pl, setPl] = useState<PL | null>(null);
  const [vat, setVat] = useState<Vat | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [tesoreria, setTesoreria] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const qs = `from=${range.from}&to=${range.to}`;
    Promise.all([
      api.get<{ data: PL }>(`/finance/reports/profit-loss?${qs}`).then((r) => r.data).catch(() => null),
      api.get<{ data: Vat }>(`/finance/reports/modelo/303?${qs}`).then((r) => r.data).catch(() => null),
      api.get<{ data: BalanceSheet }>(`/finance/reports/balance-sheet?to=${range.to}`).then((r) => r.data).catch(() => null),
      api.get<{ data: WalletAccount[] }>(`/finance/accounts`).then((r) => r.data ?? []).catch(() => [] as WalletAccount[]),
    ]).then(([p, v, b, accts]) => {
      if (!alive) return;
      setPl(p); setVat(v); setBs(b);
      const liquid = accts.filter((a) => ['bank', 'cash', 'credit_card'].includes(a.subtype ?? '')).reduce((s, a) => s + Number(a.balance ?? 0), 0);
      setTesoreria(liquid);
    });
    return () => { alive = false; };
  }, [range.from, range.to]);

  const result = pl ? Number(pl.result) : 0;
  const toSettle = vat ? Number(vat.to_settle) : 0;
  const netWorth = bs ? bs.equity.reduce((s, e) => s + Number(e.amount), 0) + Number(bs.result) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Resultado" sub={title} value={`${fmt(result)} €`} color={result >= 0 ? 'var(--green)' : 'var(--red)'} icon={TrendingIcon(result)} />
        <KpiCard label="Tesorería" sub="bancos y caja" value={tesoreria != null ? `${fmt(tesoreria)} €` : '—'} icon={<Wallet size={16} />} />
        <KpiCard label={toSettle >= 0 ? 'IVA a ingresar' : 'IVA a compensar'} sub="modelo 303" value={`${fmt(Math.abs(toSettle))} €`} icon={<Receipt size={16} />} />
        <KpiCard label="Patrimonio neto" sub="capital + resultado" value={`${fmt(netWorth)} €`} icon={<Scale size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-[13px] font-semibold mb-3 flex items-center gap-1.5">Pérdidas y ganancias <Tip k="resultados" /></div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-dim)]">Ingresos</span><Money v={pl?.total_income ?? 0} /></div>
            <div className="flex justify-between"><span className="text-[var(--text-dim)]">Gastos</span><Money v={pl?.total_expense ?? 0} /></div>
            <div className="flex justify-between font-bold pt-2 border-t border-[var(--border)]"><span>Resultado</span><span className="font-mono" style={{ color: result >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(pl?.result ?? 0)} €</span></div>
          </div>
          <button type="button" onClick={() => onGo('informes')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--mod-finance)] hover:underline">Ver informes <ArrowRight size={13} /></button>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
          <div className="text-[13px] font-semibold">Accesos rápidos</div>
          <div className="grid grid-cols-2 gap-2">
            <Quick label="Nuevo asiento" icon={<Plus size={15} />} onClick={() => onGo('contabilidad')} />
            <Quick label="Libro Diario" icon={<BookOpen size={15} />} onClick={() => onGo('contabilidad')} />
            <Quick label="Plan de cuentas" icon={<FolderKanban size={15} />} onClick={() => onGo('contabilidad')} />
            <Quick label="Modelos fiscales" icon={<Receipt size={15} />} onClick={() => onGo('informes')} />
          </div>
          {bs && !bs.balanced && <div className="text-xs text-[var(--red)] mt-1">⚠ El balance no cuadra — revisa los asientos en el Libro Diario.</div>}
          {bs && bs.balanced && <div className="text-xs text-[var(--green)] mt-1">✓ La contabilidad cuadra.</div>}
        </div>
      </div>
    </div>
  );
}

function TrendingIcon(v: number) { return <span style={{ color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>{v >= 0 ? '▲' : '▼'}</span>; }

function KpiCard({ label, sub, value, color, icon }: { label: string; sub: string; value: string; color?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-3.5">
      <div className="flex items-center justify-between text-[var(--text-dim)]"><span className="text-[11px] uppercase tracking-wide">{label}</span>{icon}</div>
      <div className="text-xl font-bold font-mono mt-1" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{sub}</div>
    </div>
  );
}
function Quick({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-[var(--radius-md,8px)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--mod-finance)] text-left">
      <span className="text-[var(--mod-finance)]">{icon}</span>{label}
    </button>
  );
}
