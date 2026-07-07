/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Área CONTABILIDAD (el día a día del libro): Libro Diario (asientos) · Libro Mayor
// (por cuenta) · Plan de cuentas (PGC, gestionable) · Conciliación bancaria.
// Incluye crear asiento manual con cuadre en vivo, ver un asiento y su contra-asiento.

import { useEffect, useState } from 'react';
import { BookText, Library, ListTree, Landmark, Plus, ArrowLeftRight, FileText, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs } from '@/components/shared/Tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/services/api';
import { useFinancePeriod } from '../period';
import { todayISO } from '../personal/lib';
import { ConciliacionPanel } from './ConciliacionPanel';
import { ReportTable, Money, fmt, Tip, AccountSelect, useAccounts, useStandardPlan, StandardAccountPicker, PGC_GROUPS, ACCOUNT_TYPE_LABEL, type Account } from './shared';
import type { DataColumn } from '@/components/ui/data-table';

interface Posting { id: string; account_id: string; account_code: string | null; account_name: string; debit: string | null; credit: string | null; memo: string | null; project_id: string | null; contact_id: string | null; }
export interface JournalEntry { id: string; date: string; description: string | null; source: string; document_id: string | null; document_number: string | null; reverses_entry_id: string | null; reversed_by_entry_id: string | null; total_debit: string; total_credit: string; postings: Posting[]; }
interface Ledger { account: { id: string; code: string | null; name: string; type: string } | null; lines: { entry_id: string; posting_id: string; date: string; description: string | null; memo: string | null; debit: string | null; credit: string | null; running: string }[]; total_debit: string; total_credit: string; balance: string; }

const SOURCE_LABEL: Record<string, string> = { manual: 'Manual', document: 'Factura', recurring: 'Recurrente', reversal: 'Contra-asiento', closing: 'Cierre', opening: 'Apertura', import: 'Importado', rule: 'Regla' };
const SUBS = [
  { id: 'diario', label: 'Libro Diario', icon: BookText },
  { id: 'mayor', label: 'Libro Mayor', icon: Library },
  { id: 'plan', label: 'Plan de cuentas', icon: ListTree },
  { id: 'reconcile', label: 'Conciliación', icon: Landmark },
];

export function LibroArea({ initialLedgerAccountId, onOpenDocument, onOpenContact }: { initialLedgerAccountId?: string | null; onOpenDocument: (docId: string) => void; onOpenContact: (contactId: string) => void }) {
  const [sub, setSub] = useState<string>(initialLedgerAccountId ? 'mayor' : 'diario');
  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={SUBS} activeTab={sub} onChange={setSub} variant="pills" />
      {sub === 'diario' && <DiarioTab onOpenDocument={onOpenDocument} onOpenContact={onOpenContact} />}
      {sub === 'mayor' && <MayorTab initialAccountId={initialLedgerAccountId ?? undefined} onOpenDocument={onOpenDocument} onOpenContact={onOpenContact} />}
      {sub === 'plan' && <PlanCuentasTab />}
      {sub === 'reconcile' && <ConciliacionPanel />}
    </div>
  );
}

// ─── Libro Diario ────────────────────────────────────────────────────────────
function DiarioTab({ onOpenDocument, onOpenContact }: { onOpenDocument: (docId: string) => void; onOpenContact: (contactId: string) => void }) {
  const { range } = useFinancePeriod();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<JournalEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setEntries((await api.get<{ data: JournalEntry[] }>(`/finance/journal-entries?from=${range.from}&to=${range.to}&limit=500`)).data ?? []); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [range.from, range.to]);

  const cols: DataColumn<JournalEntry>[] = [
    { key: 'date', header: 'Fecha', sortable: true, width: '110px', render: (e) => <span className="text-[var(--text-dim)] whitespace-nowrap">{e.date}</span> },
    { key: 'description', header: 'Concepto', sortable: true, render: (e) => <span>{e.description ?? (e.postings.map((p) => p.account_name).slice(0, 2).join(' · ') || '—')}</span> },
    { key: 'source', header: 'Origen', sortable: true, width: '110px', render: (e) => <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-dim)]">{SOURCE_LABEL[e.source] ?? e.source}</span> },
    { key: 'doc', header: 'Documento', width: '110px', render: (e) => e.document_number ? <span className="font-mono text-xs text-[var(--text-dim)]">{e.document_number}</span> : '—' },
    { key: 'total_debit', header: 'Importe', align: 'right', sortable: true, sortValue: (e) => Number(e.total_debit), render: (e) => <Money v={e.total_debit} /> },
  ];

  return (
    <>
      <ReportTable
        title={<>Libro Diario <span className="text-[var(--text-dim)] font-normal">(asientos)</span></>}
        tip="diario"
        columns={cols} rows={entries} getRowKey={(e) => e.id} loading={loading}
        onRowClick={(e) => setDetail(e)} initialSort={{ key: 'date', dir: 'desc' }}
        search={(e) => `${e.date} ${e.description ?? ''} ${e.document_number ?? ''} ${e.postings.map((p) => p.account_name).join(' ')}`}
        searchPlaceholder="Buscar asiento…"
        empty="Sin asientos en el periodo."
        right={<button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white hover:opacity-90"><Plus size={14} /> Nuevo asiento</button>}
        exportName="libro-diario" exportHeaders={['Fecha', 'Concepto', 'Origen', 'Documento', 'Debe', 'Haber']}
        exportRow={(e) => [e.date, e.description ?? '', SOURCE_LABEL[e.source] ?? e.source, e.document_number ?? '', e.total_debit, e.total_credit]}
        serverReport="journal"
      />
      {detail && <AsientoDetalle entry={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); void reload(); }} onOpenDocument={onOpenDocument} onOpenContact={onOpenContact} />}
      {creating && <NuevoAsientoDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void reload(); }} />}
    </>
  );
}

// ─── Detalle de un asiento ───────────────────────────────────────────────────
// Exportado: ContabilidadLens lo abre también por deep-link (?entry=<id>, chips del chat).
export function AsientoDetalle({ entry, onClose, onChanged, onOpenDocument, onOpenContact }: { entry: JournalEntry; onClose: () => void; onChanged: () => void; onOpenDocument: (docId: string) => void; onOpenContact: (contactId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const cuadra = Math.abs(Number(entry.total_debit) - Number(entry.total_credit)) < 0.01;
  // Cierra la cadena → Contacto: primer posting con contacto (la pata AR/AP de cliente/proveedor).
  const contactId = entry.postings.find((p) => p.contact_id)?.contact_id ?? null;
  const reverse = async () => {
    if (!window.confirm('¿Crear el contra-asiento que anula este asiento? Es la forma correcta de corregir (no se borra el original).')) return;
    setBusy(true);
    try { await api.post(`/finance/journal-entries/${entry.id}/reverse`, {}); toast.success('Contra-asiento creado'); onChanged(); }
    catch { toast.error('No se pudo crear el contra-asiento'); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">Asiento <Tip k="asiento" /> <span className="text-[var(--text-dim)] font-normal text-sm">· {entry.date} · {SOURCE_LABEL[entry.source] ?? entry.source}</span></DialogTitle>
        </DialogHeader>
        <div className="text-sm text-[var(--text)]">{entry.description ?? '—'}</div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="text-[var(--text-dim)] bg-[var(--surface)]"><th className="text-left font-medium px-3 py-1.5">Cuenta</th><th className="text-right font-medium px-3 py-1.5">Debe</th><th className="text-right font-medium px-3 py-1.5">Haber</th></tr></thead>
            <tbody>
              {entry.postings.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5"><span className="font-mono text-[var(--text-dim)] mr-2">{p.account_code ?? ''}</span>{p.account_name}{p.memo && <span className="text-[var(--text-dim)]"> · {p.memo}</span>}</td>
                  <td className="px-3 py-1.5 text-right">{p.debit != null ? <Money v={p.debit} /> : ''}</td>
                  <td className="px-3 py-1.5 text-right">{p.credit != null ? <Money v={p.credit} /> : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-[var(--border)] font-semibold bg-[var(--surface)]"><td className="px-3 py-1.5">Totales · {cuadra ? <span className="text-[var(--green)]">cuadra ✓</span> : <span className="text-[var(--red)]">¡descuadre!</span>}</td><td className="px-3 py-1.5 text-right"><Money v={entry.total_debit} /></td><td className="px-3 py-1.5 text-right"><Money v={entry.total_credit} /></td></tr></tfoot>
          </table>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {entry.document_id && <button type="button" onClick={() => { onOpenDocument(entry.document_id!); onClose(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface)]"><FileText size={13} /> Ver factura {entry.document_number ?? ''}</button>}
            {contactId && <button type="button" onClick={() => { onOpenContact(contactId); onClose(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface)]"><Users size={13} /> Ver contacto</button>}
            {entry.reversed_by_entry_id ? <span className="text-xs text-[var(--amber)] self-center">Ya tiene contra-asiento</span>
              : entry.source !== 'reversal' && <button type="button" disabled={busy} onClick={() => void reverse()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface)]"><ArrowLeftRight size={13} /> Contra-asiento</button>}
          </div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] bg-[var(--surface)] text-[var(--text)]">Cerrar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Crear asiento manual (N líneas con cuadre en vivo) ──────────────────────
interface DraftLine { accountId: string; debit: string; credit: string; memo: string; }
const emptyLine = (): DraftLine => ({ accountId: '', debit: '', credit: '', memo: '' });

function NuevoAsientoDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { accounts } = useAccounts(true);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [busy, setBusy] = useState(false);

  const num = (s: string) => { const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const sumD = lines.reduce((s, l) => s + num(l.debit), 0);
  const sumC = lines.reduce((s, l) => s + num(l.credit), 0);
  const diff = Math.round((sumD - sumC) * 100) / 100;
  const validLines = lines.filter((l) => l.accountId && (num(l.debit) > 0 || num(l.credit) > 0));
  const canSave = validLines.length >= 2 && Math.abs(diff) < 0.005 && sumD > 0;

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, ...patch } : l));
  const save = async () => {
    setBusy(true);
    try {
      const postings = validLines.map((l) => ({ account_id: l.accountId, ...(num(l.debit) > 0 ? { debit: num(l.debit) } : { credit: num(l.credit) }), memo: l.memo || null }));
      await api.post('/finance/journal-entries', { date, description: description || null, postings });
      toast.success('Asiento creado'); onCreated();
    } catch (e: unknown) {
      const code = (e as { code?: string; error?: { code?: string } })?.error?.code ?? (e as { code?: string })?.code;
      toast.error(code === 'PERIOD_CLOSED' ? 'El ejercicio de esa fecha está cerrado' : code === 'UNBALANCED' ? 'El asiento no cuadra' : 'No se pudo crear el asiento');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-base">Nuevo asiento manual <Tip k="cuadre" /></DialogTitle></DialogHeader>
        <div className="flex gap-3 flex-wrap">
          <label className="text-xs text-[var(--text-dim)] flex flex-col gap-1">Fecha
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]" style={{ colorScheme: 'dark' }} /></label>
          <label className="text-xs text-[var(--text-dim)] flex flex-col gap-1 flex-1">Concepto
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción del asiento" className="px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]" /></label>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] overflow-visible">
          <table className="w-full text-[13px]">
            <thead><tr className="text-[var(--text-dim)] bg-[var(--surface)]"><th className="text-left font-medium px-2 py-1.5 w-[40%]">Cuenta</th><th className="text-right font-medium px-2 py-1.5">Debe</th><th className="text-right font-medium px-2 py-1.5">Haber</th><th className="text-left font-medium px-2 py-1.5">Concepto</th><th className="w-8" /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-2 py-1.5"><AccountSelect accounts={accounts} value={l.accountId} onChange={(id) => setLine(i, { accountId: id })} postableOnly /></td>
                  <td className="px-2 py-1.5"><input inputMode="decimal" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} className="w-24 px-2 py-1.5 text-sm text-right rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono" placeholder="0,00" /></td>
                  <td className="px-2 py-1.5"><input inputMode="decimal" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} className="w-24 px-2 py-1.5 text-sm text-right rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono" placeholder="0,00" /></td>
                  <td className="px-2 py-1.5"><input value={l.memo} onChange={(e) => setLine(i, { memo: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]" placeholder="(opcional)" /></td>
                  <td className="px-1 text-center">{lines.length > 2 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-[var(--text-dim)] hover:text-[var(--red)]"><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border)] font-semibold bg-[var(--surface)]">
                <td className="px-2 py-1.5"><button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])} className="inline-flex items-center gap-1 text-xs text-[var(--mod-finance)] hover:underline"><Plus size={13} /> Añadir línea</button></td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt(sumD)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt(sumC)}</td>
                <td className="px-2 py-1.5 text-xs" colSpan={2} style={{ color: Math.abs(diff) < 0.005 ? 'var(--green)' : 'var(--red)' }}>{Math.abs(diff) < 0.005 ? 'cuadra ✓' : `descuadre ${fmt(diff)}`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] bg-[var(--surface)] text-[var(--text)]">Cancelar</button>
          <button type="button" disabled={!canSave || busy} onClick={() => void save()} className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none text-white disabled:opacity-50" style={{ background: !canSave || busy ? 'var(--surface)' : 'var(--mod-finance)', color: !canSave || busy ? 'var(--text-dim)' : '#fff' }}>{busy ? 'Guardando…' : 'Guardar asiento'}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Libro Mayor ─────────────────────────────────────────────────────────────
function MayorTab({ initialAccountId, onOpenDocument, onOpenContact }: { initialAccountId?: string; onOpenDocument: (docId: string) => void; onOpenContact: (contactId: string) => void }) {
  const { range } = useFinancePeriod();
  const { accounts } = useAccounts(true);
  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<JournalEntry | null>(null);

  useEffect(() => {
    if (!accountId) { setLedger(null); return; }
    let alive = true; setLoading(true);
    api.get<{ data: Ledger }>(`/finance/reports/ledger/${accountId}?from=${range.from}&to=${range.to}`)
      .then((r) => { if (alive) setLedger(r.data); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accountId, range.from, range.to]);

  // Mayor → Asiento: clic en un movimiento abre el asiento completo (lo trae por id).
  const openAsiento = async (entryId: string) => {
    try { setDetail((await api.get<{ data: JournalEntry }>(`/finance/journal-entries/${entryId}`)).data); }
    catch { toast.error('No se pudo abrir el asiento'); }
  };

  const cols: DataColumn<Ledger['lines'][number]>[] = [
    { key: 'date', header: 'Fecha', sortable: true, width: '110px', render: (l) => <span className="text-[var(--text-dim)] whitespace-nowrap">{l.date}</span> },
    { key: 'description', header: 'Concepto', render: (l) => <span>{l.description ?? l.memo ?? '—'}</span> },
    { key: 'debit', header: 'Debe', align: 'right', render: (l) => l.debit != null ? <Money v={l.debit} /> : '' },
    { key: 'credit', header: 'Haber', align: 'right', render: (l) => l.credit != null ? <Money v={l.credit} /> : '' },
    { key: 'running', header: 'Saldo', align: 'right', render: (l) => <Money v={l.running} color /> },
  ];

  return (
    <>
      <ReportTable
        title={<>Libro Mayor <span className="text-[var(--text-dim)] font-normal">{ledger?.account ? `· ${ledger.account.code ?? ''} ${ledger.account.name}` : ''}</span></>}
        tip="mayor"
        columns={cols} rows={ledger?.lines ?? []} getRowKey={(l) => l.posting_id} loading={loading}
        onRowClick={(l) => void openAsiento(l.entry_id)}
        empty={accountId ? 'Sin movimientos en el periodo.' : 'Elige una cuenta para ver su Libro Mayor.'}
        right={<div className="w-64"><AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} placeholder="Elige una cuenta…" /></div>}
        exportName="libro-mayor" exportHeaders={['Fecha', 'Concepto', 'Debe', 'Haber', 'Saldo']}
        exportRow={(l) => [l.date, l.description ?? l.memo ?? '', l.debit ?? '', l.credit ?? '', l.running]}
        serverReport={accountId ? 'ledger' : undefined} serverExtra={{ accountId }}
        footer={ledger?.account && <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--border)] text-[13px] font-semibold"><span>Saldo de la cuenta</span><Money v={ledger.balance} color /></div>}
      />
      {detail && <AsientoDetalle entry={detail} onClose={() => setDetail(null)} onChanged={() => setDetail(null)} onOpenDocument={onOpenDocument} onOpenContact={onOpenContact} />}
    </>
  );
}

// ─── Plan de cuentas (PGC, gestionable) ──────────────────────────────────────
function PlanCuentasTab() {
  const { accounts, loading, reload } = useAccounts(true);
  const [edit, setEdit] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const cols: DataColumn<Account>[] = [
    { key: 'code', header: 'Código', sortable: true, width: '90px', render: (a) => <span className="font-mono text-[var(--text-dim)]">{a.code ?? '—'}</span> },
    { key: 'name', header: 'Nombre', sortable: true, render: (a) => <span>{a.name}{!a.is_postable && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--text-dim)] border border-[var(--border)] rounded px-1">agrupadora</span>}</span> },
    { key: 'group_code', header: 'Grupo', sortable: true, width: '180px', render: (a) => <span className="text-xs text-[var(--text-dim)]">{a.group_code ? PGC_GROUPS[a.group_code]?.replace(/^Grupo \d · /, `${a.group_code} · `) ?? a.group_code : '—'}</span> },
    { key: 'type', header: 'Tipo', sortable: true, width: '100px', render: (a) => <span className="text-xs">{ACCOUNT_TYPE_LABEL[a.type] ?? a.type}</span> },
    { key: 'balance', header: 'Saldo', align: 'right', sortable: true, sortValue: (a) => Number(a.balance ?? 0), render: (a) => <Money v={a.balance ?? '0'} color /> },
  ];

  const loadStandard = async () => {
    if (!window.confirm('¿Cargar el plan contable estándar (PGC PYMES de España)? Añade las cuentas que falten; no toca las existentes.')) return;
    setLoadingPlan(true);
    try { const r = (await api.post<{ data: { created: number } }>('/finance/accounts/load-standard-plan', {})).data; toast.success(`Plan cargado · ${r.created} cuentas nuevas`); await reload(); }
    catch { toast.error('No se pudo cargar el plan'); } finally { setLoadingPlan(false); }
  };

  return (
    <>
      <ReportTable
        title={<>Plan de cuentas <span className="text-[var(--text-dim)] font-normal">(PGC)</span></>}
        tip="postable"
        columns={cols} rows={accounts} getRowKey={(a) => a.id} loading={loading} onRowClick={(a) => setEdit(a)}
        initialSort={{ key: 'code', dir: 'asc' }} search={(a) => `${a.code ?? ''} ${a.name}`} searchPlaceholder="Buscar cuenta…"
        right={<div className="flex gap-2">
          <button type="button" disabled={loadingPlan} onClick={() => void loadStandard()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface)]"><ListTree size={14} /> Cargar plan estándar</button>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white"><Plus size={14} /> Nueva cuenta</button>
        </div>}
        exportName="plan-de-cuentas" exportHeaders={['Codigo', 'Nombre', 'Grupo', 'Tipo', 'Postable', 'Saldo']}
        exportRow={(a) => [a.code ?? '', a.name, a.group_code ?? '', ACCOUNT_TYPE_LABEL[a.type] ?? a.type, a.is_postable ? 'Si' : 'No', a.balance ?? '0']}
        serverReport="accounts"
      />
      {(edit || creating) && <CuentaContableDialog account={edit} accounts={accounts} onClose={() => { setEdit(null); setCreating(false); }} onSaved={() => { setEdit(null); setCreating(false); void reload(); }} />}
    </>
  );
}

// ─── Diálogo de cuenta COMPLETO (paridad UI↔datos) ───────────────────────────
const TYPES: { id: string; label: string }[] = [
  { id: 'asset', label: 'Activo' }, { id: 'liability', label: 'Pasivo' }, { id: 'equity', label: 'Patrimonio' }, { id: 'income', label: 'Ingreso' }, { id: 'expense', label: 'Gasto' },
];
function CuentaContableDialog({ account, accounts, onClose, onSaved }: { account: Account | null; accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const editing = !!account;
  const [name, setName] = useState(account?.name ?? '');
  const [code, setCode] = useState(account?.code ?? '');
  const [type, setType] = useState(account?.type ?? 'asset');
  const [subtype, setSubtype] = useState(account?.subtype ?? '');
  const [currency, setCurrency] = useState(account?.currency ?? 'EUR');
  const [isPostable, setIsPostable] = useState(account?.is_postable ?? true);
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [parentId, setParentId] = useState(account?.parent_account_id ?? '');
  const [iban, setIban] = useState((account?.external_ref as { iban?: string } | null)?.iban ?? '');
  const [busy, setBusy] = useState(false);
  const plan = useStandardPlan();
  const groupCode = code ? code.slice(0, 1) : '';

  const save = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setBusy(true);
    const body = {
      name: name.trim(), type, subtype: subtype || null, currency, code: code || null, is_postable: isPostable, is_active: isActive,
      parent_account_id: parentId || null, external_ref: iban ? { iban } : null,
    };
    try {
      if (editing) await api.patch(`/finance/accounts/${account!.id}`, body);
      else await api.post('/finance/accounts', body);
      toast.success(editing ? 'Cuenta actualizada' : 'Cuenta creada'); onSaved();
    } catch { toast.error('No se pudo guardar la cuenta'); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!account || !window.confirm('¿Eliminar esta cuenta? (se oculta, no se borra del histórico)')) return;
    setBusy(true);
    try { await api.delete(`/finance/accounts/${account.id}`); toast.success('Cuenta eliminada'); onSaved(); }
    catch { toast.error('No se pudo eliminar'); } finally { setBusy(false); }
  };

  const fld = 'px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] w-full';
  const lab = 'text-xs text-[var(--text-dim)] flex flex-col gap-1';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-base">{editing ? 'Editar cuenta' : 'Nueva cuenta contable'}</DialogTitle></DialogHeader>
        {!editing && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-1.5">
            <div className="text-xs font-semibold text-[var(--text)]">Partir de una cuenta del plan estándar <span className="font-normal text-[var(--text-dim)]">(opcional)</span></div>
            <StandardAccountPicker plan={plan} onPick={(a) => { setName(a.name); setCode(a.code); setType(a.type); setIsPostable(a.is_postable); }} />
            <div className="text-[11px] text-[var(--text-dim)]">Elige una de las ~80 cuentas del PGC para rellenar los campos, o créala desde cero abajo. No hace falta tenerlas todas: solo creas las que uses.</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className={`${lab} col-span-2`}>Nombre<input value={name} onChange={(e) => setName(e.target.value)} className={fld} placeholder="Ej. Banco principal" /></label>
          <label className={lab}>Código PGC<input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} className={`${fld} font-mono`} placeholder="572" /></label>
          <label className={lab}>Grupo<input value={groupCode ? `${groupCode} · ${PGC_GROUPS[groupCode]?.replace(/^Grupo \d · /, '') ?? ''}` : ''} disabled className={`${fld} opacity-60`} placeholder="(se deriva del código)" /></label>
          <label className={lab}>Tipo<select value={type} onChange={(e) => setType(e.target.value)} className={fld}>{TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className={lab}>Subtipo<input value={subtype} onChange={(e) => setSubtype(e.target.value)} className={fld} placeholder="bank, cash, receivable…" /></label>
          <label className={lab}>Moneda<input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} className={`${fld} font-mono`} /></label>
          <label className={lab}>IBAN / referencia<input value={iban} onChange={(e) => setIban(e.target.value)} className={`${fld} font-mono`} placeholder="ES.." /></label>
          <label className={`${lab} col-span-2`}>Cuenta padre (jerarquía)
            <AccountSelect accounts={accounts.filter((a) => a.id !== account?.id)} value={parentId} onChange={setParentId} placeholder="(sin cuenta padre)" /></label>
          <label className="flex items-center gap-2 text-sm text-[var(--text)] col-span-2"><input type="checkbox" checked={isPostable} onChange={(e) => setIsPostable(e.target.checked)} /> Admite apuntes directos (postable) <Tip k="postable" /></label>
          <label className="flex items-center gap-2 text-sm text-[var(--text)] col-span-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Activa</label>
        </div>
        <DialogFooter className="sm:justify-between">
          {editing ? <button type="button" disabled={busy} onClick={() => void del()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] text-[var(--red)] hover:bg-[var(--surface)]"><Trash2 size={13} /> Eliminar</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] bg-[var(--surface)] text-[var(--text)]">Cancelar</button>
            <button type="button" disabled={busy} onClick={() => void save()} className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
