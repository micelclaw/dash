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

// O7.2 — Objetivos de ahorro (Personal pro). Metas: nombre + importe objetivo +
// fecha límite opcional + ahorrado actual → barra de progreso + días restantes.
// Persisten en users.settings.finance_goals vía GET/PUT /finance/goals (sin migración).
// El dash gestiona la lista entera client-side y hace PUT del array completo.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Target, Check, X, CalendarClock, Pencil } from 'lucide-react';
import { useFinancePersonalStore, type SavingsGoal } from '@/stores/finance-personal.store';
import { fmtMoney, tintBackground } from './lib';

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function fmtDeadline(deadline: string | null): string {
  if (!deadline) return '';
  try {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(deadline + 'T00:00:00'));
  } catch { return deadline; }
}

const inputStyle: React.CSSProperties = { padding: '8px 9px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 };

function GoalRow({ goal, onPatch, onDelete }: { goal: SavingsGoal; onPatch: (g: SavingsGoal) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.target));
  const [saved, setSaved] = useState(String(goal.saved));
  const [deadline, setDeadline] = useState(goal.deadline ?? '');

  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
  const done = goal.saved >= goal.target && goal.target > 0;
  const remaining = Math.max(0, goal.target - goal.saved);
  const dl = daysLeft(goal.deadline);
  const overdue = dl != null && dl < 0 && !done;
  const color = done ? 'var(--mod-finance)' : overdue ? 'var(--error)' : 'var(--info)';

  const commit = () => {
    const t = Number(String(target).replace(',', '.'));
    const s = Number(String(saved).replace(',', '.'));
    if (!name.trim()) { toast.error('Enter a name'); return; }
    if (!Number.isFinite(t) || t <= 0) { toast.error('Invalid target amount'); return; }
    onPatch({ ...goal, name: name.trim(), target: Math.round(t * 100) / 100, saved: Math.max(0, Math.round((s || 0) * 100) / 100), deadline: deadline || null });
    setEdit(false);
  };

  if (edit) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--info)', borderRadius: 'var(--radius-md, 6px)', padding: '12px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name" style={{ ...inputStyle, flex: '1 1 180px', minWidth: 140 }} />
        <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="Objetivo €" title="Importe objetivo" style={{ ...inputStyle, width: 110, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
        <input value={saved} onChange={(e) => setSaved(e.target.value)} inputMode="decimal" placeholder="Ahorrado €" title="Ahorrado hasta ahora" style={{ ...inputStyle, width: 110, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} title="Deadline (optional)" style={{ ...inputStyle, width: 150 }} />
        <button onClick={commit} title="Save" style={{ padding: '7px 10px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Check size={15} /></button>
        <button onClick={() => setEdit(false)} title="Cancel" style={{ padding: '7px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={15} /></button>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: tintBackground(color) }}>
            <Target size={14} style={{ color }} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</span>
          {done && <span style={{ fontSize: 11, color: 'var(--mod-finance)', fontWeight: 600 }}>✓ conseguido</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {goal.deadline && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: overdue ? 'var(--error)' : 'var(--text-muted)' }}>
              <CalendarClock size={12} />
              {dl != null && dl >= 0 ? `${dl} días` : overdue ? 'vencido' : fmtDeadline(goal.deadline)}
            </span>
          )}
          <button onClick={() => { setName(goal.name); setTarget(String(goal.target)); setSaved(String(goal.saved)); setDeadline(goal.deadline ?? ''); setEdit(true); }} title="Edit" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}><Pencil size={14} /></button>
          <button onClick={onDelete} title="Borrar objetivo" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-hover)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .25s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 7, fontSize: 12 }}>
        <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          {fmtMoney(goal.saved)} <span style={{ color: 'var(--text-muted)' }}>de {fmtMoney(goal.target)}</span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {done ? 'done!' : `faltan ${fmtMoney(remaining)}`} · {pct}%
        </span>
      </div>
    </div>
  );
}

function AddGoal({ onAdd }: { onAdd: (g: Omit<SavingsGoal, 'id'>) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState('');

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        <Plus size={15} /> Nuevo objetivo de ahorro
      </button>
    );
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = Number(String(target).replace(',', '.'));
    const s = Number(String(saved).replace(',', '.'));
    if (!name.trim()) { toast.error('Enter a name'); return; }
    if (!Number.isFinite(t) || t <= 0) { toast.error('Invalid target amount'); return; }
    onAdd({ name: name.trim(), target: Math.round(t * 100) / 100, saved: Math.max(0, Math.round((s || 0) * 100) / 100), deadline: deadline || null });
    setName(''); setTarget(''); setSaved(''); setDeadline(''); setOpen(false);
  };
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Emergency fund, Holiday…" style={{ ...inputStyle, flex: '1 1 200px', minWidth: 160 }} />
      <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="Objetivo €" style={{ ...inputStyle, width: 120, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
      <input value={saved} onChange={(e) => setSaved(e.target.value)} inputMode="decimal" placeholder="Ya ahorrado €" style={{ ...inputStyle, width: 120, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
      <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} title="Deadline (optional)" style={{ ...inputStyle, width: 150 }} />
      <button type="submit" style={{ padding: '8px 14px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Create</button>
      <button type="button" onClick={() => setOpen(false)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
    </form>
  );
}

export function ObjetivosAhorroSection() {
  const { fetchGoals, saveGoals } = useFinancePersonalStore();
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // El PUT reemplaza la lista ENTERA, así que escribir sin haberla leído la borra.
  // Un fallo de carga NO puede degradar a "no hay objetivos" (indistinguible de la
  // lista vacía): se marca y se bloquea el alta hasta que una lectura tenga éxito.
  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    void fetchGoals()
      .then((g) => { if (alive) { setGoals(g); setLoadFailed(false); } })
      .catch(() => { if (alive) { setGoals(null); setLoadFailed(true); } });
    return () => { alive = false; };
  }, [fetchGoals, reloadKey]);

  // Persiste la lista entera (PUT) y refleja el resultado validado por el backend.
  const persist = async (next: SavingsGoal[]) => {
    const prev = goals;
    if (prev === null) { toast.error('Todavía no se han cargado tus objetivos'); return; } // guard anti-borrado
    setGoals(next); // optimista
    try {
      const saved = await saveGoals(next);
      setGoals(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t save the goal');
      setGoals(prev);
      setReloadKey((k) => k + 1);
    }
  };

  const totals = useMemo(() => {
    const list = goals ?? [];
    const target = list.reduce((s, g) => s + g.target, 0);
    const saved = list.reduce((s, g) => s + Math.min(g.saved, g.target), 0);
    return { target, saved, pct: target > 0 ? Math.round((saved / target) * 100) : 0, count: list.length };
  }, [goals]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Target size={16} style={{ color: 'var(--info)' }} /> Objetivos de ahorro
        </div>
        {totals.count > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {fmtMoney(totals.saved)} de {fmtMoney(totals.target)} · {totals.pct}%
          </div>
        )}
      </div>

      {goals === null ? (
        loadFailed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-dim)', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)' }}>
            <span>No se han podido cargar tus objetivos de ahorro. No se puede crear ni editar hasta leerlos (guardar reemplaza la lista entera).</span>
            <button onClick={() => setReloadKey((k) => k + 1)} style={{ marginLeft: 'auto', padding: '5px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>Reintentar</button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading goals…</div>
        )
      ) : goals.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)' }}>
          Marca metas de ahorro (un viaje, un colchón de emergencia…) y sigue tu progreso. Apunta cuánto llevas ahorrado y la app calcula lo que falta y los días restantes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {goals.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              onPatch={(updated) => void persist(goals.map((x) => (x.id === g.id ? updated : x)))}
              onDelete={() => void persist(goals.filter((x) => x.id !== g.id))}
            />
          ))}
        </div>
      )}

      {goals !== null && (
        <AddGoal onAdd={(g) => {
          // id provisional local (el backend lo confirma/regenera si hace falta).
          const id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
          void persist([...goals, { ...g, id }]);
        }} />
      )}
    </div>
  );
}
