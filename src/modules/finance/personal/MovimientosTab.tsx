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

// P4 — Movimientos: lista filtrable. Importes firmados desde la cuenta del usuario.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Search, Upload } from 'lucide-react';
import { useFinancePersonalStore } from '@/stores/finance-personal.store';
import { fmtMoney, movementFace, categoryVisual, tintBackground } from './lib';
import { ImportCsvDialog } from './ImportCsvDialog';
import { useSortable, SortableTh } from '@/modules/finance/sortable';
import { usePersonalNav } from './navigation';
import { RecurrenceBadge } from './RecurrenceBadge';
import { useI18n } from '@/i18n';

// ── Helpers de mes ───────────────────────────────────────────────────
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthRange(anchor: Date): { from: string; to: string } {
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: ymd(from), to: ymd(to) };
}
function monthLabel(anchor: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor);
}
/** Cabecera de día legible a partir de un ISO `YYYY-MM-DD`. */
function dayHeader(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function MovimientosTab() {
  const { t, locale } = useI18n();
  const { transactions, accounts, categories, fetchTransactions, txTotal } = useFinancePersonalStore();
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  // Periodo: navegador de mes. `monthMode=false` ⇒ "All time" (sin filtro de fecha).
  const [monthMode, setMonthMode] = useState(true);
  const [anchor, setAnchor] = useState(() => new Date());
  // Búsqueda con debounce.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const { openMovement } = usePersonalNav();

  // Orden por columna: con columna activa la tabla pasa a vista PLANA ordenada
  // (sin agrupar por día); sin orden, mantiene la agrupación por día.
  const sort = useSortable(transactions, {
    date: (tx) => tx.date,
    description: (tx) => tx.description ?? '',
    account: (tx) => movementFace(tx, accounts).accountName,
    category: (tx) => { const f = movementFace(tx, accounts); const c = f.categoryId ? catById.get(f.categoryId) : undefined; return c ? categoryVisual(c).name : ''; },
    amount: (tx) => movementFace(tx, accounts).signed,
  });
  const flat = sort.sortKey !== null;

  // Debounce ligero del texto de búsqueda.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const range = monthMode ? monthRange(anchor) : null;
    void fetchTransactions({
      account_id: accountId || undefined,
      category_id: categoryId || undefined,
      date_from: range?.from,
      date_to: range?.to,
      search: search || undefined,
    } as Parameters<typeof fetchTransactions>[0]);
  }, [accountId, categoryId, monthMode, anchor, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Totales del periodo mostrado (signo desde movementFace) ──────────
  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const tx of transactions) {
      const f = movementFace(tx, accounts);
      if (f.isTransfer) continue; // las transferencias no son ingreso ni gasto
      if (f.signed >= 0) income += f.signed;
      else expense += -f.signed;
    }
    return { income, expense, net: income - expense };
  }, [transactions, accounts]);

  // ── Agrupar por día (las tx llegan ordenadas por fecha desc) ─────────
  const groups = useMemo(() => {
    const out: { date: string; items: typeof transactions }[] = [];
    let cur: { date: string; items: typeof transactions } | null = null;
    for (const tx of transactions) {
      if (!cur || cur.date !== tx.date) {
        cur = { date: tx.date, items: [] };
        out.push(cur);
      }
      cur.items.push(tx);
    }
    return out;
  }, [transactions]);

  const selStyle: React.CSSProperties = { padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' };
  const navBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: 'pointer' };
  const totalChip: React.CSSProperties = { display: 'inline-flex', flexDirection: 'column', gap: 1, padding: '6px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)' };
  const totalLabel: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 };
  const totalValue: React.CSSProperties = { fontSize: 14, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 };

  const renderRow = (tx: (typeof transactions)[number]) => {
    const f = movementFace(tx, accounts);
    const cat = f.categoryId ? catById.get(f.categoryId) : undefined;
    const cv = cat ? categoryVisual(cat) : null;
    return (
      <tr key={tx.id} role="button" tabIndex={0}
        title={t('finance.movements.view')}
        onClick={() => openMovement(tx)}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        style={{ cursor: 'pointer' }}>
        <td style={{ ...td, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{tx.date}</td>
        <td style={td}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {f.glyph} {tx.description || t(f.isTransfer ? 'finance.movements.transfer' : 'finance.movements.movement')}
            {tx.recurring_rule_id && <RecurrenceBadge compact />}
          </span>
        </td>
        <td style={{ ...td, color: 'var(--text-dim)' }}>
          {f.isTransfer && f.transferFrom && f.transferTo ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {f.transferFrom}
              <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
              {f.transferTo}
            </span>
          ) : (
            f.accountName
          )}
        </td>
        <td style={td}>
          {f.isTransfer || !cv ? (
            <span style={{ color: 'var(--text-dim)' }}>{f.isTransfer ? t('finance.movements.transfer') : '—'}</span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px 2px 7px', background: tintBackground(cv.color), borderRadius: 'var(--radius-full, 999px)', fontSize: 12, color: 'var(--text)' }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{cv.emoji}</span>{cv.name}
            </span>
          )}
        </td>
        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: f.signed >= 0 ? 'var(--mod-finance)' : 'var(--text)' }}>{f.signed >= 0 ? '+' : ''}{fmtMoney(f.signed)}</td>
      </tr>
    );
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Fila 1: periodo + búsqueda */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            style={{ ...navBtn, opacity: monthMode ? 1 : 0.4, cursor: monthMode ? 'pointer' : 'not-allowed' }}
            disabled={!monthMode}
            title={t('finance.movements.previousMonth')}
            onClick={() => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ minWidth: 130, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
            {monthMode ? monthLabel(anchor, locale) : t('finance.movements.fullHistory')}
          </span>
          <button
            type="button"
            style={{ ...navBtn, opacity: monthMode ? 1 : 0.4, cursor: monthMode ? 'pointer' : 'not-allowed' }}
            disabled={!monthMode}
            title={t('finance.movements.nextMonth')}
            onClick={() => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            style={{ padding: '6px 10px', background: monthMode ? 'var(--bg)' : 'var(--mod-finance)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: monthMode ? 'var(--text-muted)' : '#fff', fontSize: 12, cursor: 'pointer' }}
            title={t(monthMode ? 'finance.movements.seeFullHistory' : 'finance.movements.backCurrentMonth')}
            onClick={() => {
              if (monthMode) {
                setMonthMode(false);
              } else {
                setAnchor(new Date());
                setMonthMode(true);
              }
            }}
          >
            {monthMode ? t('finance.movements.allTime') : t('finance.movements.currentMonth')}
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            title={t('finance.movements.importTitle')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}
          >
            <Upload size={14} /> {t('finance.import.upload')}
          </button>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('finance.movements.searchPlaceholder')}
              style={{ ...selStyle, paddingLeft: 28, width: 200 }}
            />
          </div>
        </div>
      </div>

      {/* Fila 2: filtros de cuenta/categoría */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={selStyle}>
          <option value="">{t('finance.table.account')}</option>
          {accounts.filter((a) => a.type === 'asset' || a.type === 'liability').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={selStyle}>
          <option value="">{t('finance.table.category')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>{t('finance.movements.count', { count: txTotal })}</span>
      </div>

      {/* Totales del periodo/filtro mostrado */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={totalChip}>
          <span style={totalLabel}>{t('finance.movements.income')}</span>
          <span style={{ ...totalValue, color: 'var(--mod-finance)' }}>+{fmtMoney(totals.income)}</span>
        </div>
        <div style={totalChip}>
          <span style={totalLabel}>{t('finance.movements.expenses')}</span>
          <span style={{ ...totalValue, color: '#ef4444' }}>-{fmtMoney(totals.expense)}</span>
        </div>
        <div style={totalChip}>
          <span style={totalLabel}>{t('finance.movements.net')}</span>
          <span style={{ ...totalValue, color: totals.net >= 0 ? 'var(--mod-finance)' : '#ef4444' }}>{totals.net >= 0 ? '+' : '-'}{fmtMoney(Math.abs(totals.net))}</span>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr>
              <SortableTh label={t('finance.date')} col="date" state={sort} />
              <SortableTh label={t('finance.table.description')} col="description" state={sort} />
              <SortableTh label={t('finance.table.account')} col="account" state={sort} />
              <SortableTh label={t('finance.table.category')} col="category" state={sort} />
              <SortableTh label={t('finance.amount')} col="amount" state={sort} align="right" />
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr><td style={{ ...td, color: 'var(--text-muted)', textAlign: 'center' }} colSpan={5}>{t('finance.movements.noResults')}</td></tr>
            )}
            {flat
              ? sort.sorted.map(renderRow)
              : groups.map((g) => (
                <Fragment key={`g-${g.date}`}>
                  <tr>
                    <td colSpan={5} style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {dayHeader(g.date, locale)}
                    </td>
                  </tr>
                  {g.items.map(renderRow)}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>

      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
