/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Lente CONTABILIDAD reorganizada en 5 ÁREAS (estilo programa profesional):
//   Resumen · Contabilidad (libro) · Gestión · Informes · Configuración.
// Entendible para un no-contable (doble etiqueta + tooltips de jerga) pero con la
// potencia de un programa de verdad (tablas con orden/búsqueda/exportar, Diario,
// asientos manuales, plan de cuentas gestionable, navegación encadenada).

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { LayoutDashboard, BookOpen, FolderKanban, FileBarChart, Settings, Plus, Wallet, Scale, Receipt, ArrowRight } from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { api } from '@/services/api';
import { useFinancePeriod, PeriodControl } from '../period';
import { InformesArea } from './InformesArea';
import { LibroArea, AsientoDetalle, type JournalEntry } from './LibroArea';
import { GestionArea, ConfiguracionArea } from './GestionConfigArea';
import { fmt, Money, Tip } from './shared';

type Area = 'resumen' | 'contabilidad' | 'gestion' | 'informes' | 'config';
const AREAS = [
  { id: 'resumen', label: 'Overview', icon: LayoutDashboard },
  { id: 'contabilidad', label: 'Accounting', icon: BookOpen },
  { id: 'gestion', label: 'Management', icon: FolderKanban },
  { id: 'informes', label: 'Reports', icon: FileBarChart },
  { id: 'config', label: 'Settings', icon: Settings },
];

export function ContabilidadLens() {
  const [params, setParams] = useSearchParams();
  const [area, setArea] = useState<Area>('resumen');
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);
  const [deepEntry, setDeepEntry] = useState<JournalEntry | null>(null);

  const openLedger = (id: string) => { setLedgerAccountId(id); setArea('contabilidad'); };
  const openDocument = (docId: string) => setParams((p) => { p.set('tab', 'facturacion'); p.set('doc', docId); p.delete('contact'); return p; }, { replace: true });
  // Cierra la cadena Sumas→Mayor→Asiento→Factura→Contacto: salta a Facturación con la
  // ficha del contacto abierta (?tab=facturacion&contact=).
  const openContact = (contactId: string) => setParams((p) => { p.set('tab', 'facturacion'); p.set('contact', contactId); p.delete('doc'); return p; }, { replace: true });
  const goArea = (a: Area) => { setLedgerAccountId(null); setArea(a); };

  // Deep-link ?entry=<id> (chips finance_journal_entry del chat): carga el asiento
  // por id y abre su AsientoDetalle sobre cualquier área. Al cerrar, limpia el param.
  const entryParam = params.get('entry');
  useEffect(() => {
    if (!entryParam) return;
    let cancelled = false;
    void api.get<{ data: JournalEntry }>(`/finance/journal-entries/${entryParam}`)
      .then((r) => { if (!cancelled) setDeepEntry(r.data); })
      .catch(() => { if (!cancelled) toast.error('Entry not found'); });
    return () => { cancelled = true; };
  }, [entryParam]);

  const closeDeepEntry = useCallback(() => {
    setDeepEntry(null);
    setParams((p) => {
      if (!p.has('entry')) return p;
      const next = new URLSearchParams(p);
      next.delete('entry');
      return next;
    }, { replace: true });
  }, [setParams]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-6 pt-1 pb-2 flex-wrap border-b border-[var(--border)]">
        <Tabs className="cont-subtabs" tabs={AREAS} activeTab={area} onChange={(a) => goArea(a as Area)} variant="underline" />
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

      {deepEntry && <AsientoDetalle entry={deepEntry} onClose={closeDeepEntry} onChanged={closeDeepEntry} onOpenDocument={openDocument} onOpenContact={openContact} />}
      <style>{`
        /* Móvil (<768px): la tira de áreas pasa a ancho completo con scroll
           horizontal en vez de desbordar la página a 393px. */
        @media (max-width: 767px) {
          .cont-subtabs {
            flex: 1 1 100%;
            min-width: 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .cont-subtabs > a, .cont-subtabs > button { flex-shrink: 0; white-space: nowrap; }
        }
      `}</style>
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
        <KpiCard label="Result" sub={title} value={`${fmt(result)} €`} color={result >= 0 ? 'var(--green)' : 'var(--red)'} icon={TrendingIcon(result)} />
        <KpiCard label="Cash" sub="banks and cash" value={tesoreria != null ? `${fmt(tesoreria)} €` : '—'} icon={<Wallet size={16} />} />
        <KpiCard label={toSettle >= 0 ? 'VAT payable' : 'VAT refundable'} sub="form 303" value={`${fmt(Math.abs(toSettle))} €`} icon={<Receipt size={16} />} />
        <KpiCard label="Net worth" sub="capital + result" value={`${fmt(netWorth)} €`} icon={<Scale size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-[13px] font-semibold mb-3 flex items-center gap-1.5">Profit and loss <Tip k="resultados" /></div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-dim)]">Income</span><Money v={pl?.total_income ?? 0} /></div>
            <div className="flex justify-between"><span className="text-[var(--text-dim)]">Expenses</span><Money v={pl?.total_expense ?? 0} /></div>
            <div className="flex justify-between font-bold pt-2 border-t border-[var(--border)]"><span>Result</span><span className="font-mono" style={{ color: result >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(pl?.result ?? 0)} €</span></div>
          </div>
          <button type="button" onClick={() => onGo('informes')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--mod-finance)] hover:underline">See reports <ArrowRight size={13} /></button>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
          <div className="text-[13px] font-semibold">Quick actions</div>
          <div className="grid grid-cols-2 gap-2">
            <Quick label="New entry" icon={<Plus size={15} />} onClick={() => onGo('contabilidad')} />
            <Quick label="Journal" icon={<BookOpen size={15} />} onClick={() => onGo('contabilidad')} />
            <Quick label="Chart of accounts" icon={<FolderKanban size={15} />} onClick={() => onGo('contabilidad')} />
            <Quick label="Tax forms" icon={<Receipt size={15} />} onClick={() => onGo('informes')} />
          </div>
          {bs && !bs.balanced && <div className="text-xs text-[var(--red)] mt-1">⚠ The balance sheet does not balance — check the entries in the Journal.</div>}
          {bs && bs.balanced && <div className="text-xs text-[var(--green)] mt-1">✓ The books balance.</div>}
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
