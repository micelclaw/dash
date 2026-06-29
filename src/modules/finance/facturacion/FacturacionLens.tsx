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

// Lente Facturación (F2b) — contenedor de sub-pestañas [Resumen][Clientes][Facturas][Pagos]
// + acción primaria "+ Factura" (abre el editor) y "+ Cliente" (en la pestaña Clientes).
// Hermano de PersonalLens: mismo patrón Tabs + barra de acción.
//
// A4 — Deep-link + navegación intra-lente:
//   ?doc=<id>     → abre esa factura en el editor.
//   ?contact=<id> → abre la ficha rica del contacto cliente/proveedor (overlay).
// El número de factura y el nombre de contacto son clicables en todas las
// pestañas, vía el contexto FacturacionNav que provee este contenedor.
// (FinanceLauncher gestiona ?tab=facturacion; aquí NO se toca esa clave.)

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { LayoutDashboard, Users, FileText, ScrollText, FileDown, Banknote, Settings, Plus, Loader2, X } from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { useFinanceBillingStore, type FinanceRole } from '@/stores/finance-billing.store';
import { useFinanceLiveRefresh } from '../use-finance-live-refresh';
import { useEscapeClose } from '../use-escape-close';
import { FacturacionResumenTab } from './FacturacionResumenTab';
import { FacturacionClientesTab } from './FacturacionClientesTab';
import { FacturacionFacturasTab } from './FacturacionFacturasTab';
import { FacturacionPagosTab } from './FacturacionPagosTab';
import { FacturacionAjustesTab } from './FacturacionAjustesTab';
import { FacturaEditorDialog } from './FacturaEditorDialog';
import { ClienteDialog } from './ClienteDialog';
import { ClienteDetalle } from './ClienteDetalle';
import { FacturacionNavProvider } from './navigation';
import { PeriodControl } from '../period';

const SECTIONS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'clientes', label: 'Contactos', icon: Users },
  { id: 'facturas', label: 'Facturas', icon: FileText },
  { id: 'presupuestos', label: 'Presupuestos', icon: ScrollText },
  { id: 'recibidas', label: 'Recibidas', icon: FileDown },
  { id: 'pagos', label: 'Cobros', icon: Banknote },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
];

export function FacturacionLens() {
  const { refreshAll, loading, setSelectedContact } = useFinanceBillingStore();
  const [params, setParams] = useSearchParams();
  const [section, setSection] = useState('resumen');
  const [clienteOpen, setClienteOpen] = useState(false);
  const [clienteRole, setClienteRole] = useState<FinanceRole>('customer');

  // El documento abierto en el editor y el contacto abierto en la ficha se
  // controlan por query param (deep-link). undefined = cerrado; '' = nuevo doc.
  const docParam = params.get('doc');           // null | '' | <id>
  const contactParam = params.get('contact');    // null | <id>
  const dtypeParam = params.get('dtype');        // null | 'quote' | …

  // ?doc presente (aunque vacío) ⇒ editor abierto. La acción "+ Factura" pone
  // ?doc='' (nuevo); "+ Presupuesto" pone ?doc='' + ?dtype='quote'. Una factura
  // concreta pone ?doc=<id> (al editar, el editor usa el tipo del doc cargado).
  const editorOpen = docParam !== null;
  const editorDocId = docParam || undefined;
  const editorDocType = editorDocId
    ? undefined                                  // editar: prevalece el tipo del doc cargado
    : (dtypeParam === 'quote' ? 'quote' : dtypeParam === 'bill' ? 'bill' : 'invoice'); // nuevo: factura salvo dtype=quote|bill

  useEffect(() => { void refreshAll(); }, [refreshAll]);
  // Auto-refresco en vivo: si un agente/proceso cambia las finanzas o el usuario
  // vuelve a la pestaña, recarga sin esperar a un F5 (evita ver datos viejos/vacíos).
  useFinanceLiveRefresh(refreshAll);

  // Helper: muta SOLO la(s) clave(s) indicada(s) sin pisar ?tab ni el resto.
  const patchParams = useCallback((mut: (p: URLSearchParams) => void) => {
    setParams((prev) => { const next = new URLSearchParams(prev); mut(next); return next; }, { replace: true });
  }, [setParams]);

  const openInvoice = useCallback((docId: string) => {
    patchParams((p) => { p.set('doc', docId); p.delete('contact'); });
  }, [patchParams]);

  const openContact = useCallback((contactId: string) => {
    setSelectedContact(contactId);
    patchParams((p) => { p.set('contact', contactId); p.delete('doc'); });
  }, [patchParams, setSelectedContact]);

  const openNewInvoice = useCallback(() => {
    patchParams((p) => { p.set('doc', ''); p.delete('dtype'); p.delete('contact'); });
  }, [patchParams]);

  const openNewQuote = useCallback(() => {
    patchParams((p) => { p.set('doc', ''); p.set('dtype', 'quote'); p.delete('contact'); });
  }, [patchParams]);

  const openNewBill = useCallback(() => {
    patchParams((p) => { p.set('doc', ''); p.set('dtype', 'bill'); p.delete('contact'); });
  }, [patchParams]);

  const openNewSupplier = useCallback(() => { setClienteRole('supplier'); setClienteOpen(true); }, []);
  const openNewCustomer = useCallback(() => { setClienteRole('customer'); setClienteOpen(true); }, []);

  const closeEditor = useCallback(() => { patchParams((p) => { p.delete('doc'); p.delete('dtype'); }); }, [patchParams]);
  const closeContact = useCallback(() => { patchParams((p) => p.delete('contact')); }, [patchParams]);
  // Escape cierra la ficha del contacto (overlay), pero no mientras el editor de
  // factura esté abierto encima (el editor no se cierra con Escape, a propósito).
  useEscapeClose(!!contactParam && !editorOpen, closeContact);

  return (
    <FacturacionNavProvider value={{ openInvoice, openNewQuote, openNewBill, openContact }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
          {/* A2 — sub-pestañas con peso SECUNDARIO: fila más pequeña y sutil que
              el selector de lente del header. La clase `fact-subtabs` afina la
              primitiva Tabs sin editarla (font más pequeña, alto menor, subrayado
              fino, inactivos más atenuados). */}
          <Tabs className="fact-subtabs" tabs={SECTIONS} activeTab={section} onChange={setSection} variant="underline" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Selector de periodo (solo en Resumen): conduce TODO el resumen. */}
            {section === 'resumen' && <PeriodControl />}
            {section === 'clientes' && (
              <button onClick={openNewCustomer} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Plus size={15} /> Contacto
              </button>
            )}
            {section === 'recibidas' && (
              <button onClick={openNewSupplier} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Plus size={15} /> Proveedor
              </button>
            )}
            {section === 'presupuestos' ? (
              <button onClick={openNewQuote} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Plus size={15} /> Presupuesto
              </button>
            ) : section === 'recibidas' ? (
              // Acción sobria (no el ámbar de "venta"): registrar una factura recibida.
              <button onClick={openNewBill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Plus size={15} /> Factura recibida
              </button>
            ) : (
              <button onClick={openNewInvoice} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Plus size={15} /> Factura
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', top: 10, right: 16, color: 'var(--text-muted)' }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /></div>
          )}
          {section === 'resumen' && <FacturacionResumenTab />}
          {section === 'clientes' && <FacturacionClientesTab />}
          {section === 'facturas' && <FacturacionFacturasTab />}
          {section === 'presupuestos' && <FacturacionFacturasTab lockedType="quote" />}
          {section === 'recibidas' && <FacturacionFacturasTab lockedType="bill" />}
          {section === 'pagos' && <FacturacionPagosTab />}
          {section === 'ajustes' && <FacturacionAjustesTab />}
        </div>

        <FacturaEditorDialog open={editorOpen} onClose={closeEditor} documentId={editorDocId} docType={editorDocType} />
        <ClienteDialog open={clienteOpen} onClose={() => setClienteOpen(false)} role={clienteRole} />

        {/* A5 — ficha rica del contacto como overlay (deep-link ?contact=) */}
        {contactParam && (
          <div onClick={closeContact} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 380, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
              <button onClick={closeContact} aria-label="Cerrar" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 1 }}><X size={18} /></button>
              <ClienteDetalle contactId={contactParam} onOpenInvoice={openInvoice} />
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          /* A2 — sub-pestañas de Facturación: peso visual secundario. Afina la
             primitiva Tabs (underline) sin editarla; los !important pisan los
             estilos inline de la primitiva sin tocar su lógica activo/inactivo. */
          .fact-subtabs > a, .fact-subtabs > button {
            font-size: 0.75rem !important;        /* 12px: < que los 13px del header */
            padding: 7px 12px !important;          /* fila más baja y compacta */
            letter-spacing: 0.01em;
          }
          .fact-subtabs > a:not(:hover), .fact-subtabs > button:not(:hover) {
            opacity: 0.92;                          /* leve atenuación general */
          }
          .fact-subtabs > a > svg, .fact-subtabs > button > svg {
            width: 14px !important;                 /* icono más pequeño */
            height: 14px !important;
            opacity: 0.85;
          }
        `}</style>
      </div>
    </FacturacionNavProvider>
  );
}
