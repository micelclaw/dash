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

// P2 — Cuentas: lista (izq) + movimientos de la cuenta seleccionada (der).

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useFinancePersonalStore, type AccountType, type FinanceAccount } from '@/stores/finance-personal.store';
import { fmtMoney, movementFace, categoryVisual, tintBackground } from './lib';
import { CuentaDialog } from './CuentaDialog';
import { usePersonalNav } from './navigation';
import { RecurrenceBadge } from './RecurrenceBadge';

const TYPE_LABEL: Record<AccountType, string> = { asset: 'Banco/Efectivo', liability: 'Tarjeta/Préstamo', equity: 'Patrimonio', income: 'Ingresos', expense: 'Gastos' };

export function CuentasTab() {
  const { accounts, transactions, categories, selectedAccountId, setSelectedAccount, fetchTransactions, deleteAccount } = useFinancePersonalStore();
  const { openMovement } = usePersonalNav();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const userAccounts = accounts.filter((a) => a.type === 'asset' || a.type === 'liability');
  const catById = new Map(categories.map((c) => [c.id, c]));
  const selected = accounts.find((a) => a.id === selectedAccountId) ?? userAccounts[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedAccountId) setSelectedAccount(selected.id);
    if (selected) void fetchTransactions({ account_id: selected.id });
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditingAccount(null); setDialogOpen(true); };
  const openEdit = (a: FinanceAccount) => { setEditingAccount(a); setDialogOpen(true); };

  const onDelete = async (a: FinanceAccount) => {
    if (!window.confirm(`¿Borrar la cuenta «${a.name}»? Sus movimientos no se eliminan.`)) return;
    try {
      await deleteAccount(a.id);
      toast.success('Cuenta borrada');
      // Selecciona la primera cuenta restante (excluyendo la borrada).
      const remaining = accounts.filter((x) => x.id !== a.id && (x.type === 'asset' || x.type === 'liability'));
      setSelectedAccount(remaining[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 360 }}>
      {/* Lista de cuentas */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 12 }}>
        {userAccounts.map((a) => {
          const active = a.id === selected?.id;
          const inactive = !a.is_active;
          return (
            <button key={a.id} onClick={() => setSelectedAccount(a.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
              background: active ? 'var(--surface-hover)' : 'transparent', border: '1px solid', borderColor: active ? 'var(--mod-finance)' : 'var(--border)',
              borderRadius: 'var(--radius-md, 6px)', display: 'flex', flexDirection: 'column', gap: 2,
              opacity: inactive ? 0.55 : 1,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{a.name}</span>
                {inactive && <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full, 999px)', padding: '0 6px', lineHeight: '16px' }}>inactiva</span>}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: Number(a.balance) < 0 ? 'var(--error)' : 'var(--text)' }}>{fmtMoney(a.balance, a.currency)}</span>
            </button>
          );
        })}
        <button onClick={openCreate} style={{ width: '100%', padding: '8px 12px', marginTop: 4, cursor: 'pointer', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Plus size={14} /> Cuenta
        </button>
      </div>

      {/* Detalle de la cuenta */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!selected && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Crea una cuenta para empezar.</div>}
        {selected && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{selected.name}</div>
                  {!selected.is_active && <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full, 999px)', padding: '1px 8px' }}>inactiva</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{TYPE_LABEL[selected.type]}{selected.subtype ? ` · ${selected.subtype}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <button onClick={() => openEdit(selected)} title="Editar cuenta" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}>
                  <Pencil size={13} /> Editar
                </button>
                <button onClick={() => onDelete(selected)} title="Borrar cuenta" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--error)', cursor: 'pointer', fontSize: 12 }}>
                  <Trash2 size={13} /> Borrar
                </button>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: Number(selected.balance) < 0 ? 'var(--error)' : 'var(--text)' }}>{fmtMoney(selected.balance, selected.currency)}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {transactions.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Sin movimientos en esta cuenta.</div>}
              {transactions.map((tx) => {
                const f = movementFace(tx, accounts);
                const cat = f.categoryId ? catById.get(f.categoryId) : undefined;
                const cv = !f.isTransfer && cat ? categoryVisual(cat) : null;
                return (
                  <div key={tx.id} role="button" tabIndex={0}
                    title="Ver movimiento"
                    onClick={() => openMovement(tx)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', margin: '0 -6px', borderRadius: 'var(--radius-sm, 4px)', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 12, cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', minWidth: 0 }}>
                      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', flexShrink: 0, fontSize: 13, background: cv ? tintBackground(cv.color) : 'var(--surface-hover)' }}>{cv ? cv.emoji : f.glyph}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || (f.isTransfer ? 'Transferencia' : 'Movimiento')}</span>
                      {tx.recurring_rule_id && <RecurrenceBadge compact />}
                    </span>
                    <span style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cv ? cv.name : ''}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{tx.date}</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', color: f.signed >= 0 ? 'var(--mod-finance)' : 'var(--text)' }}>{f.signed >= 0 ? '+' : ''}{fmtMoney(f.signed)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <CuentaDialog
        open={dialogOpen}
        account={editingAccount}
        onClose={() => setDialogOpen(false)}
        onSaved={(a) => setSelectedAccount(a.id)}
      />
    </div>
  );
}
