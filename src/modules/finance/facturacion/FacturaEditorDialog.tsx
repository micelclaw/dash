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

// F4/F5/F6 — Editor de factura (la pantalla más importante): selector de Cliente
// (de store.contacts + "+ Nuevo cliente"), tabla de líneas (descripción, cantidad,
// precio, IVA por línea con su modo inc/exc visible, importe), "+ Línea", panel de
// TOTALES en vivo (Base / Descuento / IVA / TOTAL desde el doc tras addLine→fetch),
// y acciones [Save draft] + [Emitir y enviar]. El nº es provisional.
// Molde = NuevoMovimientoDialog.tsx de la lente Personal.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Plus, Trash2, Loader2, FileDown, Send, Eye, FileText, Paperclip } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  useFinanceBillingStore,
  type DocLineInput,
  type DocType,
  type DiscountKind,
  type FinanceDocDetail,
  type FinanceContactDetail,
} from '@/stores/finance-billing.store';
import { useFinancePersonalStore } from '@/stores/finance-personal.store';
import { api } from '@/services/api';
import { fmtMoney, todayISO } from '@/modules/finance/personal/lib';
import { ClienteDialog } from './ClienteDialog';
import { InventoryItemSelect } from '@/components/inventory/InventoryItemSelect';
import { RelationIntelligence } from '@/components/shared/RelationIntelligence';
import { EnviarFacturaDialog } from './EnviarFacturaDialog';
import { openInvoicePdf } from './invoicePdf';
import { useFacturacionNav } from './navigation';
import { DocumentRelatedPanel } from './DocumentRelatedPanel';
import { Tip } from '../lib/glossary';

interface DraftLine {
  id?: string; // id de la línea persistida (undefined = nueva, aún no guardada)
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate_id: string; // '' = sin IVA
  discount_value: string; // texto del input ('' = sin descuento de línea)
  discount_kind: 'percent' | 'fixed'; // default 'percent'
  category_id: string; // '' = sin categoría (solo facturas recibidas / compras)
  inventory_item_id: string; // '' = sin artículo vinculado (cruce con Inventory)
  is_capital: boolean; // bien de inversión → capitaliza (Inmovilizado) en vez de gasto
}

function emptyLine(): DraftLine {
  return { description: '', quantity: '1', unit_price: '', tax_rate_id: '', discount_value: '', discount_kind: 'percent', category_id: '', inventory_item_id: '', is_capital: false };
}

export function FacturaEditorDialog({
  open,
  onClose,
  documentId,
  docType,
}: {
  open: boolean;
  onClose: () => void;
  documentId?: string;
  /** Tipo del documento al CREAR uno nuevo (default 'invoice'). Al editar se
   *  ignora: prevalece el tipo del doc cargado. */
  docType?: DocType;
}) {
  const isMobile = useIsMobile();
  const {
    contacts,
    taxRates,
    createDocument,
    updateDocument,
    addLine,
    updateLine,
    removeLine,
    emitDocument,
    convertQuote,
    fetchDocument,
    fetchContactDetail,
    fetchFinanceContacts,
    fetchTaxRates,
    fetchPreviewHtml,
    attachDocument,
    removeAttachment,
  } = useFinanceBillingStore();
  const { categories, fetchCategories } = useFinancePersonalStore();
  const { openInvoice, openContact } = useFacturacionNav();

  const [contactId, setContactId] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [discountKind, setDiscountKind] = useState<DiscountKind>('percent');
  const [categoryId, setCategoryId] = useState(''); // categoría de ingreso de la venta (#4); '' = sin categoría
  const [retentionRateId, setRetentionRateId] = useState(''); // retención IRPF a nivel documento (0263); '' = sin retención
  const [projectId, setProjectId] = useState(''); // F4: imputa el documento a un proyecto; '' = sin proyecto
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [supplierNumber, setSupplierNumber] = useState(''); // nº del proveedor (solo bills)
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [savedDoc, setSavedDoc] = useState<FinanceDocDetail | null>(null);
  const [busy, setBusy] = useState<null | 'draft' | 'emit' | 'pdf' | 'send' | 'preview' | 'convert' | 'attach'>(null);
  const [clienteOpen, setClienteOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendContact, setSendContact] = useState<FinanceContactDetail | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  // Reset / hidratación al abrir.
  useEffect(() => {
    if (!open) return;
    void fetchFinanceContacts();
    void fetchTaxRates();
    void fetchCategories(); // categorías de gasto para facturas recibidas
    void api.get<{ data: Array<{ id: string; title: string }> }>('/projects/boards').then((r) => setProjects(r.data ?? [])).catch(() => {}); // F4: proyectos para imputar
    setRemovedIds([]);
    setPreviewHtml(null);
    if (documentId) {
      void (async () => {
        await fetchDocument(documentId);
        const doc = useFinanceBillingStore.getState().currentDoc;
        if (doc && doc.id === documentId) {
          setSavedDoc(doc);
          setContactId(doc.contact_id);
          setSupplierNumber(doc.number ?? '');
          setIssueDate(doc.issue_date);
          setDueDate(doc.due_date ?? '');
          setDiscountValue(doc.discount_value != null && Number(doc.discount_value) > 0 ? String(Number(doc.discount_value)) : '');
          setDiscountKind(doc.discount_kind ?? 'percent');
          setCategoryId(doc.category_id ?? '');
          setRetentionRateId(doc.retention_rate_id ?? '');
          setProjectId(doc.lines.find((l) => l.project_id)?.project_id ?? '');
          setTerms(doc.terms ?? '');
          setNotes(doc.notes ?? '');
          setLines(
            doc.lines.length
              ? doc.lines.map((l) => ({
                  id: l.id,
                  description: l.description,
                  quantity: String(Number(l.quantity)),
                  unit_price: String(Number(l.unit_price)),
                  tax_rate_id: l.tax_rate_id ?? '',
                  discount_value: l.discount_value != null && Number(l.discount_value) > 0 ? String(Number(l.discount_value)) : '',
                  discount_kind: l.discount_kind ?? 'percent',
                  category_id: l.category_id ?? '',
                  inventory_item_id: l.inventory_item_id ?? '',
                  is_capital: l.is_capital ?? false,
                }))
              : [emptyLine()],
          );
        }
      })();
    } else {
      setSavedDoc(null);
      setContactId('');
      setSupplierNumber('');
      setIssueDate(todayISO());
      setDueDate('');
      setDiscountValue('');
      setDiscountKind('percent');
      setCategoryId('');
      setRetentionRateId('');
      setProjectId('');
      setTerms('');
      setNotes('');
      setLines([emptyLine()]);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape cierra primero la vista previa (si está abierta).
  useEffect(() => {
    if (previewHtml === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewHtml(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewHtml]);

  if (!open) return null;

  const taxById = new Map(taxRates.map((t) => [t.id, t]));
  // Tasas de retención IRPF (tax_type='irpf_retention'), separadas del IVA por línea.
  const retentionRates = taxRates.filter((t) => t.tax_type === 'irpf_retention');
  const retentionRate = retentionRateId ? Number(taxById.get(retentionRateId)?.rate ?? 0) : 0;

  // ─── Cálculo de totales en vivo ────────────────────────────────────────
  // Si ya hay doc guardado (con líneas reales), base/IVA vienen del backend
  // (autoridad). Si aún es borrador local sin persistir, se estiman client-side.
  // La retención SIEMPRE se recalcula del tipo elegido sobre la base → el panel
  // reacciona al cambiar el selector incluso sobre un borrador ya guardado
  // (el backend la confirma al guardar/emitir: total = base + IVA − retención).
  const liveTotals = (() => {
    let subtotal = 0;
    let tax = 0;
    let fromServer = false;
    if (savedDoc && savedDoc.lines.length > 0) {
      subtotal = Number(savedDoc.subtotal);
      tax = Number(savedDoc.tax_total);
      fromServer = true;
    } else {
      for (const l of lines) {
        const qty = Number(String(l.quantity).replace(',', '.')) || 0;
        const price = Number(String(l.unit_price).replace(',', '.')) || 0;
        const gross = qty * price;
        const rate = l.tax_rate_id ? Number(taxById.get(l.tax_rate_id)?.rate ?? 0) : 0;
        const mode = l.tax_rate_id ? taxById.get(l.tax_rate_id)?.mode : undefined;
        // Descuento de línea: se resta de la BASE BRUTA (ya ajustada por IVA
        // inclusive) antes de separar base/IVA — igual que recomputeDocumentTotals.
        const dv = Number(String(l.discount_value).replace(',', '.'));
        const dvPos = l.discount_value.trim() && !isNaN(dv) && dv > 0 ? dv : 0;
        const baseBruta = rate > 0 && mode === 'inclusive' ? gross / (1 + rate) : gross;
        const lineDisc = dvPos ? (l.discount_kind === 'percent' ? (baseBruta * dvPos) / 100 : Math.min(dvPos, baseBruta)) : 0;
        const baseNeta = baseBruta - lineDisc;
        subtotal += baseNeta;
        tax += baseNeta * rate;
      }
    }
    const retention = retentionRate > 0 ? Math.round(subtotal * retentionRate * 100) / 100 : 0;
    return { subtotal, tax, retention, total: subtotal + tax - retention, fromServer };
  })();

  const currency = savedDoc?.currency
    ?? contacts.find((c) => c.id === contactId)?.currency
    ?? 'EUR';

  const lineImporte = (l: DraftLine) => {
    const qty = Number(String(l.quantity).replace(',', '.')) || 0;
    const price = Number(String(l.unit_price).replace(',', '.')) || 0;
    return qty * price;
  };

  // Una factura ya emitida (tiene número) es INMUTABLE (D17/D18): se ve en
  // sólo-lectura y se ofrecen PDF + envío en vez de editar/emitir.
  // Emitida/registrada = ya NO es borrador. (No vale "tiene número": una factura
  // RECIBIDA lleva el número del proveedor desde el borrador → se cerraría sola.)
  const isEmitted = !!savedDoc && savedDoc.status !== 'draft';

  // Tipo efectivo: al editar manda el tipo del doc cargado; al crear, la prop
  // docType (default 'invoice'). isQuote conmuta los textos y el flujo de
  // "Convert to invoice" — el modelo de datos NO cambia (presupuesto guarda
  // su validez en due_date, igual que el vencimiento de una factura).
  const effectiveType: DocType = savedDoc?.type ?? docType ?? 'invoice';
  const isQuote = effectiveType === 'quote';
  // Factura RECIBIDA (compra): proveedor en vez de cliente, número manual del
  // proveedor (no se auto-numera), "Registrar" en vez de "Emitir/Enviar".
  const isBill = effectiveType === 'bill';
  // Vincular líneas a artículos de inventario aplica a compra (bill → purchase_in)
  // y venta (invoice → sale_out). En presupuesto/recibo/abono no mueve stock.
  const showItemLink = effectiveType === 'bill' || effectiveType === 'invoice';

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addDraftLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeDraftLine = (i: number) =>
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      const target = prev[i];
      if (target?.id) setRemovedIds((ids) => [...ids, target.id!]); // borrar en backend al guardar
      return prev.filter((_, idx) => idx !== i);
    });

  const validLines = lines.filter((l) => l.description.trim() && Number(String(l.unit_price).replace(',', '.')) !== 0);

  const toLineInput = (l: DraftLine): DocLineInput => {
    // Descuento de línea: manda el valor si hay uno > 0; si no, 0 para que el
    // backend resetee (limpia un descuento borrado).
    const dv = Number(String(l.discount_value).replace(',', '.'));
    const hasDisc = !!l.discount_value.trim() && !isNaN(dv) && dv > 0;
    return {
      description: l.description.trim(),
      quantity: Number(String(l.quantity).replace(',', '.')) || 1,
      unit_price: Number(String(l.unit_price).replace(',', '.')) || 0,
      tax_rate_id: l.tax_rate_id || null,
      category_id: l.category_id || null,
      inventory_item_id: l.inventory_item_id || null,
      project_id: projectId || null, // F4: imputa todas las líneas al proyecto del documento
      is_capital: l.is_capital,
      ...(hasDisc ? { discount_value: dv, discount_kind: l.discount_kind } : { discount_value: 0 }),
    };
  };

  // Descuento de documento normalizado: número >= 0 o undefined si vacío/inválido.
  const discountNum = (() => {
    const n = Number(String(discountValue).replace(',', '.'));
    return discountValue.trim() && !isNaN(n) && n > 0 ? n : undefined;
  })();

  // Persiste el borrador (crea el doc si no existía + sincroniza sus líneas).
  // Devuelve el doc detallado actualizado.
  const persist = async (): Promise<FinanceDocDetail> => {
    if (!contactId) throw new Error(isBill ? 'Elige un proveedor' : 'Elige un cliente');
    if (isBill && !supplierNumber.trim()) throw new Error('Enter the supplier\'s invoice number');
    if (validLines.length === 0) throw new Error('Add at least one line');

    if (!savedDoc) {
      const doc = await createDocument({
        type: effectiveType,
        contact_id: contactId,
        ...(isBill ? { number: supplierNumber.trim() } : {}),
        issue_date: issueDate,
        due_date: dueDate || undefined,
        discount_value: discountNum,
        discount_kind: discountNum != null ? discountKind : undefined,
        ...(isBill ? {} : { category_id: categoryId || null }),
        retention_rate_id: retentionRateId || null,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
        lines: validLines.map(toLineInput),
      });
      setSavedDoc(doc);
      return doc;
    }

    // Doc existente (borrador): persiste los campos de documento (notas,
    // condiciones, descuento) — el backend recalcula totales con el descuento.
    await updateDocument(savedDoc.id, {
      ...(isBill ? { number: supplierNumber.trim() } : {}),
      ...(isBill ? {} : { category_id: categoryId || null }),
      retention_rate_id: retentionRateId || null,
      notes: notes.trim(),
      terms: terms.trim(),
      discount_value: discountNum ?? 0,
      discount_kind: discountKind,
    });

    // …y SINCRONIZA las líneas con el backend — borra las eliminadas,
    // actualiza las modificadas, añade las nuevas.
    for (const id of removedIds) await removeLine(savedDoc.id, id);
    const origById = new Map(savedDoc.lines.map((l) => [l.id, l]));
    for (const l of lines) {
      const valid = l.description.trim() && Number(String(l.unit_price).replace(',', '.')) !== 0;
      if (l.id) {
        const o = origById.get(l.id);
        if (!o) continue; // ya borrada
        if (!valid) { await removeLine(savedDoc.id, l.id); continue; } // vaciada → borrar
        const inp = toLineInput(l);
        const changed = o.description !== inp.description
          || Number(o.quantity) !== inp.quantity
          || Number(o.unit_price) !== inp.unit_price
          || (o.tax_rate_id ?? null) !== (inp.tax_rate_id ?? null)
          || Number(o.discount_value ?? 0) !== (inp.discount_value ?? 0)
          || (o.discount_kind ?? null) !== (inp.discount_kind ?? null)
          || (o.category_id ?? null) !== (inp.category_id ?? null)
          || (o.inventory_item_id ?? null) !== (inp.inventory_item_id ?? null)
          || (o.project_id ?? null) !== (inp.project_id ?? null)
          || Boolean(o.is_capital) !== Boolean(inp.is_capital);
        if (changed) await updateLine(savedDoc.id, l.id, inp);
      } else if (valid) {
        await addLine(savedDoc.id, toLineInput(l));
      }
    }
    setRemovedIds([]);
    await fetchDocument(savedDoc.id);
    const fresh = useFinanceBillingStore.getState().currentDoc;
    if (fresh && fresh.id === savedDoc.id) setSavedDoc(fresh);
    return fresh ?? savedDoc;
  };

  const onSaveDraft = async () => {
    setBusy('draft');
    try {
      await persist();
      toast.success('Draft saved');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t save');
    } finally {
      setBusy(null);
    }
  };

  const onEmit = async () => {
    setBusy('emit');
    try {
      const doc = await persist();
      await emitDocument(doc.id);
      // refresca el doc para reflejar el número/estado emitido en este mismo editor
      await fetchDocument(doc.id);
      const fresh = useFinanceBillingStore.getState().currentDoc;
      if (fresh && fresh.id === doc.id) setSavedDoc(fresh);
      toast.success(isBill ? 'Factura recibida registrada' : `${isQuote ? 'Presupuesto emitido' : 'Factura emitida'}${fresh?.number ? ` (${fresh.number})` : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t issue');
    } finally {
      setBusy(null);
    }
  };

  // Convierte un presupuesto emitido en factura y abre la factura resultante.
  const onConvertToInvoice = async () => {
    if (!savedDoc) return;
    setBusy('convert');
    try {
      const inv = await convertQuote(savedDoc.id);
      toast.success('Presupuesto convertido a factura');
      openInvoice(inv.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t convert');
    } finally {
      setBusy(null);
    }
  };

  const onDownloadPdf = async () => {
    if (!savedDoc) return;
    setBusy('pdf');
    try {
      await openInvoicePdf(savedDoc.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t generate the PDF (is Office running?)');
    } finally {
      setBusy(null);
    }
  };

  // Abre el diálogo de envío con selector de cuenta. Carga el detalle del
  // cliente (best-effort) para prefill del destinatario; si falla, abre igual.
  const onSendEmail = async () => {
    if (!savedDoc) return;
    setBusy('send');
    try {
      let contact: FinanceContactDetail | null = null;
      try {
        contact = await fetchContactDetail(savedDoc.contact_id);
      } catch {
        contact = null;
      }
      setSendContact(contact);
      setSendOpen(true);
    } finally {
      setBusy(null);
    }
  };

  // Vista previa: si aún es borrador sin persistir, lo guarda primero (necesita
  // un id real para que el backend maquete el HTML). Si no hay líneas válidas,
  // avisa en vez de romper. El HTML se muestra en un <iframe srcDoc> aislado.
  const onPreview = async () => {
    setBusy('preview');
    try {
      let docId = savedDoc?.id;
      if (!isEmitted) {
        if (!contactId) { toast.error('Pick a customer to preview'); return; }
        if (validLines.length === 0) { toast.error('Add at least one valid line to preview'); return; }
        const doc = await persist();
        docId = doc.id;
      }
      if (!docId) { toast.error('Save the draft before previewing'); return; }
      const html = await fetchPreviewHtml(docId);
      setPreviewHtml(html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn\'t generate the preview');
    } finally {
      setBusy(null);
    }
  };

  // ─── Justificante adjunto (solo facturas recibidas) ───────────────────
  // Sube el fichero a Drive y lo enlaza al documento. Requiere un doc ya
  // guardado (savedDoc.id). El adjunto actual se lee de external_ref.attachment.
  const attachment = savedDoc?.external_ref?.attachment ?? null;

  const onAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-subir el mismo fichero
    if (!file || !savedDoc) return;
    setBusy('attach');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('parent_folder', 'drive/Documents/');
      const r = await api.upload<{ data: { id: string; filename: string } }>('/files/upload', fd);
      await attachDocument(savedDoc.id, { file_id: r.data.id, filename: r.data.filename });
      await fetchDocument(savedDoc.id);
      const fresh = useFinanceBillingStore.getState().currentDoc;
      if (fresh && fresh.id === savedDoc.id) setSavedDoc(fresh);
      toast.success('Justificante adjuntado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t attach the receipt');
    } finally {
      setBusy(null);
    }
  };

  const onRemoveAttachment = async () => {
    if (!savedDoc) return;
    setBusy('attach');
    try {
      await removeAttachment(savedDoc.id);
      await fetchDocument(savedDoc.id);
      const fresh = useFinanceBillingStore.getState().currentDoc;
      if (fresh && fresh.id === savedDoc.id) setSavedDoc(fresh);
      toast.success('Justificante quitado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t remove the receipt');
    } finally {
      setBusy(null);
    }
  };

  // ─── Estilos (clonados de NuevoMovimientoDialog) ──────────────────────
  const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };
  const cellInput: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', color: 'var(--text)', fontSize: 13 };
  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 6px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 };

  const number = savedDoc?.number ?? null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.6))', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '6vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 820, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {isQuote
                ? (documentId ? 'Editar presupuesto' : 'New quote')
                : isBill
                  ? (documentId ? 'Editar factura recibida' : 'Nueva factura recibida')
                  : (documentId ? 'Editar factura' : 'Nueva factura')}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono, monospace)' }}>
              {isBill ? (number ? `Nº proveedor ${number}` : 'Factura del proveedor') : (number ?? 'Provisional no. — assigned on issue')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Cuerpo: formulario (izq) + totales (der), y debajo a ancho completo los 3 colapsables */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Cliente (venta) / Proveedor (factura recibida) */}
            <div>
              <label style={labelStyle}>{isBill ? 'Supplier' : 'Customer'}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select ref={firstFieldRef} value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={isEmitted} style={{ ...fieldStyle, flex: 1 }}>
                  <option value="">{isBill ? '— elige proveedor —' : '— elige cliente —'}</option>
                  {contacts.filter((c) => c.roles.includes(isBill ? 'supplier' : 'customer')).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!isEmitted && (
                  <button onClick={() => setClienteOpen(true)} title={isBill ? 'New supplier' : 'New customer'} style={{ ...fieldStyle, width: 'auto', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={14} /> Nuevo
                  </button>
                )}
              </div>
            </div>

            {/* Nº de la factura del proveedor (solo facturas recibidas) */}
            {isBill && (
              <div>
                <label style={labelStyle}>Their invoice no.</label>
                <input value={supplierNumber ?? ''} onChange={(e) => setSupplierNumber(e.target.value)} disabled={isEmitted} placeholder="the one on the supplier's paperwork" style={fieldStyle} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>The supplier sets it; we don't number it.</div>
              </div>
            )}

            {/* Fechas */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{isBill ? 'Fecha de la factura' : 'Issue date'}</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={isEmitted} style={fieldStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{isQuote ? 'Valid until' : 'Due date'}</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isEmitted} style={fieldStyle} />
              </div>
            </div>

            {/* Categoría de ingreso (solo ventas — la factura recibida usa categoría por línea) */}
            {!isBill && (
              <div>
                <label style={labelStyle}>Income category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isEmitted} style={fieldStyle}>
                  <option value="">— sin categoría —</option>
                  {categories.filter((c) => c.kind === 'income').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Clasifica el ingreso de esta venta en el desglose de Finanzas (Resumen → Ingreso por categoría).
                </div>
              </div>
            )}

            {/* Proyecto (F4): imputa el documento a un proyecto → rentabilidad por proyecto. */}
            {projects.length > 0 && (
              <div>
                <label style={labelStyle}>Project</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={isEmitted} style={fieldStyle}>
                  <option value="">— sin proyecto —</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Imputa ingresos y coste de esta factura a un proyecto (Contabilidad → Proyectos).
                </div>
              </div>
            )}

            {/* Descuento de documento */}
            <div>
              <label style={labelStyle}>Discount</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  disabled={isEmitted}
                  inputMode="decimal"
                  placeholder="0"
                  style={{ ...fieldStyle, flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}
                />
                <select
                  value={discountKind}
                  onChange={(e) => setDiscountKind(e.target.value as DiscountKind)}
                  disabled={isEmitted}
                  style={{ ...fieldStyle, width: 150 }}
                >
                  <option value="percent">% sobre la base</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              {!isEmitted && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  El descuento se aplica al guardar/emitir (el total final lo calcula el sistema).
                </div>
              )}
            </div>

            {/* Retención IRPF (a nivel documento, 0263): separada del IVA por línea. */}
            {retentionRates.length > 0 && (
              <div>
                <label style={labelStyle}>Income tax withholding <Tip k="retencion" /></label>
                <select value={retentionRateId} onChange={(e) => setRetentionRateId(e.target.value)} disabled={isEmitted} style={fieldStyle}>
                  <option value="">— sin retención —</option>
                  {retentionRates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({(Number(t.rate) * 100).toFixed(0)}%)</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {isBill
                    ? 'Retienes este % al proveedor (profesional/alquiler) y lo ingresas tú a Hacienda. Baja el total a pagar.'
                    : 'Tu cliente te retiene este % y lo ingresa él a Hacienda. Baja el total a cobrar; lo recuperas en tu declaración.'}
                </div>
              </div>
            )}

            {/* Líneas */}
            <div>
              <label style={labelStyle}>Lines</label>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 8 }}>
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: isMobile ? 560 : undefined }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '28%' }}>Description</th>
                      <th style={{ ...th, width: '10%' }}>Qty</th>
                      <th style={{ ...th, width: '14%' }}>Price</th>
                      <th style={{ ...th, width: '17%' }}>Disc.</th>
                      <th style={{ ...th, width: '18%' }}>IVA</th>
                      {isBill && <th style={{ ...th, width: '16%' }}>Category</th>}
                      <th style={{ ...th, width: '13%', textAlign: 'right' }}>Amount</th>
                      <th style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td style={{ padding: '3px 4px' }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} disabled={isEmitted} placeholder="Description" style={{ ...cellInput, flex: 1, minWidth: 0 }} />
                            {showItemLink && (
                              <InventoryItemSelect
                                value={l.inventory_item_id}
                                onChange={(id, _name, it) => {
                                  // Autocompleta desde el producto SIN pisar lo que el usuario ya escribió:
                                  // concepto si está vacío + precio (venta→PVP, compra→precio de compra) si es 0.
                                  const patch: Partial<DraftLine> = { inventory_item_id: id };
                                  if (it) {
                                    if (!l.description.trim()) patch.description = it.name;
                                    const cur = Number(String(l.unit_price).replace(',', '.')) || 0;
                                    if (cur === 0) {
                                      const src = isBill ? it.purchase_price : it.sale_price;
                                      if (src != null && String(src) !== '') patch.unit_price = String(src);
                                    }
                                  }
                                  setLine(i, patch);
                                }}
                                disabled={isEmitted}
                              />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '3px 4px' }}>
                          <input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} disabled={isEmitted} inputMode="decimal" style={{ ...cellInput, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
                        </td>
                        <td style={{ padding: '3px 4px' }}>
                          <input value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} disabled={isEmitted} inputMode="decimal" placeholder="0,00" style={{ ...cellInput, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
                        </td>
                        <td style={{ padding: '3px 4px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input value={l.discount_value} onChange={(e) => setLine(i, { discount_value: e.target.value })} disabled={isEmitted} inputMode="decimal" placeholder="0" style={{ ...cellInput, flex: 1, minWidth: 0, textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
                            <select value={l.discount_kind} onChange={(e) => setLine(i, { discount_kind: e.target.value as 'percent' | 'fixed' })} disabled={isEmitted} title="Discount type" style={{ ...cellInput, width: 'auto', padding: '6px 4px', flexShrink: 0 }}>
                              <option value="percent">%</option>
                              <option value="fixed">{currency === 'EUR' ? '€' : currency}</option>
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: '3px 4px' }}>
                          <select value={l.tax_rate_id} onChange={(e) => setLine(i, { tax_rate_id: e.target.value })} disabled={isEmitted} style={cellInput}>
                            <option value="">No VAT</option>
                            {taxRates.filter((t) => t.tax_type !== 'irpf_retention').map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({(Number(t.rate) * 100).toFixed(0)}% {t.mode === 'inclusive' ? 'inc' : 'exc'})
                              </option>
                            ))}
                          </select>
                        </td>
                        {isBill && (
                          <td style={{ padding: '3px 4px' }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <select value={l.category_id} onChange={(e) => setLine(i, { category_id: e.target.value })} disabled={isEmitted || l.is_capital} title={l.is_capital ? 'Capital assets go to Fixed assets, not to an expense category' : 'Expense category'} style={{ ...cellInput, flex: 1, minWidth: 0, opacity: l.is_capital ? 0.5 : 1 }}>
                                <option value="">— sin categoría —</option>
                                {categories.filter((c) => c.kind === 'expense').map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              <label title="Bien de inversión (inmovilizado): se capitaliza y luego se deprecia, en vez de imputarse como gasto" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 14, cursor: isEmitted ? 'default' : 'pointer', flexShrink: 0, color: l.is_capital ? 'var(--mod-inventory, var(--amber))' : 'var(--text-dim)' }}>
                                <input type="checkbox" checked={l.is_capital} disabled={isEmitted} onChange={(e) => setLine(i, { is_capital: e.target.checked })} aria-label="Capital asset" style={{ cursor: isEmitted ? 'default' : 'pointer' }} />
                                <span aria-hidden>🏭</span>
                              </label>
                            </div>
                          </td>
                        )}
                        <td style={{ padding: '3px 4px', textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                          {fmtMoney(lineImporte(l), currency)}
                        </td>
                        <td style={{ padding: '3px 0', textAlign: 'center' }}>
                          <button onClick={() => removeDraftLine(i)} disabled={isEmitted || lines.length <= 1} title="Remove line" style={{ background: 'none', border: 'none', color: (isEmitted || lines.length <= 1) ? 'var(--text-muted)' : 'var(--text-dim)', cursor: (isEmitted || lines.length <= 1) ? 'default' : 'pointer', padding: 4 }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {!isEmitted && (
                  <button onClick={addDraftLine} style={{ marginTop: 8, width: '100%', padding: '7px 12px', cursor: 'pointer', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    <Plus size={14} /> Línea
                  </button>
                )}
              </div>
              {isEmitted && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {isQuote
                    ? 'Presupuesto emitido. Puedes convertirlo en factura.'
                    : isBill
                      ? 'Factura recibida registrada: es inmutable. Registra su pago desde la pestaña Recibidas o Pagos.'
                      : 'Factura emitida: es inmutable. Para corregirla, emite una nota de crédito desde la pestaña Facturas.'}
                </div>
              )}
            </div>

            {/* Condiciones de pago + notas */}
            <div>
              <label style={labelStyle}>Payment terms</label>
              <textarea
                value={terms ?? ''}
                onChange={(e) => setTerms(e.target.value)}
                disabled={isEmitted}
                rows={2}
                placeholder="e.g. Net 30 by transfer to ES00 0000…"
                style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={notes ?? ''}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isEmitted}
                rows={2}
                placeholder="Notes the customer will see on the invoice (optional)"
                style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Justificante adjunto (solo facturas recibidas) */}
            {isBill && (
              <div>
                <label style={labelStyle}>Receipt</label>
                {!savedDoc ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', background: 'var(--card)' }}>
                    Save the draft to attach a receipt.
                  </div>
                ) : attachment ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', background: 'var(--card)' }}>
                    <Paperclip size={14} style={{ color: 'var(--mod-finance)', flexShrink: 0 }} />
                    <a
                      href={`/api/v1/files/${attachment.file_id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--info)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {attachment.filename ?? 'Justificante adjunto'}
                    </a>
                    <button
                      onClick={onRemoveAttachment}
                      disabled={busy !== null}
                      title="Quitar justificante"
                      style={{ background: 'none', border: 'none', color: busy ? 'var(--text-muted)' : 'var(--text-dim)', cursor: busy ? 'wait' : 'pointer', padding: 4, flexShrink: 0 }}
                    >
                      {busy === 'attach' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md, 6px)', background: 'var(--card)', cursor: busy ? 'wait' : 'pointer', fontSize: 13, color: 'var(--text-dim)' }}>
                    {busy === 'attach' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Paperclip size={14} />}
                    Adjuntar justificante (PDF, imagen…)
                    <input type="file" onChange={onAttachFile} disabled={busy !== null} style={{ display: 'none' }} />
                  </label>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Saved to Drive (Documents) and linked to this invoice.</div>
              </div>
            )}
          </div>

          {/* Panel de totales */}
          <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0 }}>
            <div style={{ position: 'sticky', top: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 16, fontFamily: 'var(--font-mono, monospace)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'var(--font-sans, inherit)', fontWeight: 600 }}>Totals</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: 'var(--text-dim)' }}><span>Base</span><span>{fmtMoney(liveTotals.subtotal, currency)}</span></div>
              {savedDoc && Number(savedDoc.discount_value ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: 'var(--text-dim)' }}>
                  <span>Discount</span>
                  <span>{savedDoc.discount_kind === 'percent' ? `${Number(savedDoc.discount_value)}%` : `−${fmtMoney(savedDoc.discount_value, currency)}`}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: 'var(--text-dim)' }}><span>IVA</span><span>{fmtMoney(liveTotals.tax, currency)}</span></div>
              {liveTotals.retention > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: 'var(--warning)' }}><span>− Retención IRPF</span><span>−{fmtMoney(liveTotals.retention, currency)}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 2px', fontSize: 17, fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border)', marginTop: 6 }}>
                <span style={{ fontSize: liveTotals.retention > 0 ? 13 : 17 }}>{liveTotals.retention > 0 ? (isBill ? 'Total to pay' : 'Total to collect') : 'TOTAL'}</span>
                <span>{fmtMoney(liveTotals.total, currency)}</span>
              </div>
              {!liveTotals.fromServer && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'var(--font-sans, inherit)' }}>Estimated. Confirmed on save.</div>
              )}
            </div>
          </div>
          </div>
          {/* Relacionado con esta factura: contacto + correspondencia (emails) + productos + pagos. */}
          {savedDoc?.id && <DocumentRelatedPanel documentId={savedDoc.id} onOpenContact={openContact} />}
          {/* Inteligencia de relaciones: Related Entities + Similar Semantic + Graph Proximity */}
          {savedDoc?.id && <RelationIntelligence sourceType="finance_document" sourceId={savedDoc.id} />}
        </div>

        {/* Pie de acciones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {isEmitted ? (
            <>
              <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Close</button>
              {isQuote && savedDoc?.status !== 'converted' && (
                <button onClick={onConvertToInvoice} disabled={busy !== null} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {busy === 'convert' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={14} />}
                  Convertir a factura
                </button>
              )}
              {/* PDF / vista previa / envío por email son acciones de VENTA; no aplican a una factura recibida. */}
              {!isBill && (
                <>
                  <button onClick={onPreview} disabled={busy !== null} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {busy === 'preview' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Eye size={14} />}
                    Vista previa
                  </button>
                  <button onClick={onDownloadPdf} disabled={busy !== null} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {busy === 'pdf' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={14} />}
                    PDF
                  </button>
                  <button onClick={onSendEmail} disabled={busy !== null} style={{ padding: '8px 18px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {busy === 'send' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                    Enviar por email
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              {/* La vista previa renderiza el documento como factura NUESTRA → no aplica a una factura recibida. */}
              {!isBill && (
                <button onClick={onPreview} disabled={busy !== null} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {busy === 'preview' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Eye size={14} />}
                  Vista previa
                </button>
              )}
              <button onClick={onSaveDraft} disabled={busy !== null} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {busy === 'draft' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Save draft
              </button>
              <button onClick={onEmit} disabled={busy !== null} style={{ padding: '8px 18px', background: isBill ? 'var(--mod-finance)' : 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {busy === 'emit' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {isQuote ? 'Issue quote' : isBill ? 'Registrar' : 'Issue invoice'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal de vista previa: HTML maquetado en un iframe aislado (sandbox). */}
      {previewHtml !== null && (
        <div
          onClick={(e) => { e.stopPropagation(); setPreviewHtml(null); }}
          style={{ position: 'fixed', inset: 0, background: 'var(--glass-modal, rgba(0,0,0,0.7))', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 4vw' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 860, maxWidth: '100%', height: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={16} style={{ color: 'var(--mod-finance)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Vista previa{number ? ` — ${number}` : ''}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={onDownloadPdf} disabled={busy !== null} title="Descargar PDF" style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', cursor: busy ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {busy === 'pdf' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={13} />}
                  Descargar PDF
                </button>
                <button onClick={() => setPreviewHtml(null)} title="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
            </div>
            <iframe
              srcDoc={previewHtml}
              title="preview"
              sandbox=""
              style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
            />
          </div>
        </div>
      )}

      <ClienteDialog open={clienteOpen} onClose={() => setClienteOpen(false)} role={isBill ? 'supplier' : 'customer'} />
      <EnviarFacturaDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        document={savedDoc}
        contact={sendContact}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
