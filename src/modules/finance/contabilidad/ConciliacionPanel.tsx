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

// Conciliación bancaria (F6): extracto del banco ↔ apuntes del mayor de una cuenta.
// Auto-conciliar (importe ±0,01 + fecha ±5 días), conciliar manual con un apunte,
// crear movimiento desde una línea sin apunte, y resumen libros vs extracto.

import { useEffect, useState, type CSSProperties } from 'react';
import { useI18n } from '@/i18n';
import { Loader2, Wand2, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { ImportWizard } from '../ImportWizard';

interface Account { id: string; code: string | null; name: string; type: string; subtype: string | null; }
interface StatementLine { id: string; date: string; amount: string; description: string | null; status: 'unmatched' | 'reconciled'; reconciled_posting_id: string | null; }
interface LedgerPosting { posting_id: string; entry_id: string; date: string; description: string | null; amount: string; }
interface Summary { book_balance: string; statement_total: string; reconciled_total: string; difference: string; unmatched_lines: number; unmatched_postings: number; }

const card: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 600, borderBottom: '1px solid var(--border)' };
const td: CSSProperties = { padding: '7px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' };
const tdR: CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' };
const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' };
const inp: CSSProperties = { padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', color: 'var(--text)', fontSize: 13 };
const btn = (primary?: boolean): CSSProperties => ({ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-sm, 4px)', border: primary ? 'none' : '1px solid var(--border)', cursor: 'pointer', background: primary ? 'var(--mod-finance)' : 'var(--surface)', color: primary ? '#fff' : 'var(--text)' });

export function ConciliacionPanel() {
  const { t, locale } = useI18n();
  const fmt = (value: string | number | null | undefined) => {
    if (value == null || value === '') return '—';
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString(locale === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—';
  };
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [postings, setPostings] = useState<LedgerPosting[]>([]);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [nl, setNl] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', description: '' });

  useEffect(() => {
    api.get<{ data: Account[] }>('/finance/accounts').then((r) => {
      const banks = (r.data ?? []).filter((a) => a.subtype === 'bank' || a.subtype === 'cash' || a.subtype === 'credit_card');
      setAccounts(banks);
      if (banks[0] && !accountId) setAccountId(banks[0].id);
    }).catch(() => {});
  }, []);

  const reload = async (id = accountId) => {
    if (!id) return;
    const [s, l, p] = await Promise.all([
      api.get<{ data: Summary }>(`/finance/reconciliation/${id}/summary`),
      api.get<{ data: StatementLine[] }>(`/finance/reconciliation/${id}/lines`),
      api.get<{ data: LedgerPosting[] }>(`/finance/reconciliation/${id}/unreconciled-postings`),
    ]);
    setSummary(s.data); setLines(l.data ?? []); setPostings(p.data ?? []);
  };
  useEffect(() => { if (accountId) void reload(accountId); }, [accountId]);

  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast.success(okMsg); await reload(); }
    catch { toast.error(t('finance.accounting.operationFailed')); } finally { setBusy(false); }
  };
  const addLine = () => {
    const amt = Number(String(nl.amount).replace(',', '.'));
    if (!nl.date || !Number.isFinite(amt) || amt === 0) { toast.error(t('finance.accounting.invalidStatementLine')); return; }
    void run(async () => { await api.post(`/finance/reconciliation/${accountId}/lines`, { lines: [{ date: nl.date, amount: amt, description: nl.description || null }] }); setNl({ ...nl, amount: '', description: '' }); });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
      {/* Cuenta + resumen */}
      <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('finance.accounting.account')}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ ...inp, minWidth: 220 }}>
            {accounts.length === 0 && <option value="">{t('finance.accounting.noBankAccounts')}</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>)}
          </select>
          <button type="button" disabled={busy || !accountId} onClick={() => void run(() => api.post(`/finance/reconciliation/${accountId}/auto-match`, {}), t('finance.accounting.autoReconcileApplied'))} style={{ ...btn(), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={13} />} {t('finance.accounting.autoReconcile')}
          </button>
          <button type="button" disabled={!accountId} onClick={() => setImporting(true)} style={{ ...btn(), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileUp size={13} /> {t('finance.accounting.importStatement')}
          </button>
        </div>
        {summary && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>{t('finance.accounting.bookBalance')} <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{fmt(summary.book_balance)}</b></span>
            <span style={{ color: 'var(--text-dim)' }}>{t('finance.accounting.statement')} <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{fmt(summary.statement_total)}</b></span>
            <span style={{ color: 'var(--text-dim)' }}>{t('finance.accounting.difference')} <b style={{ color: Math.abs(Number(summary.difference)) < 0.01 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono, monospace)' }}>{fmt(summary.difference)}</b></span>
            <span style={{ color: 'var(--text-dim)' }}>{t('finance.accounting.unmatched')} <b style={{ color: 'var(--text)' }}>{summary.unmatched_lines} {t('finance.accounting.statementLines')} · {summary.unmatched_postings} {t('finance.accounting.postings')}</b></span>
          </div>
        )}
        {/* Añadir línea de extracto */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={nl.date} onChange={(e) => setNl({ ...nl, date: e.target.value })} style={inp} />
          <input type="number" step="0.01" placeholder={t('finance.accounting.amountPlaceholder')} value={nl.amount} onChange={(e) => setNl({ ...nl, amount: e.target.value })} style={{ ...inp, width: 130 }} />
          <input placeholder={t('finance.accounting.description')} value={nl.description} onChange={(e) => setNl({ ...nl, description: e.target.value })} style={{ ...inp, flex: 1, minWidth: 160 }} />
          <button type="button" disabled={busy || !accountId} onClick={addLine} style={btn()}>{t('finance.accounting.addLine')}</button>
        </div>
      </div>

      {/* Líneas del extracto */}
      <div style={card}>
        <div style={sectionTitle}>{t('finance.accounting.bankStatement')}</div>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr><th style={th}>{t('finance.accounting.date')}</th><th style={th}>{t('finance.accounting.description')}</th><th style={{ ...th, textAlign: 'right' }}>{t('finance.amount')}</th><th style={th}>{t('finance.accounting.status')}</th><th style={{ ...th, textAlign: 'right' }}>{t('finance.accounting.action')}</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{l.date}</td>
                <td style={td}>{l.description ?? '—'}</td>
                <td style={{ ...tdR, color: Number(l.amount) < 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(l.amount)}</td>
                <td style={td}>{l.status === 'reconciled' ? <span style={{ color: 'var(--green)', fontSize: 12, fontWeight: 600 }}>{t('finance.accounting.reconciled')}</span> : <span style={{ color: 'var(--amber)', fontSize: 12, fontWeight: 600 }}>{t('finance.accounting.pending')}</span>}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {l.status === 'reconciled' ? (
                    <button type="button" disabled={busy} onClick={() => void run(() => api.post(`/finance/reconciliation/lines/${l.id}/unreconcile`, {}))} style={btn()}>{t('finance.accounting.unreconcile')}</button>
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <select defaultValue="" disabled={busy} onChange={(e) => { if (e.target.value) void run(() => api.post(`/finance/reconciliation/lines/${l.id}/reconcile`, { posting_id: e.target.value }), t('finance.accounting.reconciledToast')); }} style={{ ...inp, maxWidth: 220 }}>
                        <option value="">{t('finance.accounting.matchPosting')}</option>
                        {postings.map((p) => <option key={p.posting_id} value={p.posting_id}>{p.date} · {fmt(p.amount)} · {(p.description ?? '').slice(0, 24)}</option>)}
                      </select>
                      <button type="button" disabled={busy} onClick={() => void run(() => api.post(`/finance/reconciliation/lines/${l.id}/create-movement`, {}), t('finance.accounting.movementCreatedReconciled'))} style={btn(true)}>{t('finance.accounting.createMovement')}</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td style={{ ...td, color: 'var(--text-dim)' }} colSpan={5}>{t('finance.accounting.noStatementLines')}</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <ImportWizard open={importing} onClose={() => setImporting(false)} fixedType="bank-statement" fixedAccountId={accountId} onDone={() => void reload()} />
    </div>
  );
}
