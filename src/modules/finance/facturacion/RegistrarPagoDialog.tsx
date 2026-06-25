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

// F4/F5/F6 — Registrar cobro: modal de pago sobre un documento. Importe
// pre-rellenado al pendiente, cuenta de ingreso (de GET /finance/accounts),
// método y referencia. Llama store.recordPayment.
// Molde = NuevoMovimientoDialog.tsx de la lente Personal.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { useFinanceBillingStore, type FinanceDocDetail } from '@/stores/finance-billing.store';
import { fmtMoney, todayISO } from '@/modules/finance/personal/lib';

interface AccountOption {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: string;
}

const METHODS: { id: string; label: string }[] = [
  { id: 'transfer', label: 'Transferencia' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'cash', label: 'Efectivo' },
  { id: 'direct_debit', label: 'Domiciliación' },
  { id: 'other', label: 'Otro' },
];

export function RegistrarPagoDialog({
  open,
  onClose,
  document,
}: {
  open: boolean;
  onClose: () => void;
  document: FinanceDocDetail;
}) {
  const { recordPayment } = useFinanceBillingStore();
  // Una factura RECIBIDA (bill) es un PAGO saliente a proveedor; el resto, un cobro.
  const isBill = document.type === 'bill';

  // Pendiente = total − cobrado.
  const paid = document.payments.reduce((s, p) => s + Number(p.amount), 0);
  const pending = Math.max(0, Number(document.total) - paid);

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [amount, setAmount] = useState(pending.toFixed(2));
  const [accountId, setAccountId] = useState('');
  const [method, setMethod] = useState('transfer');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(pending.toFixed(2));
    setReference('');
    setMethod('transfer');
    setDate(todayISO());
    setTimeout(() => amountRef.current?.focus(), 50);
    void (async () => {
      try {
        const r = await api.get<{ data: AccountOption[] }>('/finance/accounts');
        // Cobro: cuentas de tesorería donde ENTRA el dinero (banco/efectivo).
        // Pago a proveedor: de dónde SALE → también tarjeta de crédito (pasivo).
        const treasury = r.data.filter((a) => isBill ? (a.type === 'asset' || a.type === 'liability') : a.type === 'asset');
        setAccounts(treasury);
        if (treasury[0]) setAccountId(treasury[0].id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las cuentas');
      }
    })();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const submit = async () => {
    const amt = amount.replace(',', '.').trim();
    if (!amt || Number(amt) <= 0) { toast.error('Indica un importe'); return; }
    if (Number(amt) > pending + 0.005) { toast.error('El importe supera el pendiente'); return; }
    if (!accountId) { toast.error(isBill ? 'Elige la cuenta de pago' : 'Elige la cuenta del cobro'); return; }
    setSaving(true);
    try {
      await recordPayment({
        document_id: document.id,
        amount: Number(amt).toFixed(2),
        account_id: accountId,
        date,
        method,
        reference: reference || undefined,
      });
      toast.success(isBill ? 'Pago registrado' : 'Cobro registrado');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (isBill ? 'No se pudo registrar el pago' : 'No se pudo registrar el cobro'));
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 410, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{isBill ? 'Registrar pago a proveedor' : 'Registrar cobro'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {document.number ?? 'Borrador'} · Pendiente <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--info)' }}>{fmtMoney(pending, document.currency)}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Importe</label>
            <input ref={amountRef} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00"
              style={{ ...fieldStyle, fontSize: 22, fontFamily: 'var(--font-mono, monospace)', textAlign: 'center' }} />
          </div>
          <div>
            <label style={labelStyle}>{isBill ? 'Pagar desde' : 'Cuenta del cobro'}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={fieldStyle}>
              <option value="">— elige cuenta —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Método</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={fieldStyle}>
              {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Referencia (opcional)</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="p.ej. nº de transferencia" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 16px', background: isBill ? 'var(--mod-finance)' : 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Guardando…' : (isBill ? 'Registrar pago' : 'Registrar cobro')}
          </button>
        </div>
      </div>
    </div>
  );
}
