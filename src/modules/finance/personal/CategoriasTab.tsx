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

// P6 — Categorías: secciones Gasto / Ingreso con pastillas tintadas (emoji + color),
// importe gastado/ingresado del mes en curso por categoría, y un mini-formulario
// inline para crear y editar (nombre + emoji + color). Borrado con confirmación.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X, Pencil, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useFinancePersonalStore, type FinanceCategory } from '@/stores/finance-personal.store';
import { categoryVisual, tintBackground, fmtMoney } from './lib';

// Paleta sugerida para el selector de color (se puede teclear cualquier hex).
const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];
// Emojis frecuentes por tipo para acelerar la elección.
// Tupla no vacía: garantiza al tipado que siempre hay un emoji por defecto ([0]).
const EMOJI_SUGGEST: Record<'expense' | 'income', [string, ...string[]]> = {
  expense: ['🛒', '🍔', '🏠', '🚗', '⛽', '💡', '📱', '🎬', '🏥', '👕', '✈️', '🎓'],
  income: ['💼', '💰', '📈', '🎁', '🏦', '💵', '🧾', '⭐'],
};

function CategoryPill({ cat }: { cat: FinanceCategory }) {
  const { emoji, color, name } = categoryVisual(cat);
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px 6px 8px',
        background: tintBackground(color), border: `1px solid ${tintBackground(color, 0.4)}`,
        borderRadius: 'var(--radius-full, 999px)', fontSize: 13, color: 'var(--text)', maxWidth: '100%',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  );
}

function InlineForm({
  kind,
  editing,
  onClose,
  onSaved,
}: {
  kind: 'expense' | 'income';
  /** Categoría a editar; si es null el formulario crea una nueva. */
  editing: FinanceCategory | null;
  onClose: () => void;
  /** Tras crear/editar con éxito (para refrescar totales). */
  onSaved: () => void;
}) {
  const { createCategory, updateCategory } = useFinancePersonalStore();
  const isEdit = editing != null;
  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.icon?.trim() || EMOJI_SUGGEST[kind][0]);
  const [color, setColor] = useState(editing?.color?.trim() || (kind === 'income' ? '#22c55e' : '#ef4444'));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { toast.error('Pon un nombre'); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await updateCategory(editing!.id, { name: n, icon: emoji || null, color: color || null });
        toast.success('Categoría actualizada');
      } else {
        await createCategory({ name: n, kind, icon: emoji || undefined, color });
        toast.success('Categoría creada');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isEdit ? 'No se pudo guardar' : 'No se pudo crear');
    } finally { setBusy(false); }
  };

  const fieldLabel: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4, display: 'block' };

  return (
    <form
      onSubmit={submit}
      style={{
        marginTop: 10, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 6px)', display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Preview en vivo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <CategoryPill cat={{ id: '_preview', name: name.trim() || (isEdit ? 'Categoría' : 'Nueva categoría'), kind, parent_id: null, color, icon: emoji }} />
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }} aria-label="Cancelar">
          <X size={15} />
        </button>
      </div>

      <div>
        <label style={fieldLabel}>Nombre</label>
        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'income' ? 'p.ej. Nómina' : 'p.ej. Supermercado'}
          style={{ width: '100%', padding: '7px 9px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={fieldLabel}>Emoji</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={emoji} onChange={(e) => setEmoji([...e.target.value].slice(-2).join(''))} maxLength={4}
            style={{ width: 46, textAlign: 'center', padding: '6px 4px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 16 }}
          />
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {EMOJI_SUGGEST[kind].map((em) => (
              <button key={em} type="button" onClick={() => setEmoji(em)} title={em} style={{
                width: 28, height: 28, fontSize: 15, lineHeight: 1, cursor: 'pointer', borderRadius: 'var(--radius-md, 6px)',
                background: emoji === em ? 'var(--surface-hover)' : 'transparent', border: `1px solid ${emoji === em ? 'var(--mod-finance)' : 'var(--border)'}`,
              }}>{em}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label style={fieldLabel}>Color</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PALETTE.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} title={c} aria-label={`Color ${c}`} style={{
              width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color.toLowerCase() === c.toLowerCase() ? '2px solid var(--text)' : '2px solid transparent',
              boxShadow: color.toLowerCase() === c.toLowerCase() ? '0 0 0 1px var(--border)' : undefined,
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
        <button type="submit" disabled={busy} style={{ padding: '7px 14px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
          {busy ? (isEdit ? 'Guardando…' : 'Creando…') : (isEdit ? 'Guardar' : 'Crear')}
        </button>
      </div>
    </form>
  );
}

/** Total formateado del mes para una categoría (rojo con − en gasto, verde con + en ingreso). */
function CategoryTotal({ kind, total }: { kind: 'expense' | 'income'; total: number | undefined }) {
  if (total == null || total === 0) {
    return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>—</span>;
  }
  const isExpense = kind === 'expense';
  return (
    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: isExpense ? 'var(--error)' : 'var(--mod-finance)' }}>
      {isExpense ? '−' : '+'}{fmtMoney(Math.abs(total))}
    </span>
  );
}

function Section({
  kind,
  title,
  accent,
  Icon,
  totals,
  onMutated,
}: {
  kind: 'expense' | 'income';
  title: string;
  accent: string;
  Icon: typeof TrendingDown;
  /** category_id -> total del mes en curso. */
  totals: Map<string, number>;
  /** Llamar tras crear/editar/borrar para refrescar los totales. */
  onMutated: () => void;
}) {
  const { categories, deleteCategory } = useFinancePersonalStore();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = categories.filter((c) => c.kind === kind && !c.parent_id);

  const handleDelete = async (cat: FinanceCategory) => {
    if (!window.confirm(`¿Borrar la categoría «${cat.name}»? Los movimientos que la usaban quedan sin categoría.`)) return;
    setBusyId(cat.id);
    try {
      await deleteCategory(cat.id);
      toast.success('Categoría borrada');
      if (editingId === cat.id) setEditingId(null);
      onMutated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo borrar');
    } finally { setBusyId(null); }
  };

  const startEdit = (id: string) => {
    setAdding(false);
    setEditingId((cur) => (cur === id ? null : id));
  };

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', padding: 3, borderRadius: 'var(--radius-sm, 4px)', lineHeight: 0,
  };

  return (
    <div style={{ flex: 1, minWidth: 280, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflow: 'hidden' }}>
      {/* Encabezado con un toque de color del tipo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: tintBackground(accent, 0.1), borderBottom: `1px solid ${tintBackground(accent, 0.35)}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          <Icon size={16} style={{ color: accent }} /> {title}
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>({list.length})</span>
        </span>
        <button onClick={() => { setEditingId(null); setAdding((v) => !v); }} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
          <Plus size={14} /> Categoría
        </button>
      </div>

      <div style={{ padding: 14 }}>
        {list.length === 0 && !adding && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin categorías todavía.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((c) => {
            const children = categories.filter((ch) => ch.parent_id === c.id);
            const busy = busyId === c.id;
            return (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ minWidth: 0, flex: '0 1 auto' }}>
                    <CategoryPill cat={c} />
                  </div>
                  <CategoryTotal kind={kind} total={totals.get(c.id)} />
                  <div style={{ flex: 1 }} />
                  <button
                    type="button" onClick={() => startEdit(c.id)} disabled={busy} title="Editar" aria-label={`Editar ${c.name}`}
                    style={{ ...iconBtn, color: editingId === c.id ? accent : 'var(--text-muted)' }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button" onClick={() => handleDelete(c)} disabled={busy} title="Borrar" aria-label={`Borrar ${c.name}`}
                    style={{ ...iconBtn, opacity: busy ? 0.5 : 1 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {children.length > 0 && (
                  <div style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-dim)' }}>{children.map((ch) => `${categoryVisual(ch).emoji} ${ch.name}`).join('  ·  ')}</div>
                )}
                {editingId === c.id && (
                  <InlineForm kind={kind} editing={c} onClose={() => setEditingId(null)} onSaved={onMutated} />
                )}
              </div>
            );
          })}
        </div>
        {adding && <InlineForm kind={kind} editing={null} onClose={() => setAdding(false)} onSaved={onMutated} />}
      </div>
    </div>
  );
}

export function CategoriasTab() {
  const { fetchSpendByCategory } = useFinancePersonalStore();
  const [expenseTotals, setExpenseTotals] = useState<Map<string, number>>(new Map());
  const [incomeTotals, setIncomeTotals] = useState<Map<string, number>>(new Map());

  const loadTotals = useCallback(async () => {
    const toMap = (rows: { category_id: string | null; total: string }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        if (r.category_id) m.set(r.category_id, Number(r.total ?? 0));
      }
      return m;
    };
    try {
      const [exp, inc] = await Promise.all([
        fetchSpendByCategory({ kind: 'expense' }),
        fetchSpendByCategory({ kind: 'income' }),
      ]);
      setExpenseTotals(toMap(exp));
      setIncomeTotals(toMap(inc));
    } catch {
      // Silencioso: los totales son informativos; la gestión de categorías sigue operativa.
    }
  }, [fetchSpendByCategory]);

  useEffect(() => { void loadTotals(); }, [loadTotals]);

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Section kind="expense" title="Gasto" accent="var(--error)" Icon={TrendingDown} totals={expenseTotals} onMutated={loadTotals} />
      <Section kind="income" title="Ingreso" accent="var(--mod-finance)" Icon={TrendingUp} totals={incomeTotals} onMutated={loadTotals} />
    </div>
  );
}
