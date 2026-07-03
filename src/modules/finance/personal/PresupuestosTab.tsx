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

// P (Presupuestos) — control de gasto por categoría del mes en curso. Cabecera con
// totales (presupuestado / gastado / restante) + una fila con barra de progreso por
// presupuesto + alta (categoría sin presupuesto + importe) + editar importe / borrar.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X, PiggyBank, ChevronLeft, ChevronRight, CalendarClock, AlertTriangle } from 'lucide-react';
import { useFinancePersonalStore, type Budget } from '@/stores/finance-personal.store';
import { fmtMoney, categoryVisual, tintBackground } from './lib';
import { ObjetivosAhorroSection } from './ObjetivosAhorroSection';

// ── Utilidades de mes ('YYYY-MM') ──────────────────────────────────
/** Mes en curso en formato 'YYYY-MM' a partir de la fecha local. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Desplaza un mes 'YYYY-MM' en `delta` meses, normalizando el límite enero↔diciembre. */
function shiftMonth(month: string, delta: number): string {
  // El formato 'YYYY-MM' está garantizado; los defaults solo satisfacen el tipado.
  const [y = 0, m = 1] = month.split('-').map(Number);
  // `new Date` normaliza meses fuera de 1-12 (mes 0 = diciembre del año anterior, etc.).
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Etiqueta legible y capitalizada del mes, p.ej. "junio 2026". */
function monthLabel(month: string): string {
  const [y = 0, m = 1] = month.split('-').map(Number);
  const raw = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ── Navegador de mes: ‹ etiqueta › + botón "Hoy" si no es el mes en curso ──
function MonthNav({ month, onChange }: { month: string; onChange: (next: string) => void }) {
  const isCurrent = month === currentMonth();
  const navBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)',
    color: 'var(--text-dim)', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(shiftMonth(month, -1))} title="Mes anterior" style={navBtn}><ChevronLeft size={16} /></button>
      <span style={{ minWidth: 150, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
        {monthLabel(month)}
      </span>
      <button onClick={() => onChange(shiftMonth(month, 1))} title="Mes siguiente" style={navBtn}><ChevronRight size={16} /></button>
      {!isCurrent && (
        <button
          onClick={() => onChange(currentMonth())} title="Volver al mes en curso"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <CalendarClock size={14} /> Hoy
        </button>
      )}
    </div>
  );
}

// ── Banner de aviso cuando hay presupuestos excedidos (spent > amount) ──
function OverspentBanner({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const MAX = 3;
  const shown = names.slice(0, MAX);
  const extra = names.length - shown.length;
  const list = shown.join(', ') + (extra > 0 ? ` y ${extra} más` : '');
  const plural = names.length === 1 ? 'categoría' : 'categorías';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: tintBackground('var(--error)'), border: '1px solid var(--error)', borderRadius: 'var(--radius-md, 6px)' }}>
      <AlertTriangle size={18} style={{ color: 'var(--error)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--text)' }}>
        Te has pasado en {names.length} {plural}: {list}
      </span>
    </div>
  );
}

// ── Estado de una barra de progreso según el % gastado ─────────────
// verde <80% · ámbar 80-100% · rojo >100% (sobrepasado).
function progressColor(pct: number): string {
  if (pct > 100) return 'var(--error)';
  if (pct >= 80) return 'var(--amber, #f59e0b)';
  return 'var(--mod-finance)';
}

// ── Cabecera con los tres totales del mes ──────────────────────────
function Totals({ budgets }: { budgets: Budget[] }) {
  const t = useMemo(() => {
    let budgeted = 0, spent = 0;
    for (const b of budgets) { budgeted += Number(b.amount); spent += Number(b.spent); }
    return { budgeted, spent, remaining: budgeted - spent };
  }, [budgets]);

  const overspent = t.spent > t.budgeted;
  const Cell = ({ label, value, color }: { label: string; value: string; color: string }) => (
    <div style={{ flex: 1, minWidth: 130, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color, fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Cell label="Presupuestado" value={fmtMoney(t.budgeted)} color="var(--text)" />
      <Cell label="Gastado" value={fmtMoney(t.spent)} color={overspent ? 'var(--error)' : 'var(--text)'} />
      <Cell label="Restante" value={fmtMoney(t.remaining)} color={t.remaining < 0 ? 'var(--error)' : 'var(--mod-finance)'} />
    </div>
  );
}

// ── Fila de un presupuesto: categoría + barra + cifras + acciones ──
function BudgetRow({ budget }: { budget: Budget }) {
  const { updateBudget, deleteBudget } = useFinancePersonalStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(budget.amount);
  const [busy, setBusy] = useState(false);

  const amount = Number(budget.amount);
  const spent = Number(budget.spent);
  const remaining = Number(budget.remaining);
  const pct = amount > 0 ? (spent / amount) * 100 : (spent > 0 ? 100 : 0);
  const barPct = Math.min(pct, 100);
  const color = progressColor(pct);

  const cv = categoryVisual({
    id: budget.category_id, name: budget.category_name, kind: 'expense',
    parent_id: null, color: budget.category_color, icon: budget.category_icon,
  });

  const save = async () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) { toast.error('Importe no válido'); return; }
    setBusy(true);
    try {
      await updateBudget(budget.id, { amount: String(n) });
      toast.success('Presupuesto actualizado');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`¿Borrar el presupuesto de “${budget.category_name}”?`)) return;
    setBusy(true);
    try {
      await deleteBudget(budget.id);
      toast.success('Presupuesto borrado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo borrar');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: '12px 14px' }}>
      {/* Línea superior: categoría + acciones / editor de importe */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', flexShrink: 0, fontSize: 15, background: tintBackground(cv.color) }}>{cv.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cv.name}</span>
        </span>

        {editing ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <input
              autoFocus type="number" min="0" step="0.01" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); }}
              style={{ width: 96, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}
            />
            <button onClick={() => void save()} disabled={busy} title="Guardar" style={iconBtn('var(--mod-finance)')}><Check size={15} /></button>
            <button onClick={() => { setEditing(false); setDraft(budget.amount); }} title="Cancelar" style={iconBtn('var(--text-muted)')}><X size={15} /></button>
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button onClick={() => { setDraft(budget.amount); setEditing(true); }} title="Editar importe" style={iconBtn('var(--text-dim)')}><Pencil size={14} /></button>
            <button onClick={() => void remove()} disabled={busy} title="Borrar presupuesto" style={iconBtn('var(--error)')}><Trash2 size={14} /></button>
          </span>
        )}
      </div>

      {/* Barra de progreso */}
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-hover)', overflow: 'hidden' }}>
        <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .25s ease' }} />
      </div>

      {/* Texto: gastado X de Y · quedan Z */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 7, fontSize: 12 }}>
        <span style={{ color: 'var(--text-dim)' }}>
          <span style={{ color, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(spent)}</span>
          <span style={{ color: 'var(--text-muted)' }}> de </span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{fmtMoney(amount)}</span>
        </span>
        <span style={{ color: remaining < 0 ? 'var(--error)' : 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
          {remaining < 0 ? `${fmtMoney(Math.abs(remaining))} de más` : `quedan ${fmtMoney(remaining)}`}
        </span>
      </div>
    </div>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color, cursor: 'pointer' };
}

// ── Alta de presupuesto: categoría de gasto sin presupuesto + importe ──
function AddBudget({ takenCategoryIds }: { takenCategoryIds: Set<string> }) {
  const { categories, createBudget } = useFinancePersonalStore();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  // Solo categorías de gasto que aún no tengan presupuesto.
  const available = useMemo(
    () => categories.filter((c) => c.kind === 'expense' && !c.parent_id && !takenCategoryIds.has(c.id)),
    [categories, takenCategoryIds],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!categoryId) { toast.error('Elige una categoría'); return; }
    if (!Number.isFinite(n) || n <= 0) { toast.error('Pon un importe válido'); return; }
    setBusy(true);
    try {
      await createBudget({ category_id: categoryId, amount: String(n) });
      toast.success('Presupuesto creado');
      setCategoryId(''); setAmount(''); setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear');
    } finally { setBusy(false); }
  };

  if (!open) {
    const disabled = available.length === 0;
    return (
      <button
        onClick={() => setOpen(true)} disabled={disabled}
        title={disabled ? 'Todas las categorías de gasto ya tienen presupuesto' : undefined}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: disabled ? 'var(--text-muted)' : 'var(--text-dim)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: disabled ? 0.6 : 1 }}
      >
        <Plus size={15} /> Nuevo presupuesto
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)' }}>
      <select
        value={categoryId} onChange={(e) => setCategoryId(e.target.value)} autoFocus
        style={{ flex: '1 1 200px', minWidth: 160, padding: '8px 9px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 }}
      >
        <option value="">Categoría de gasto…</option>
        {available.map((c) => {
          const cv = categoryVisual(c);
          return <option key={c.id} value={c.id}>{cv.emoji} {cv.name}</option>;
        })}
      </select>
      <input
        type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Importe (€)"
        style={{ width: 130, padding: '8px 9px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono, monospace)' }}
      />
      <button type="submit" disabled={busy} style={{ padding: '8px 14px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Creando…' : 'Crear'}
      </button>
      <button type="button" onClick={() => { setOpen(false); setCategoryId(''); setAmount(''); }} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>
        Cancelar
      </button>
    </form>
  );
}

export function PresupuestosTab() {
  const { budgets, fetchBudgets } = useFinancePersonalStore();
  const [month, setMonth] = useState<string>(() => currentMonth());

  // Re-consulta los presupuestos (con su gasto del mes indicado) al cambiar de mes.
  // El store memoriza este mes, así que crear/editar/borrar re-consultan el mismo.
  useEffect(() => { void fetchBudgets(month); }, [fetchBudgets, month]);

  const taken = useMemo(() => new Set(budgets.map((b) => b.category_id)), [budgets]);

  // Nombres de las categorías cuyo gasto supera lo presupuestado.
  const overspentNames = useMemo(
    () => budgets.filter((b) => Number(b.spent) > Number(b.amount)).map((b) => b.category_name),
    [budgets],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <MonthNav month={month} onChange={setMonth} />

      <OverspentBanner names={overspentNames} />

      <Totals budgets={budgets} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {budgets.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 16px', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', textAlign: 'center' }}>
            <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: tintBackground('var(--mod-finance)') }}>
              <PiggyBank size={22} style={{ color: 'var(--mod-finance)' }} />
            </span>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 340 }}>
              Aún no tienes presupuestos en este mes. Crea uno por categoría para controlar tu gasto.
            </div>
          </div>
        ) : (
          budgets.map((b) => <BudgetRow key={b.id} budget={b} />)
        )}

        <AddBudget takenCategoryIds={taken} />
      </div>

      {/* Objetivos de ahorro (Personal pro) — separados de los presupuestos del mes. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <ObjetivosAhorroSection />
      </div>
    </div>
  );
}
