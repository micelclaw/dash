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

// F2b — Fuente única de la semántica de color/etiqueta de los estados de
// documento (factura/presupuesto/abono). Antes estaba duplicada en cada
// pestaña (Resumen/Facturas/Pagos/Clientes); centralizada aquí para que el
// color de cada estado sea idéntico en toda la lente Facturación.
//
// Mapa semántico (sobrio, no arcoíris):
//   Pagada   → verde   (--mod-finance)   éxito / cobrado
//   Enviada  → azul    (--info)          en curso, esperando cobro
//   Aceptada → azul    (--info)          presupuesto aceptado, en curso
//   Rechazada → rojo   (--error)         presupuesto rechazado
//   Parcial  → ámbar   (--warning)       cobro a medias, atención
//   Vencida  → rojo    (--error)         fuera de plazo
//   Borrador → gris    (--text-muted)    sin emitir
//   Convertida / Anulada → gris          terminal sin acción

import type { CSSProperties } from 'react';
import type { DocStatus, DocType } from '@/stores/finance-billing.store';

export interface StatusMeta {
  label: string;
  /** Color de acento (token CSS) usado para texto + tinte de la pastilla. */
  color: string;
}

export const STATUS_META: Record<DocStatus, StatusMeta> = {
  paid: { label: 'Paid', color: 'var(--mod-finance)' },
  sent: { label: 'Sent', color: 'var(--info)' },
  accepted: { label: 'Accepted', color: 'var(--info)' },
  declined: { label: 'Rejected', color: 'var(--error)' },
  partial: { label: 'Partial', color: 'var(--warning)' },
  overdue: { label: 'Overdue', color: 'var(--error)' },
  draft: { label: 'Draft', color: 'var(--text-muted)' },
  converted: { label: 'Converted', color: 'var(--text-muted)' },
  cancelled: { label: 'Voided', color: 'var(--text-muted)' },
};

// Etiqueta contextual por tipo de documento. STATUS_META queda agnóstico de color;
// solo la etiqueta visible cambia para una factura RECIBIDA (bill): 'sent' no es
// "Sent" (no la envías, la registras) y 'paid' es "Paid" (no "Paid").
export function statusLabel(status: DocStatus, docType?: DocType): string {
  if (docType === 'bill') {
    if (status === 'sent') return 'Recorded';
    if (status === 'partial') return 'Partial payment';
    if (status === 'overdue') return 'Overdue'; // pago al proveedor fuera de plazo
  }
  return STATUS_META[status].label;
}

export function statusColor(status: DocStatus): string {
  return STATUS_META[status].color;
}

/** Estilo de pastilla tintada (chip) para un color de acento dado. */
export function tintedPillStyle(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    color,
    background: `color-mix(in srgb, ${color} 16%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
  };
}
