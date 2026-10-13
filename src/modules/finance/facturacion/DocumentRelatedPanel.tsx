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

// O9 — Panel "Related to this invoice": completa la narrativa del documento con
// el CONTACTO, la CORRESPONDENCIA (emails enviados/recibidos con esa gente sobre el
// tema), los PRODUCTOS de inventario (relación derivada, tier secundario) y los PAGOS.
// Consume GET /finance/documents/:id/related (getDocumentRelated). Reutiliza
// resolveEntity para icono/color/ruta de cada tipo.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Boxes, Users, ArrowDownLeft, ArrowUpRight, Banknote } from 'lucide-react';
import { useFinanceBillingStore, type DocRelated } from '@/stores/finance-billing.store';
import { fmtMoney, fmtDate } from '../lib/format';
import { refSectionTitle as sectionTitle, refRowBase as rowBase, clickable, hoverBg } from '../lib/refs';

export function DocumentRelatedPanel({ documentId, onOpenContact }: { documentId: string; onOpenContact: (contactId: string) => void }) {
  const { fetchDocumentRelated } = useFinanceBillingStore();
  const [data, setData] = useState<DocRelated | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    void fetchDocumentRelated(documentId).then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [documentId, fetchDocumentRelated]);

  if (!data) return null;
  const hasAny = !!data.contact || data.emails.length > 0 || data.inventory.length > 0 || data.payments.length > 0;
  if (!hasAny) return null;

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Related to this invoice</div>

      {/* Contacto (cliente/proveedor) — relación principal. */}
      {data.contact && (
        <div>
          <div style={sectionTitle}>Contact</div>
          <div {...clickable(() => onOpenContact(data.contact!.id))} {...hoverBg}
            style={{ ...rowBase, margin: '0 -8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'color-mix(in srgb, var(--mod-contacts, #6366f1) 16%, transparent)', flexShrink: 0 }}>
              <Users size={14} style={{ color: 'var(--mod-contacts, #6366f1)' }} />
            </span>
            <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{data.contact.name}</span>
            {data.contact.email && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{data.contact.email}</span>}
          </div>
        </div>
      )}

      {/* Correspondencia: emails con el contacto (contratación, forma de pago…). */}
      {data.emails.length > 0 && (
        <div>
          <div style={sectionTitle}>Correspondencia · {data.emails.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.emails.map((e) => (
              <div key={e.id} {...clickable(() => navigate(`/mail?id=${e.id}`))} {...hoverBg}
                title={e.from_address}
                style={{ ...rowBase, margin: '0 -8px' }}>
                <Mail size={13} style={{ color: 'var(--mod-mail, #0ea5e9)', flexShrink: 0 }} />
                {e.direction === 'received'
                  ? <ArrowDownLeft size={12} style={{ color: 'var(--mod-finance)', flexShrink: 0 }} aria-label="recibido" />
                  : <ArrowUpRight size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} aria-label="enviado" />}
                <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.subject || '(sin asunto)'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtDate(e.received_at, { year: false })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos de inventario — relación DERIVADA (la factura los contiene), tier secundario. */}
      {data.inventory.length > 0 && (
        <div style={{ opacity: 0.85 }}>
          <div style={sectionTitle}>Productos de esta factura · {data.inventory.length}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.inventory.map((it) => (
              <div key={it.item_id} {...clickable(() => navigate(`/inventory?id=${it.item_id}`))} {...hoverBg}
                title={`${it.relation === 'sold' ? 'vendido' : it.relation === 'purchased' ? 'comprado' : ''} · ${it.quantity}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
                <Boxes size={12} style={{ color: 'var(--mod-inventory, #f59e0b)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{it.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>×{it.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagos registrados de esta factura. */}
      {data.payments.length > 0 && (
        <div>
          <div style={sectionTitle}>Pagos · {data.payments.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {data.payments.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Banknote size={13} style={{ color: 'var(--mod-finance)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.account_name ?? 'Account'} · {fmtDate(p.date, { year: false })}</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)', flexShrink: 0 }}>{fmtMoney(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
