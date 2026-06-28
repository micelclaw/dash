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

// A4 — Navegación intra-lente de Facturación. Un contexto ligero que permite a
// cualquier sub-pestaña (Resumen / Facturas / Pagos / Clientes) abrir una
// factura por id (en el editor) o la ficha de un contacto por id, sin
// prop-drilling. Lo provee FacturacionLens (que es quien posee los diálogos /
// overlays + el deep-link ?doc=/?contact=).

import { createContext, useContext } from 'react';

export interface FacturacionNav {
  /** Abre la factura/documento por id en el editor. */
  openInvoice: (docId: string) => void;
  /** Abre el editor en modo "nuevo presupuesto". */
  openNewQuote: () => void;
  /** Abre el editor en modo "nueva factura recibida" (compra, type='bill'). */
  openNewBill: () => void;
  /** Abre la ficha rica del contacto cliente/proveedor por id. */
  openContact: (contactId: string) => void;
}

const noop = () => {};
const FacturacionNavContext = createContext<FacturacionNav>({ openInvoice: noop, openNewQuote: noop, openNewBill: noop, openContact: noop });

export const FacturacionNavProvider = FacturacionNavContext.Provider;

export function useFacturacionNav(): FacturacionNav {
  return useContext(FacturacionNavContext);
}
