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

// P2b — Diálogo de alta/edición de una cuenta-monedero (lente Personal).
// Solo gestiona monederos: asset (Banco/Efectivo) y liability (Tarjeta/Préstamo).
// Las cuentas equity/income/expense son de sistema y NO se ofrecen aquí.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useFinancePersonalStore, type FinanceAccount } from '@/stores/finance-personal.store';

type WalletType = 'asset' | 'liability';

const TYPES: { id: WalletType; label: string }[] = [
  { id: 'asset', label: 'Banco / Efectivo' },
  { id: 'liability', label: 'Tarjeta / Préstamo' },
];

const SUBTYPES: Record<WalletType, { id: string; label: string }[]> = {
  asset: [
    { id: 'bank', label: 'Cuenta bancaria' },
    { id: 'cash', label: 'Efectivo' },
    { id: 'savings', label: 'Ahorro' },
    { id: 'other', label: 'Otro' },
  ],
  liability: [
    { id: 'credit_card', label: 'Tarjeta de crédito' },
    { id: 'loan', label: 'Préstamo' },
    { id: 'other', label: 'Otro' },
  ],
};

const CURRENCIES: { id: string; label: string }[] = [
  { id: 'EUR', label: '€ Euro' },
  { id: 'USD', label: '$ Dólar' },
  { id: 'GBP', label: '£ Libra' },
];

export function CuentaDialog({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  account?: FinanceAccount | null;
  onClose: () => void;
  onSaved?: (a: FinanceAccount) => void;
}) {
  const { createAccount, updateAccount } = useFinancePersonalStore();
  const isEdit = !!account;

  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('asset');
  const [subtype, setSubtype] = useState('bank');
  const [currency, setCurrency] = useState('EUR');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Prefill al abrir (crear → valores por defecto; editar → cuenta).
  useEffect(() => {
    if (!open) return;
    if (account) {
      const t: WalletType = account.type === 'liability' ? 'liability' : 'asset';
      setName(account.name);
      setType(t);
      setSubtype(account.subtype || SUBTYPES[t][0].id);
      setCurrency(account.currency || 'EUR');
      setIsActive(account.is_active);
    } else {
      setName('');
      setType('asset');
      setSubtype('bank');
      setCurrency('EUR');
      setIsActive(true);
    }
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [open, account]);

  if (!open) return null;

  const onChangeType = (t: WalletType) => {
    setType(t);
    // El subtipo depende del tipo: si el actual no es válido, cae al primero.
    if (!SUBTYPES[t].some((s) => s.id === subtype)) setSubtype(SUBTYPES[t][0].id);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Indica un nombre'); return; }
    setSaving(true);
    try {
      let result: FinanceAccount;
      if (isEdit && account) {
        result = await updateAccount(account.id, { name: trimmed, type, subtype, currency, is_active: isActive });
        toast.success('Cuenta actualizada');
      } else {
        result = await createAccount({ name: trimmed, type, subtype, currency });
        toast.success('Cuenta creada');
      }
      onSaved?.(result);
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

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{isEdit ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Nombre</label>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="p.ej. Cuenta nómina" style={fieldStyle} />
          </div>

          <div>
            <label style={labelStyle}>Tipo</label>
            {/* Segmented control */}
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg)', borderRadius: 'var(--radius-md, 6px)' }}>
              {TYPES.map((t) => (
                <button key={t.id} onClick={() => onChangeType(t.id)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm, 4px)', border: 'none', cursor: 'pointer', fontSize: 13,
                  background: type === t.id ? 'var(--mod-finance)' : 'transparent',
                  color: type === t.id ? '#0a0a0a' : 'var(--text-dim)', fontWeight: type === t.id ? 600 : 500,
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Subtipo</label>
            <select value={subtype} onChange={(e) => setSubtype(e.target.value)} style={fieldStyle}>
              {SUBTYPES[type].map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Divisa</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={fieldStyle}>
              {CURRENCIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ accentColor: 'var(--mod-finance)', cursor: 'pointer' }} />
              Cuenta activa
            </label>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 16px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
