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

// Lente CONTABILIDAD (F2): informes contables formales derivados del libro mayor.
// Sub-pestañas: Sumas y saldos (balance de comprobación), Balance de situación,
// Resultados (P&L) y Mayor. Navegación encadenada: clic en una cuenta de las sumas
// y saldos → abre su Libro Mayor.

import { useEffect, useState, type CSSProperties } from 'react';
import { Scale, BookOpen, TrendingUp, Library, Loader2, CalendarRange, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

type SubTab = 'trial' | 'balance' | 'pl' | 'ledger' | 'years';

interface TrialRow { account_id: string; code: string | null; group_code: string | null; name: string; type: string; debit: string; credit: string; balance: string; }
interface TrialBalance { rows: TrialRow[]; total_debit: string; total_credit: string; from: string; to: string; }
interface AmountRow { account_id: string; code: string | null; name: string; amount: string; }
interface ProfitLoss { income: AmountRow[]; expense: AmountRow[]; total_income: string; total_expense: string; result: string; }
interface BalanceSheet { assets: AmountRow[]; liabilities: AmountRow[]; equity: AmountRow[]; result: string; total_assets: string; total_liabilities_equity: string; balanced: boolean; to: string; }
interface LedgerLine { entry_id: string; posting_id: string; date: string; description: string | null; memo: string | null; debit: string | null; credit: string | null; running: string; }
interface Ledger { account: { id: string; code: string | null; name: string; type: string } | null; lines: LedgerLine[]; total_debit: string; total_credit: string; balance: string; }

const fmt = (v: string | number | null | undefined) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
};

const wrap: CSSProperties = { padding: '8px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 };
const card: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' };
const thR: CSSProperties = { ...th, textAlign: 'right' };
const td: CSSProperties = { padding: '7px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' };
const tdR: CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' };
const codeCell: CSSProperties = { ...td, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)', width: 64 };
const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' };

const SUBTABS: { id: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'trial', label: 'Sumas y saldos', icon: Scale },
  { id: 'balance', label: 'Balance de situación', icon: BookOpen },
  { id: 'pl', label: 'Resultados', icon: TrendingUp },
  { id: 'ledger', label: 'Mayor', icon: Library },
  { id: 'years', label: 'Ejercicios', icon: CalendarRange },
];

export function ContabilidadLens() {
  const [sub, setSub] = useState<SubTab>('trial');
  const [trial, setTrial] = useState<TrialBalance | null>(null);
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerAcct, setLedgerAcct] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Carga del informe activo.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (sub === 'trial') setTrial((await api.get<{ data: TrialBalance }>('/finance/reports/trial-balance')).data);
        else if (sub === 'pl') setPl((await api.get<{ data: ProfitLoss }>('/finance/reports/profit-loss')).data);
        else if (sub === 'balance') setBs((await api.get<{ data: BalanceSheet }>('/finance/reports/balance-sheet')).data);
        else if (sub === 'ledger' && ledgerAcct) setLedger((await api.get<{ data: Ledger }>(`/finance/reports/ledger/${ledgerAcct}`)).data);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [sub, ledgerAcct]);

  const openLedger = (accountId: string) => { setLedgerAcct(accountId); setSub('ledger'); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Sub-pestañas (underline) */}
      <div role="tablist" style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
        {SUBTABS.map((t) => {
          const active = t.id === sub;
          const Icon = t.icon;
          return (
            <button key={t.id} role="tab" aria-selected={active} onClick={() => setSub(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--mod-finance)' : 'transparent'}`, color: active ? 'var(--text)' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
        {loading && <Loader2 size={13} style={{ alignSelf: 'center', marginLeft: 8, animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
      </div>

      <div style={wrap}>
        {/* ── Sumas y saldos ── */}
        {sub === 'trial' && trial && (
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Cuenta</th><th style={th}>Nombre</th><th style={thR}>Debe</th><th style={thR}>Haber</th><th style={thR}>Saldo</th></tr></thead>
              <tbody>
                {trial.rows.map((r) => (
                  <tr key={r.account_id} onClick={() => openLedger(r.account_id)} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title="Ver Libro Mayor de esta cuenta">
                    <td style={codeCell}>{r.code ?? '—'}</td>
                    <td style={td}>{r.name}</td>
                    <td style={tdR}>{fmt(r.debit)}</td>
                    <td style={tdR}>{fmt(r.credit)}</td>
                    <td style={{ ...tdR, color: Number(r.balance) < 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ ...td, borderBottom: 'none' }} colSpan={2}>Totales</td>
                  <td style={{ ...tdR, borderBottom: 'none' }}>{fmt(trial.total_debit)}</td>
                  <td style={{ ...tdR, borderBottom: 'none' }}>{fmt(trial.total_credit)}</td>
                  <td style={{ ...tdR, borderBottom: 'none', color: Math.abs(Number(trial.total_debit) - Number(trial.total_credit)) < 0.01 ? 'var(--green)' : 'var(--red)' }}>
                    {Math.abs(Number(trial.total_debit) - Number(trial.total_credit)) < 0.01 ? 'cuadra' : '¡descuadre!'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── Balance de situación ── */}
        {sub === 'balance' && bs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <div style={sectionTitle}>ACTIVO</div>
              <BalTable rows={bs.assets} onPick={openLedger} />
              <div style={{ ...sectionTitle, background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: 'none', display: 'flex', justifyContent: 'space-between' }}>
                <span>Total activo</span><span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmt(bs.total_assets)}</span>
              </div>
            </div>
            <div style={card}>
              <div style={sectionTitle}>PASIVO + PATRIMONIO NETO</div>
              <BalTable rows={bs.liabilities} onPick={openLedger} />
              <BalTable rows={bs.equity} onPick={openLedger} />
              <div style={{ ...td, display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)' }}>
                <span>Resultado del ejercicio (129)</span><span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmt(bs.result)}</span>
              </div>
              <div style={{ ...sectionTitle, background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: 'none', display: 'flex', justifyContent: 'space-between' }}>
                <span>Total pasivo + PN</span><span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmt(bs.total_liabilities_equity)}</span>
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: bs.balanced ? 'var(--green)' : 'var(--red)' }}>
              {bs.balanced ? '✓ El balance cuadra (Activo = Pasivo + Patrimonio + Resultado).' : '¡El balance NO cuadra!'}
            </div>
          </div>
        )}

        {/* ── Resultados (P&L) ── */}
        {sub === 'pl' && pl && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <div style={sectionTitle}>INGRESOS</div>
              <BalTable rows={pl.income} onPick={openLedger} />
              <FootRow label="Total ingresos" value={pl.total_income} />
            </div>
            <div style={card}>
              <div style={sectionTitle}>GASTOS</div>
              <BalTable rows={pl.expense} onPick={openLedger} />
              <FootRow label="Total gastos" value={pl.total_expense} />
            </div>
            <div style={{ gridColumn: '1 / -1', ...card, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
              <span>Resultado ({Number(pl.result) >= 0 ? 'beneficio' : 'pérdida'})</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', color: Number(pl.result) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(pl.result)} €</span>
            </div>
          </div>
        )}

        {/* ── Mayor ── */}
        {sub === 'ledger' && (
          !ledgerAcct ? (
            <div style={{ ...card, padding: 16, color: 'var(--text-dim)', fontSize: 13 }}>
              Elige una cuenta en "Sumas y saldos" para ver su Libro Mayor.
            </div>
          ) : ledger && (
            <div style={card}>
              <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between' }}>
                <span><span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)', marginRight: 8 }}>{ledger.account?.code ?? ''}</span>{ledger.account?.name}</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>Saldo {fmt(ledger.balance)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Fecha</th><th style={th}>Concepto</th><th style={thR}>Debe</th><th style={thR}>Haber</th><th style={thR}>Saldo</th></tr></thead>
                <tbody>
                  {ledger.lines.map((l) => (
                    <tr key={l.posting_id}>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{l.date}</td>
                      <td style={td}>{l.description ?? l.memo ?? '—'}</td>
                      <td style={tdR}>{l.debit != null ? fmt(l.debit) : ''}</td>
                      <td style={tdR}>{l.credit != null ? fmt(l.credit) : ''}</td>
                      <td style={tdR}>{fmt(l.running)}</td>
                    </tr>
                  ))}
                  {ledger.lines.length === 0 && <tr><td style={td} colSpan={5}>Sin movimientos en el periodo.</td></tr>}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Ejercicios (cierre) ── */}
        {sub === 'years' && <YearsPanel />}
      </div>
    </div>
  );
}

interface FiscalYear { id: string; year: number; status: 'open' | 'closed'; closed_at: string | null; }
interface ClosePreview { year: number; status: string; income_total: string; expense_total: string; result: string; }

function YearsPanel() {
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearInput, setYearInput] = useState<string>(String(new Date().getFullYear() - 1));
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => { try { setYears((await api.get<{ data: FiscalYear[] }>('/finance/fiscal-years')).data ?? []); } catch { /* */ } };
  useEffect(() => { void load(); }, []);

  const doPreview = async () => {
    const y = Number(yearInput); if (!Number.isInteger(y)) return;
    setBusy(true);
    try { setPreview((await api.get<{ data: ClosePreview }>(`/finance/fiscal-years/${y}/preview-close`)).data); }
    catch { toast.error('No se pudo previsualizar el cierre'); } finally { setBusy(false); }
  };
  const doClose = async (y: number) => {
    if (!window.confirm(`Cerrar el ejercicio ${y}? Se generarán los asientos de regularización, cierre y apertura, y se bloqueará postear con fecha de ${y}.`)) return;
    setBusy(true);
    try { await api.post(`/finance/fiscal-years/${y}/close`, {}); toast.success(`Ejercicio ${y} cerrado`); setPreview(null); await load(); }
    catch { toast.error('No se pudo cerrar el ejercicio'); } finally { setBusy(false); }
  };
  const doReopen = async (y: number) => {
    if (!window.confirm(`Reabrir el ejercicio ${y}? Se revertirán los asientos de cierre.`)) return;
    setBusy(true);
    try { await api.post(`/finance/fiscal-years/${y}/reopen`, {}); toast.success(`Ejercicio ${y} reabierto`); await load(); }
    catch { toast.error('No se pudo reabrir el ejercicio'); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {/* Cerrar un ejercicio */}
      <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Cerrar ejercicio</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={yearInput} onChange={(e) => setYearInput(e.target.value)} style={{ width: 110, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', color: 'var(--text)', fontSize: 13 }} />
          <button type="button" onClick={() => void doPreview()} disabled={busy}
            style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm, 4px)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: busy ? 'default' : 'pointer' }}>
            {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Vista previa'}
          </button>
        </div>
        {preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Ingresos</span><span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmt(preview.income_total)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Gastos</span><span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmt(preview.expense_total)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Resultado ({Number(preview.result) >= 0 ? 'beneficio' : 'pérdida'})</span><span style={{ fontFamily: 'var(--font-mono, monospace)', color: Number(preview.result) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(preview.result)} €</span></div>
            {preview.status === 'closed'
              ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Este ejercicio ya está cerrado.</div>
              : <button type="button" onClick={() => void doClose(preview.year)} disabled={busy}
                  style={{ alignSelf: 'flex-start', marginTop: 4, padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm, 4px)', border: 'none', background: 'var(--mod-finance)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={14} /> Cerrar ejercicio {preview.year}
                </button>}
          </div>
        )}
      </div>

      {/* Lista de ejercicios */}
      <div style={card}>
        <div style={sectionTitle}>EJERCICIOS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Año</th><th style={th}>Estado</th><th style={{ ...th, textAlign: 'right' }}>Acciones</th></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.id}>
                <td style={{ ...td, fontFamily: 'var(--font-mono, monospace)' }}>{y.year}</td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: y.status === 'closed' ? 'var(--amber)' : 'var(--green)' }}>
                    {y.status === 'closed' ? <><Lock size={12} /> Cerrado</> : <><Unlock size={12} /> Abierto</>}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {y.status === 'closed' && <button type="button" onClick={() => void doReopen(y.year)} disabled={busy}
                    style={{ padding: '4px 12px', fontSize: 12, borderRadius: 'var(--radius-sm, 4px)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>Reabrir</button>}
                </td>
              </tr>
            ))}
            {years.length === 0 && <tr><td style={td} colSpan={3}>Aún no hay ejercicios cerrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BalTable({ rows, onPick }: { rows: AmountRow[]; onPick: (id: string) => void }) {
  if (!rows.length) return null;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.account_id} onClick={() => onPick(r.account_id)} style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Ver Libro Mayor">
            <td style={codeCell}>{r.code ?? '—'}</td>
            <td style={td}>{r.name}</td>
            <td style={tdR}>{fmt(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FootRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...sectionTitle, background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: 'none', display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span><span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmt(value)}</span>
    </div>
  );
}
