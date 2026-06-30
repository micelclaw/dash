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

// P3 — Nuevo movimiento (la pantalla clave). D13: lenguaje llano, sin débito/haber.
// Segmented Gasto/Ingreso/Transferencia → el backend construye la partida doble.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useFinancePersonalStore, reconstructMovement, type MovementKind, type RecurrenceInterval, type FinanceTransaction } from '@/stores/finance-personal.store';
import { todayISO } from './lib';
import { useEscapeClose } from '../use-escape-close';

const KINDS: { id: MovementKind; label: string; glyph: string }[] = [
  { id: 'expense', label: 'Gasto', glyph: '⟵' },
  { id: 'income', label: 'Ingreso', glyph: '⟶' },
  { id: 'transfer', label: 'Transferencia', glyph: '⇄' },
];

const RECURRENCE_OPTIONS: { id: RecurrenceInterval; label: string }[] = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
  { id: 'quarterly', label: 'Trimestral' },
  { id: 'semiannual', label: 'Semestral' },
  { id: 'annual', label: 'Anual' },
];

export function NuevoMovimientoDialog({ open, onClose, editTx }: { open: boolean; onClose: () => void; editTx?: FinanceTransaction | null }) {
  const { accounts, categories, createMovement, editMovement, updateMovementMetadata, createCategory } = useFinancePersonalStore();
  const [kind, setKind] = useState<MovementKind>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [recurrente, setRecurrente] = useState(false);
  const [recInterval, setRecInterval] = useState<RecurrenceInterval>('monthly');
  const [saving, setSaving] = useState(false);
  // Editar: si el movimiento NO es simple (cobro/asiento multi-pata), solo se editan
  // los campos blandos (concepto/categoría); importe/cuenta/tipo/fecha quedan bloqueados.
  const [editSimple, setEditSimple] = useState(true);
  const amountRef = useRef<HTMLInputElement>(null);
  const editing = !!editTx;
  const lockStructural = editing && !editSimple;

  const assetAccounts = accounts.filter((a) => a.type === 'asset' || a.type === 'liability');
  const kindCategories = categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));

  useEffect(() => {
    if (!open) return;
    if (editTx) {
      // Prerrellena desde el asiento existente.
      const m = reconstructMovement(editTx, accounts);
      setKind(m.kind); setAmount(m.amount); setAccountId(m.accountId); setToAccountId(m.toAccountId ?? '');
      setCategoryId(m.categoryId ?? ''); setDescription(m.description ?? ''); setDate(m.date);
      setRecurrente(false); setEditSimple(m.simple);
    } else {
      setEditSimple(true);
      if (!accountId && assetAccounts[0]) setAccountId(assetAccounts[0].id);
    }
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [open, editTx?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEscapeClose(open, onClose);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      if (editTx && lockStructural) {
        // Movimiento complejo (cobro/asiento de sistema): solo concepto + categoría.
        await updateMovementMetadata(editTx.id, { description: description || null, categoryId: kind === 'transfer' ? null : (categoryId || null) });
        toast.success('Movimiento actualizado');
      } else {
        const amt = amount.replace(',', '.').trim();
        if (!amt || Number(amt) <= 0) { toast.error('Indica un importe'); setSaving(false); return; }
        if (!accountId) { toast.error('Elige una cuenta'); setSaving(false); return; }
        if (kind === 'transfer' && !toAccountId) { toast.error('Elige la cuenta de destino'); setSaving(false); return; }
        const input = {
          kind, account_id: accountId, amount: Number(amt).toFixed(2), date,
          category_id: kind === 'transfer' ? null : (categoryId || null),
          to_account_id: kind === 'transfer' ? toAccountId : null,
          description: description || null,
          ...(recurrente && !editing ? { recurrence: { interval: recInterval } } : {}),
        };
        if (editTx) {
          await editMovement(editTx, input);
          toast.success('Movimiento actualizado');
        } else {
          await createMovement(input);
          toast.success(recurrente ? 'Movimiento recurrente creado' : 'Movimiento guardado');
        }
      }
      setAmount(''); setDescription(''); setCategoryId(''); setRecurrente(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };

  const onCreateCategory = async () => {
    const name = window.prompt('Nueva categoría');
    if (!name) return;
    const c = await createCategory({ name, kind: kind === 'income' ? 'income' : 'expense' });
    setCategoryId(c.id);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {lockStructural && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: '8px 10px', marginBottom: 14 }}>
            Este movimiento procede de una factura o asiento: solo puedes editar el concepto y la categoría. Para cambiar el importe o la cuenta, usa “Revertir” y crea uno nuevo.
          </div>
        )}

        {/* Segmented control */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)', marginBottom: 16, opacity: lockStructural ? 0.5 : 1, pointerEvents: lockStructural ? 'none' : 'auto' }}>
          {KINDS.map((k) => (
            <button key={k.id} onClick={() => setKind(k.id)} disabled={lockStructural} style={{
              flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm, 4px)', border: 'none', cursor: 'pointer', fontSize: 13,
              background: kind === k.id ? 'var(--mod-finance)' : 'transparent',
              color: kind === k.id ? '#0a0a0a' : 'var(--text-dim)', fontWeight: kind === k.id ? 600 : 500,
            }}>{k.glyph} {k.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Importe</label>
            <input ref={amountRef} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={lockStructural} inputMode="decimal" placeholder="0,00 €"
              style={{ ...fieldStyle, fontSize: 22, fontFamily: 'var(--font-mono, monospace)', textAlign: 'center', opacity: lockStructural ? 0.6 : 1 }} />
          </div>
          <div>
            <label style={labelStyle}>{kind === 'income' ? 'A la cuenta' : 'De la cuenta'}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={lockStructural} style={{ ...fieldStyle, opacity: lockStructural ? 0.6 : 1 }}>
              <option value="">— elige cuenta —</option>
              {assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {kind === 'transfer' ? (
            <div>
              <label style={labelStyle}>A la cuenta</label>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} disabled={lockStructural} style={{ ...fieldStyle, opacity: lockStructural ? 0.6 : 1 }}>
                <option value="">— elige destino —</option>
                {assetAccounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Categoría</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
                  <option value="">— sin categoría —</option>
                  {kindCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={onCreateCategory} title="Crear categoría" style={{ ...fieldStyle, width: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Nueva</button>
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Concepto</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="p.ej. Gasolina" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={lockStructural} style={{ ...fieldStyle, opacity: lockStructural ? 0.6 : 1 }} />
          </div>

          {/* Recurrente: crea una regla y materializa las ocurrencias desde la fecha hasta hoy.
              No aplica al EDITAR (se gestiona desde la regla, no desde el movimiento). */}
          {!editing && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
              <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} style={{ accentColor: 'var(--mod-finance)', cursor: 'pointer' }} />
              🔁 Recurrente
            </label>
            {recurrente && (
              <>
                <select value={recInterval} onChange={(e) => setRecInterval(e.target.value as RecurrenceInterval)} style={{ ...fieldStyle, marginTop: 8 }}>
                  {RECURRENCE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Se repetirá de forma {RECURRENCE_OPTIONS.find((o) => o.id === recInterval)?.label.toLowerCase()}; al crearlo se generan las ocurrencias desde la fecha hasta hoy.
                </div>
              </>
            )}
          </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 16px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar movimiento'}
          </button>
        </div>
      </div>
    </div>
  );
}
