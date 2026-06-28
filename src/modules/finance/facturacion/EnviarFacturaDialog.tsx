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

// F2c — Diálogo de envío de una factura por email. Recibe el documento ya
// guardado/emitido y (opcionalmente) el detalle del contacto cliente para
// prefill del destinatario (FinanceContactDetail.emails[0]). Al abrir carga las
// cuentas de correo del usuario (GET /finance/email-accounts) y deja elegir la
// emisora (preselecciona la is_default). Si no hay cuentas, lo dice claramente
// y enlaza a Mail para añadir una. Envío → sendInvoice(doc.id, {to, subject,
// message, account_id}). Molde de estilos = FacturaEditorDialog / ClienteDialog.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Send, Loader2, Mail, ExternalLink } from 'lucide-react';
import {
  useFinanceBillingStore,
  type EmailAccount,
  type FinanceDoc,
  type FinanceContactDetail,
} from '@/stores/finance-billing.store';
import { useEscapeClose } from '../use-escape-close';

/** Primer email conocido del contacto cliente. */
function firstContactEmail(contact: FinanceContactDetail | null | undefined): string {
  if (!contact) return '';
  const e = (contact.emails ?? []).find((x) => x && x.trim());
  return e ? e.trim() : '';
}

export function EnviarFacturaDialog({
  open,
  onClose,
  document: doc,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  document: FinanceDoc | null;
  contact?: FinanceContactDetail | null;
}) {
  const { fetchEmailAccounts, sendInvoice } = useFinanceBillingStore();

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const toRef = useRef<HTMLInputElement>(null);

  const docNumber = doc?.number ?? 'borrador';

  // Carga de cuentas + prefill al abrir.
  useEffect(() => {
    if (!open || !doc) return;
    const prefillTo = firstContactEmail(contact);
    setTo(prefillTo);
    setSubject(`Factura ${docNumber}`);
    setMessage(
      `Hola,\n\nAdjunto la factura ${docNumber}.\n\nUn saludo.`,
    );
    setLoadingAccounts(true);
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchEmailAccounts();
        if (cancelled) return;
        setAccounts(list);
        const def = list.find((a) => a.is_default) ?? list[0];
        setAccountId(def?.id ?? '');
      } catch (e) {
        if (!cancelled) {
          setAccounts([]);
          toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las cuentas de correo');
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    setTimeout(() => toRef.current?.focus(), 50);
    return () => { cancelled = true; };
  }, [open, doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEscapeClose(open, onClose);

  if (!open || !doc) return null;

  const noAccounts = !loadingAccounts && accounts.length === 0;
  const canSend = !sending && !loadingAccounts && accounts.length > 0 && to.trim().length > 0;

  const onSend = async () => {
    const recipient = to.trim();
    if (!recipient) { toast.error('Indica un destinatario'); return; }
    if (!accountId) { toast.error('Elige una cuenta emisora'); return; }
    setSending(true);
    try {
      const r = await sendInvoice(doc.id, {
        to: recipient,
        subject: subject.trim() || undefined,
        message: message.trim() || undefined,
        account_id: accountId,
      });
      toast.success(`Factura enviada a ${r.to?.join(', ') || recipient}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el email');
    } finally {
      setSending(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 450, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} style={{ color: 'var(--mod-finance)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Enviar factura {doc.number ? `${doc.number}` : ''}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {noAccounts ? (
          <div style={{ padding: '20px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', textAlign: 'center' }}>
            <Mail size={22} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>No tienes cuentas de correo configuradas</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Para enviar facturas por email necesitas una cuenta emisora. Añade una en Mail.
            </div>
            <a href="/mail" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--mod-finance)', borderRadius: 'var(--radius-md, 6px)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              <ExternalLink size={14} /> Ir a Mail
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Cuenta emisora */}
            <div>
              <label style={labelStyle}>Cuenta emisora</label>
              {loadingAccounts ? (
                <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando cuentas…
                </div>
              ) : (
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={fieldStyle}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email_address}{a.display_name ? ` (${a.display_name})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Destinatario */}
            <div>
              <label style={labelStyle}>Destinatario</label>
              <input ref={toRef} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="cliente@empresa.com" style={fieldStyle} />
            </div>

            {/* Asunto */}
            <div>
              <label style={labelStyle}>Asunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`Factura ${docNumber}`} style={fieldStyle} />
            </div>

            {/* Mensaje */}
            <div>
              <label style={labelStyle}>Mensaje</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button
            onClick={onSend}
            disabled={!canSend}
            style={{
              padding: '8px 18px', background: canSend ? 'var(--mod-finance)' : 'var(--card)', border: 'none',
              borderRadius: 'var(--radius-md, 6px)', color: canSend ? '#fff' : 'var(--text-muted)',
              cursor: canSend ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            Enviar
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
