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

// O9 — Relaciones DERIVADAS de un movimiento (asiento): su(s) cuenta(s) + la factura
// (si la hay) + el contacto. Salen del propio ledger (GET /finance/journal-entries/:id/
// related), no de entity_links → todo movimiento muestra al menos su cuenta.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Wallet, Receipt, Users } from 'lucide-react';
import { api } from '@/services/api';
import { refChipBase as chipBase, refSectionTitle, clickable } from '../lib/refs';

interface JeRelated {
  accounts: Array<{ account_id: string; code: string | null; name: string; side: 'debit' | 'credit'; amount: string }>;
  document: { id: string; number: string | null; type: string } | null;
  contact: { id: string; name: string } | null;
}

const docLabel = (type: string, number: string | null) => {
  const base = type === 'bill' ? 'Factura recibida' : type === 'credit_note' ? 'Credit note' : type === 'quote' ? 'Quote' : 'Invoice';
  return number ? `${base} ${number}` : base;
};

export function MovimientoRelatedPanel({ entryId, onNavigate }: { entryId: string; onNavigate?: () => void }) {
  const [data, setData] = useState<JeRelated | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    void api.get<{ data: JeRelated }>(`/finance/journal-entries/${entryId}/related`)
      .then((r) => { if (alive) setData(r.data); }).catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [entryId]);

  if (!data || (data.accounts.length === 0 && !data.document && !data.contact)) return null;
  const go = (url: string) => { navigate(url); onNavigate?.(); };
  const pointer: React.CSSProperties = { cursor: 'pointer' };

  return (
    <div>
      <div style={{ ...refSectionTitle, marginBottom: 7 }}>Related</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.contact && (
          <div {...clickable(() => go(`/finance?tab=facturacion&contact=${data.contact!.id}`))} title="Abrir contacto"
            style={{ ...chipBase, ...pointer, color: 'var(--text)' }}>
            <Users size={12} style={{ color: 'var(--mod-contacts, #6366f1)' }} />{data.contact.name}
          </div>
        )}
        {data.document && (
          <div {...clickable(() => go(`/finance?tab=facturacion&doc=${data.document!.id}`))} title="Abrir factura"
            style={{ ...chipBase, ...pointer, color: 'var(--text)' }}>
            <Receipt size={12} style={{ color: 'var(--mod-finance)' }} />{docLabel(data.document.type, data.document.number)}
          </div>
        )}
        {data.accounts.map((a) => (
          <div key={a.account_id} title={`${a.side === 'debit' ? 'Debit' : 'Credit'} ${a.amount} €`}
            style={{ ...chipBase, color: 'var(--text-dim)' }}>
            <Wallet size={12} style={{ color: 'var(--mod-finance)' }} />
            {a.code ? <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>{a.code}</span> : null}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
