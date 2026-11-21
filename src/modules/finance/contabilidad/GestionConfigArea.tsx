/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Áreas GESTIÓN (Proyectos · Ejercicios) y CONFIGURACIÓN (Reglas contables ·
// País y plan contable · Series de numeración).

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { FolderKanban, CalendarRange, SlidersHorizontal, Globe, Hash, Lock, Unlock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs } from '@/components/shared/Tabs';
import { api } from '@/services/api';
import { useFinancePeriod } from '../period';
import { ReportTable, Money, fmt, Tip } from './shared';
import { ImportWizard } from '../ImportWizard';
import type { DataColumn } from '@/components/ui/data-table';

// ════════════ GESTIÓN ════════════
export function GestionArea() {
  const { t } = useI18n();
  const [sub, setSub] = useState('proyectos');
  const subs = [{ id: 'proyectos', label: t('finance.accounting.projects'), icon: FolderKanban }, { id: 'ejercicios', label: t('finance.accounting.financialYears'), icon: CalendarRange }];
  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={subs} activeTab={sub} onChange={setSub} variant="pills" />
      {sub === 'proyectos' && <ProyectosTab />}
      {sub === 'ejercicios' && <EjerciciosTab />}
    </div>
  );
}

interface ProjectRow { project_id: string; title: string | null; income: string; expense: string; result: string; }
function ProyectosTab() {
  const { t } = useI18n();
  const { range } = useFinancePeriod();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { let a = true; setLoading(true); api.get<{ data: ProjectRow[] }>(`/finance/reports/projects?from=${range.from}&to=${range.to}`).then((r) => { if (a) setRows(r.data ?? []); }).finally(() => { if (a) setLoading(false); }); return () => { a = false; }; }, [range.from, range.to]);
  const cols: DataColumn<ProjectRow>[] = [
    { key: 'title', header: t('finance.accounting.project'), sortable: true, render: (r) => r.title ?? t('finance.accounting.unnamed') },
    { key: 'income', header: t('finance.accounting.income'), align: 'right', sortable: true, sortValue: (r) => Number(r.income), render: (r) => <Money v={r.income} /> },
    { key: 'expense', header: t('finance.accounting.expensesCost'), align: 'right', sortable: true, sortValue: (r) => Number(r.expense), render: (r) => <Money v={r.expense} /> },
    { key: 'result', header: t('finance.accounting.result'), align: 'right', sortable: true, sortValue: (r) => Number(r.result), render: (r) => <Money v={r.result} color /> },
  ];
  return <ReportTable title={t('finance.accounting.profitabilityByProject')} columns={cols} rows={rows} getRowKey={(r) => r.project_id} loading={loading}
    empty={t('finance.accounting.noProjectMoves')}
    search={(r) => r.title ?? ''} initialSort={{ key: 'result', dir: 'desc' }}
    exportName="rentabilidad-proyectos" exportHeaders={['Project', 'Income', 'Expenses', 'Result']} exportRow={(r) => [r.title ?? '', r.income, r.expense, r.result]} />;
}

interface FiscalYear { id: string; year: number; status: 'open' | 'closed'; closed_at: string | null; }
interface ClosePreview { year: number; status: string; income_total: string; expense_total: string; result: string; }
function EjerciciosTab() {
  const { t } = useI18n();
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear() - 1));
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setYears((await api.get<{ data: FiscalYear[] }>('/finance/fiscal-years')).data ?? []); } catch { /* */ } };
  useEffect(() => { void load(); }, []);
  const doPreview = async () => { const y = Number(yearInput); if (!Number.isInteger(y)) return; setBusy(true); try { setPreview((await api.get<{ data: ClosePreview }>(`/finance/fiscal-years/${y}/preview-close`)).data); } catch { toast.error(t('finance.accounting.previewCloseFailed')); } finally { setBusy(false); } };
  const doClose = async (y: number) => { if (!window.confirm(t('finance.accounting.confirmCloseYear', { year: y }))) return; setBusy(true); try { await api.post(`/finance/fiscal-years/${y}/close`, {}); toast.success(t('finance.accounting.closedYearToast', { year: y })); setPreview(null); await load(); } catch { toast.error(t('finance.accounting.closeYearFailed')); } finally { setBusy(false); } };
  const doReopen = async (y: number) => { if (!window.confirm(t('finance.accounting.confirmReopenYear', { year: y }))) return; setBusy(true); try { await api.post(`/finance/fiscal-years/${y}/reopen`, {}); toast.success(t('finance.accounting.reopenedYearToast', { year: y })); await load(); } catch { toast.error(t('finance.accounting.reopenYearFailed')); } finally { setBusy(false); } };
  const card = 'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]';
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="text-[13px] font-semibold flex items-center gap-1.5">{t('finance.accounting.fiscalYearClose')} <Tip k="regularizacion" /></div>
        <div className="flex items-center gap-2">
          <input type="number" value={yearInput} onChange={(e) => setYearInput(e.target.value)} className="w-28 px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]" />
          <button type="button" disabled={busy} onClick={() => void doPreview()} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">{busy ? <Loader2 size={13} className="animate-spin" /> : t('finance.accounting.preview')}</button>
        </div>
        {preview && (
          <div className="flex flex-col gap-1.5 text-sm">
            <Row label="Income" v={preview.income_total} /><Row label="Expenses" v={preview.expense_total} />
            <div className="flex justify-between font-bold"><span>{t('finance.accounting.result')} ({Number(preview.result) >= 0 ? t('finance.accounting.benefit') : t('finance.accounting.loss')})</span><span className="font-mono" style={{ color: Number(preview.result) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(preview.result)} €</span></div>
            {preview.status === 'closed' ? <span className="text-xs text-[var(--text-dim)]">{t('finance.accounting.yearAlreadyClosed')}</span>
              : <button type="button" disabled={busy} onClick={() => void doClose(preview.year)} className="self-start mt-1 inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white"><Lock size={13} /> {t('finance.accounting.closeYear', { year: preview.year })}</button>}
          </div>
        )}
      </div>
      <div className={card + ' overflow-hidden'}>
        <div className="px-3 py-2.5 text-[13px] font-semibold bg-[var(--surface)] border-b border-[var(--border)]">{t('finance.accounting.financialYears')}</div>
        <table className="w-full text-[13px]">
          <thead><tr className="text-[var(--text-dim)]"><th className="text-left font-medium px-3 py-1.5">{t('finance.accounting.year')}</th><th className="text-left font-medium px-3 py-1.5">{t('finance.accounting.status')}</th><th className="text-right font-medium px-3 py-1.5">{t('finance.accounting.actions')}</th></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5 font-mono">{y.year}</td>
                <td className="px-3 py-1.5"><span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: y.status === 'closed' ? 'var(--amber)' : 'var(--green)' }}>{y.status === 'closed' ? <><Lock size={12} /> {t('finance.accounting.closed')}</> : <><Unlock size={12} /> {t('finance.accounting.open')}</>}</span></td>
                <td className="px-3 py-1.5 text-right">{y.status === 'closed' && <button type="button" disabled={busy} onClick={() => void doReopen(y.year)} className="px-3 py-1 text-xs rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">{t('finance.accounting.reopen')}</button>}</td>
              </tr>
            ))}
            {years.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-[var(--text-dim)]">{t('finance.accounting.noClosedYears')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Row({ label, v }: { label: string; v: string }) { return <div className="flex justify-between"><span className="text-[var(--text-dim)]">{label}</span><span className="font-mono">{fmt(v)}</span></div>; }

// ════════════ CONFIGURACIÓN ════════════
export function ConfiguracionArea() {
  const { t } = useI18n();
  const [sub, setSub] = useState('reglas');
  const subs = [{ id: 'reglas', label: t('finance.accounting.accountingRules'), icon: SlidersHorizontal }, { id: 'pais', label: t('finance.accounting.countryAndChart'), icon: Globe }, { id: 'series', label: t('finance.accounting.series'), icon: Hash }];
  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={subs} activeTab={sub} onChange={setSub} variant="pills" />
      {sub === 'reglas' && <ReglasContablesPanel />}
      {sub === 'pais' && <PaisPlanPanel />}
      {sub === 'series' && <SeriesPanel />}
    </div>
  );
}

interface RoleRow { role: string; label: string; override_account_id: string | null; effective: { id: string; code: string | null; name: string } | null; }
interface AccountOpt { id: string; code: string | null; name: string; type: string; }
function ReglasContablesPanel() {
  const { t } = useI18n();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = async () => { const r = (await api.get<{ data: { roles: RoleRow[]; accounts: AccountOpt[] } }>('/finance/account-map')).data; setRoles(r.roles ?? []); setAccounts(r.accounts ?? []); setDraft(Object.fromEntries((r.roles ?? []).map((x) => [x.role, x.override_account_id ?? '']))); setLoaded(true); };
  useEffect(() => { void load().catch(() => setLoaded(true)); }, []);
  const dirty = roles.some((r) => (draft[r.role] ?? '') !== (r.override_account_id ?? ''));
  const save = async () => { setSaving(true); try { await api.put('/finance/account-map', { account_map: draft }); toast.success(t('finance.accounting.rulesSaved')); await load(); } catch { toast.error(t('finance.accounting.saveRulesFailed')); } finally { setSaving(false); } };
  if (!loaded) return <Loading />;
  const fld = 'w-full max-w-sm px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]';
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] max-w-3xl overflow-hidden">
      <div className="px-3 py-2.5 text-[13px] font-semibold bg-[var(--surface)] border-b border-[var(--border)]">{t('finance.accounting.postingRulesTitle')}</div>
      <p className="px-3 py-2 text-xs text-[var(--text-dim)] border-b border-[var(--border)]">{t('finance.accounting.postingRulesHelp')}</p>
      <table className="w-full text-[13px]">
        <tbody>
          {roles.map((r) => (
            <tr key={r.role} className="border-b border-[var(--border)]">
              <td className="px-3 py-2 text-[var(--text)]">{r.label}</td>
              <td className="px-3 py-2"><select value={draft[r.role] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [r.role]: e.target.value }))} className={fld}><option value="">{t('finance.accounting.defaultAccount', { code: r.effective?.code ?? '—' })}</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>)}</select></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3"><button type="button" onClick={() => void save()} disabled={!dirty || saving} className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none text-white disabled:opacity-50" style={{ background: !dirty || saving ? 'var(--surface)' : 'var(--mod-finance)', color: !dirty || saving ? 'var(--text-dim)' : '#fff' }}>{saving ? t('finance.saving') : t('finance.save')}</button></div>
    </div>
  );
}

interface CountryPack { code: string; name: string; currency: string; tax_id_label: string; fiscal_models: string[]; tax_rates: { name: string; rate: number; tax_type: string }[]; }
function PaisPlanPanel() {
  const { t } = useI18n();
  const [pack, setPack] = useState<CountryPack | null>(null);
  const [busy, setBusy] = useState('');
  const [importing, setImporting] = useState(false);
  const load = async () => { try { setPack((await api.get<{ data: CountryPack }>('/finance/country-pack')).data); } catch { /* */ } };
  useEffect(() => { void load(); }, []);
  const loadPlan = async () => { setBusy('plan'); try { const r = (await api.post<{ data: { created: number } }>('/finance/accounts/load-standard-plan', {})).data; toast.success(t('finance.accounting.chartLoaded', { count: r.created })); } catch { toast.error(t('finance.accounting.planLoadFailed')); } finally { setBusy(''); } };
  const loadRates = async () => { setBusy('rates'); try { const r = (await api.post<{ data: { created: number } }>('/finance/seed-tax-rates', {})).data; toast.success(t('finance.accounting.ratesLoaded', { count: r.created })); } catch { toast.error(t('finance.accounting.loadRatesFailed')); } finally { setBusy(''); } };
  if (!pack) return <Loading />;
  const card = 'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]';
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="text-[13px] font-semibold">{t('finance.accounting.countryRules')}</div>
        <div className="flex items-center gap-3 text-sm"><span className="text-[var(--text-dim)]">{t('finance.accounting.country')}</span><span className="px-2 py-1 rounded bg-[var(--surface)] font-semibold">{pack.name}</span><span className="text-xs text-[var(--text-dim)]">{t('finance.accounting.currencyTaxId', { currency: pack.currency, label: pack.tax_id_label })}</span></div>
        <div className="text-xs text-[var(--text-dim)]">{t('finance.accounting.availableTaxModels')} {pack.fiscal_models.map((m) => <span key={m} className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-[var(--surface)] font-mono">{m}</span>)}</div>
      </div>
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="text-[13px] font-semibold">{t('finance.accounting.chartAndTaxRates')}</div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" disabled={busy === 'plan'} onClick={() => void loadPlan()} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">{busy === 'plan' ? t('finance.accounting.loading') : t('finance.accounting.loadChart', { code: pack.code })}</button>
          <button type="button" disabled={busy === 'rates'} onClick={() => void loadRates()} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">{busy === 'rates' ? t('finance.accounting.loading') : t('finance.accounting.loadRates')}</button>
        </div>
        <div className="text-xs text-[var(--text-dim)]">{t('finance.accounting.suggestedRates')} {pack.tax_rates.map((rate) => rate.name).join(' · ')}</div>
      </div>
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="text-[13px] font-semibold">{t('finance.accounting.importData')}</div>
        <div className="text-xs text-[var(--text-dim)]">{t('finance.accounting.importHelp')}</div>
        <button type="button" onClick={() => setImporting(true)} className="self-start px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white">{t('finance.accounting.importCsvOfx')}</button>
      </div>
      <ImportWizard open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

interface Sequence { id: string; series: string; year: number; last_number: number; }
function SeriesPanel() {
  const { t } = useI18n();
  const [seqs, setSeqs] = useState<Sequence[]>([]);
  const [series, setSeries] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setSeqs((await api.get<{ data: Sequence[] }>('/finance/sequences')).data ?? []); } catch { /* */ } };
  useEffect(() => { void load(); }, []);
  const create = async () => { if (!series.trim()) { toast.error(t('finance.accounting.enterSeries')); return; } setBusy(true); try { await api.post('/finance/sequences', { series: series.trim(), year: Number(year), last_number: 0 }); toast.success(t('finance.accounting.seriesCreated')); setSeries(''); await load(); } catch { toast.error(t('finance.accounting.seriesCreateFailed')); } finally { setBusy(false); } };
  const setCounter = async (s: Sequence, v: number) => { try { await api.patch(`/finance/sequences/${s.id}`, { last_number: v }); toast.success(t('finance.accounting.seriesCounterUpdated')); await load(); } catch (e: unknown) { const code = (e as { error?: { code?: string } })?.error?.code; toast.error(code === 'SEQUENCE_REGRESSION' ? t('finance.accounting.sequenceRegression') : t('finance.accounting.counterUpdateFailed')); await load(); } };
  const card = 'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]';
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className={`${card} p-4 flex items-end gap-2 flex-wrap`}>
        <label className="text-xs text-[var(--text-dim)] flex flex-col gap-1">{t('finance.accounting.series')}<input value={series} onChange={(e) => setSeries(e.target.value.toUpperCase())} placeholder="FAC" className="w-28 px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono" /></label>
        <label className="text-xs text-[var(--text-dim)] flex flex-col gap-1">{t('finance.accounting.year')}<input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24 px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]" /></label>
        <button type="button" disabled={busy} onClick={() => void create()} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white">{t('finance.accounting.createSeries')}</button>
      </div>
      <div className={card + ' overflow-hidden'}>
        <div className="px-3 py-2.5 text-[13px] font-semibold bg-[var(--surface)] border-b border-[var(--border)]">{t('finance.accounting.numberingSeries')}</div>
        <table className="w-full text-[13px]">
          <thead><tr className="text-[var(--text-dim)]"><th className="text-left font-medium px-3 py-1.5">{t('finance.accounting.series')}</th><th className="text-left font-medium px-3 py-1.5">{t('finance.accounting.year')}</th><th className="text-right font-medium px-3 py-1.5">{t('finance.accounting.lastNumber')}</th></tr></thead>
          <tbody>
            {seqs.map((s) => (
              <tr key={s.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5 font-mono">{s.series}</td><td className="px-3 py-1.5">{s.year}</td>
                <td className="px-3 py-1.5 text-right"><input type="number" defaultValue={s.last_number} onBlur={(e) => { const v = Number(e.target.value); if (v !== s.last_number) void setCounter(s, v); }} className="w-24 px-2 py-1 text-sm text-right rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono" /></td>
              </tr>
            ))}
            {seqs.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-[var(--text-dim)]">{t('finance.accounting.noSeries')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Loading() { const { t } = useI18n(); return <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center text-[var(--text-dim)] text-sm">{t('finance.accounting.loading')}</div>; }
