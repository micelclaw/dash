import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { FinanceAccount, FinanceSummary, FinanceSeriesPoint, FinanceCategoryTotal, FinanceTransaction } from '@/stores/finance-personal.store';
import type { InvoicingSummary, InvoicingSeriesPoint } from '@/stores/finance-billing.store';
import { fmtMoney } from '@/modules/finance/lib/format';
import type { ProductivityContext, ProductivityTransport } from './types';
import { pageOf } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { Fields, More, QueryState, SaveForm } from './shared';
import { pageOffset } from './selection-adapters';

interface Operating { operating_income: string; operating_expenses: string; ebitda: string; ebit: string; ebitda_margin: string; ebit_margin: string }
function Kpis({ values }: { values: Array<[string, string | number | undefined]> }) { return <div className="productivity-kpis">{values.map(([label, value]) => <section key={label}><h3>{label}</h3><strong>{value === undefined ? 'Sin datos completos' : fmtMoney(Number(value))}</strong></section>)}</div>; }
function Range({ from, to, change }: { from: string; to: string; change(from: string, to: string): void }) {
 return <div className="productivity-toolbar"><label>Desde<input type="date" value={from} max={to} onChange={e => change(e.target.value, to)} /></label><label>Hasta<input type="date" value={to} min={from} onChange={e => change(from, e.target.value)} /></label></div>;
}
function Summary({ transport, from, to }: { transport: ProductivityTransport; from: string; to: string }) {
 const query = useProductivityQuery(`F1:${from}:${to}`, async signal => {
  const [summary, series, categories] = await Promise.all([
   transport.call<FinanceSummary>('F1', 'summary', { date_from: from, date_to: to }, signal),
   transport.call<FinanceSeriesPoint[]>('F1', 'summary_series', { from, to }, signal), transport.call<FinanceCategoryTotal[]>('F1', 'summary_by_category', { from, to, kind: 'expense' }, signal),
  ]); return { summary: summary.data, series: series.data, categories: categories.data };
 });
 return <QueryState {...query} retry={query.refresh}>{query.data && <>
  <Kpis values={[["Patrimonio", query.data.summary.net_worth], ["Disponible", query.data.summary.available], ["Ingresos del período", query.data.summary.income_period], ["Gastos del período", query.data.summary.expenses_period]]} />
  <h3>Evolución del patrimonio y disponible</h3><div role="img" aria-label="Gráfico de evolución del patrimonio y disponible" style={{ height: 230 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={query.data.series.map(row => ({ ...row, net_worth: Number(row.net_worth), available: Number(row.available) }))}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line dataKey="net_worth" name="Patrimonio" stroke="var(--amber)" dot={false} /><Line dataKey="available" name="Disponible" stroke="var(--info)" dot={false} /></LineChart></ResponsiveContainer></div>
  <h3>Ingresos y gastos</h3><div role="img" aria-label="Gráfico de ingresos y gastos del período" style={{ height: 220 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={query.data.series.map(row => ({ ...row, income: Number(row.income), expense: Number(row.expense) }))}><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="income" name="Ingresos" fill="var(--success)" /><Bar dataKey="expense" name="Gastos" fill="var(--error)" /></BarChart></ResponsiveContainer></div>
  <h3>Gastos por categoría</h3>{query.data.categories.map(row => <Fields key={row.category_id || 'uncategorized'} values={[[row.name || 'Sin categoría', fmtMoney(Number(row.total))]]} />)}
 </>}</QueryState>;
}
function TransactionEdit({ transaction, transport, done, cancel }: { transaction: FinanceTransaction; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const [description, setDescription] = useState(transaction.description || '');
 return <SaveForm onCancel={cancel} onSave={async () => { await transport.call('F2', 'update_transaction', { transaction_id: transaction.id, description }); done(); }}><label>Concepto<input value={description} onChange={e => setDescription(e.target.value)} /></label></SaveForm>;
}
function Accounts({ context, transport, from, to, account, setAccount, offset, setOffset }: { context: ProductivityContext; transport: ProductivityTransport; from: string; to: string; account: string; setAccount(value: string): void; offset: number; setOffset(value: number): void }) {
 const [id, setId] = useState(context.selection.action === 'get_transaction' ? String(context.selection.params.transaction_id) : ''); const [editing, setEditing] = useState(false);
 const accounts = useProductivityQuery('F2:accounts', async signal => (await transport.call<FinanceAccount[]>('F2', 'list_accounts', {}, signal)).data);
 const filters = context.selection.action === 'list_transactions' ? context.selection.params : {};
 const transactions = useProductivityQuery(`F2:transactions:${account}:${from}:${to}:${offset}`, async signal => pageOf(await transport.call<FinanceTransaction[]>('F2', 'list_transactions', { ...filters, ...(account ? { account_id: account } : {}), date_from: from, date_to: to, limit: 25, offset }, signal), 25));
 const detail = useProductivityQuery(`F2:transaction:${id}`, async signal => id ? (await transport.call<FinanceTransaction>('F2', 'get_transaction', { transaction_id: id }, signal)).data : null);
 const transaction = detail.data;
 return <><QueryState {...accounts} retry={accounts.refresh}><h3>Cuentas y saldos</h3><div className="productivity-toolbar"><button onClick={() => { setAccount(''); setOffset(0); }}>Todas las cuentas</button>{accounts.data?.map(row => <button key={row.id} aria-pressed={account === row.id} onClick={() => { setAccount(row.id); setOffset(0); }}>{row.name} · {row.balance} {row.currency}</button>)}</div></QueryState>
  <QueryState {...transactions} empty={!transactions.data?.items.length} retry={transactions.refresh}>{transactions.data?.items.map(row => <button className="productivity-list-row" key={row.id} disabled={editing} onClick={() => setId(row.id)}><strong>{row.description || 'Movimiento sin concepto'}</strong><span>{row.date}</span></button>)}<More offset={offset} hasMore={transactions.data?.hasMore ?? false} onChange={setOffset} /></QueryState>
  {id && <article aria-label="Detalle del movimiento"><QueryState {...detail} retry={detail.refresh}>{transaction && <><h2>{transaction.description || 'Movimiento'}</h2><p>{transaction.date}</p>{editing ? <TransactionEdit key={transaction.id} transaction={transaction} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); detail.refresh(); transactions.refresh(); }} /> : <button onClick={() => setEditing(true)}>Editar concepto</button>}
   <h3>Cuentas relacionadas</h3>{transaction.postings?.map(posting => <Fields key={posting.id} values={[[accounts.data?.find(a => a.id === posting.account_id)?.name || 'Cuenta', `${posting.amount_base} ${posting.currency}`], ['Concepto', posting.memo], ['Categoría', posting.category_id ? 'Movimiento categorizado' : 'Sin categoría']]} />)}
  </>}</QueryState></article>}
 </>;
}
/** Sums complete aggregate buckets, never a paginated list of invoices or transactions. */
export function aggregateMoney(values: string[]): string {
 let total = 0n;
 for (const value of values) {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('El servidor no ha proporcionado importes completos compatibles.');
  const negative = value.startsWith('-'); const [integer, decimal = ''] = value.replace(/^-/, '').split('.');
  const cents = BigInt(integer!) * 100n + BigInt(decimal.padEnd(2, '0')); total += negative ? -cents : cents;
 }
 const abs = total < 0n ? -total : total; return `${total < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
function Billing({ transport, from, to }: { transport: ProductivityTransport; from: string; to: string }) {
 const query = useProductivityQuery(`F6:${from}:${to}`, async signal => {
  const duration = new Date(to).getTime() - new Date(from).getTime() + 86400000;
  const previousTo = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10); const previousFrom = new Date(new Date(from).getTime() - duration).toISOString().slice(0, 10);
  const [summary, series, operating, comparison] = await Promise.all([
   transport.call<InvoicingSummary>('F6', 'summary_invoicing', { from, to }, signal), transport.call<InvoicingSeriesPoint[]>('F6', 'summary_invoicing_series', { from, to }, signal),
   transport.call<Operating>('F6', 'report_operating_result', { from, to }, signal), transport.call<Operating>('F6', 'report_operating_result', { from: previousFrom, to: previousTo }, signal),
  ]); return { summary: summary.data, series: series.data, operating: operating.data, comparison: comparison.data, previousFrom, previousTo };
 });
 return <QueryState {...query} retry={query.refresh}>{query.data && <>
  <Kpis values={[["Facturado", aggregateMoney(query.data.series.map(row => row.invoiced))], ["Cobrado", aggregateMoney(query.data.series.map(row => row.collected))], ["Pendiente", query.data.summary.aging.total], ["Vencido", aggregateMoney([query.data.summary.aging.d1_30, query.data.summary.aging.d31_60, query.data.summary.aging.d60_plus])]]} />
  <h3>Facturación y cobros del período</h3><div role="img" aria-label="Gráfico de facturación y cobros" style={{ height: 230 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={query.data.series.map(row => ({ ...row, invoiced: Number(row.invoiced), collected: Number(row.collected) }))}><XAxis dataKey="bucket" /><YAxis /><Tooltip /><Bar dataKey="invoiced" name="Facturado" fill="var(--amber)" /><Bar dataKey="collected" name="Cobrado" fill="var(--success)" /></BarChart></ResponsiveContainer></div>
  <h3>Rendimiento operativo</h3><Kpis values={[["Ingresos operativos", query.data.operating.operating_income], ["Gastos operativos", query.data.operating.operating_expenses], ["EBITDA", query.data.operating.ebitda], ["EBIT", query.data.operating.ebit]]} />
  <h3>Período anterior: {query.data.previousFrom} — {query.data.previousTo}</h3><Kpis values={[["EBITDA anterior", query.data.comparison.ebitda], ["EBIT anterior", query.data.comparison.ebit]]} />
 </>}</QueryState>;
}
export default function FinanceView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const now = new Date().toISOString().slice(0, 10);
 const [range, setRange] = useState({ from: String(context.selection.params.date_from || context.selection.params.from || `${now.slice(0, 7)}-01`), to: String(context.selection.params.date_to || context.selection.params.to || now) });
 const [account, setAccount] = useState(String(context.selection.params.account_id || ''));
 const [page, setPage] = useState(() => ({ from: range.from, to: range.to, offset: pageOffset(context) }));
 const offset = page.from === range.from && page.to === range.to ? page.offset : 0;
 const setOffset = (next: number) => setPage({ ...range, offset: next });
 useEffect(() => { setPage(previous => previous.from === range.from && previous.to === range.to ? previous : { ...range, offset: 0 }); }, [range.from, range.to]);
 const valid = !!context.erp_profile_id && /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && Number.isFinite(new Date(range.from).getTime()) && Number.isFinite(new Date(range.to).getTime()) && range.from <= range.to;
 return <><Range {...range} change={(from, to) => setRange({ from, to })} />{valid ? context.area === 'F1' ? <Summary transport={transport} {...range} /> : context.area === 'F2' ? <Accounts context={context} transport={transport} {...range} account={account} setAccount={setAccount} offset={offset} setOffset={setOffset} /> : <Billing transport={transport} {...range} /> : <p role="alert">Selecciona un período válido y vuelve a abrir la vista con el perfil autorizado.</p>}</>;
}
