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

// ─── Finance Billing store (nativo, lente Facturación F2b) ───────────────
// Estado de la lente Facturación (contactos cliente/proveedor, tipos de IVA,
// documentos invoice/quote/bill/receipt/credit_note, líneas y pagos) sobre las
// rutas REST nativas /finance/* (F2a). Hermano de finance-personal.store.ts:
// misma forma (Zustand + api.get/post, envelope {data}, importes como string).
//
// MODELO NUEVO: un cliente/proveedor ES un CONTACTO del CRM. Ya no existe el
// dominio `finance_parties`; sus datos de finanzas viven en el contacto y el
// backend expone un contrato "plano" cómodo (/finance/contacts). Un contacto
// puede ser cliente Y proveedor a la vez (roles es una lista).

import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Tipos ───────────────────────────────────────────────────────────────

/** Rol de facturación de un contacto. Un contacto puede tener ambos. */
export type FinanceRole = 'customer' | 'supplier';
export type DiscountKind = 'percent' | 'fixed';
export type TaxMode = 'inclusive' | 'exclusive';

export type DocType = 'invoice' | 'quote' | 'bill' | 'receipt' | 'credit_note';
export type DocStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'cancelled'
  | 'converted';

/** Una dirección de facturación (estructura libre; los campos típicos). */
export interface BillingAddress {
  label?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  region?: string | null;
  country?: string | null;
}

/** Datos extra solo-Finance (objeto libre clave→valor). */
export type CustomFields = Record<string, unknown>;

/**
 * Un contacto-finanzas (cliente/proveedor). Forma PLANA que devuelve el backend
 * (/finance/contacts): los datos de finanzas viven en el contacto del CRM y el
 * backend los expone aquí sin que el dash toque `custom_fields`. Un contacto
 * puede ser cliente Y proveedor a la vez (`roles` es una lista).
 */
export interface FinanceContact {
  id: string;
  name: string;
  /** Nombre a mostrar del contacto del CRM (suele coincidir con name). */
  display_name: string | null;
  company: string | null;
  /** Emails del contacto del CRM (jsonb array; null si no tiene). */
  emails: string[] | null;
  tags: string[] | null;
  /** Roles de facturación: cliente, proveedor o ambos. */
  roles: FinanceRole[];
  tax_id: string | null;
  legal_name: string | null;
  payment_terms: number | null; // días de vencimiento por defecto
  currency: string;
  website: string | null;
  /** Dirección de facturación (objeto único, NO array). */
  billing_address: BillingAddress | null;
  notes: string | null;
}

/** Saldos de un contacto-finanzas (derivados del ledger). */
export interface FinanceContactBalances {
  receivable: string; // por cobrar (cliente)
  payable: string;    // por pagar (proveedor)
  invoiced: string;   // total facturado al cliente
  billed: string;     // total comprado al proveedor
}

/** Detalle de un contacto-finanzas (plano + saldos + sus documentos). */
export interface FinanceContactDetail extends FinanceContact {
  balances: FinanceContactBalances;
  documents: FinanceDoc[];
}

export interface TaxRate {
  id: string;
  name: string;
  rate: string; // numeric string, p.ej. "0.21"
  mode: TaxMode;
  account_id: string | null;
}

export interface DocLine {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate_id: string | null;
  tax_mode: TaxMode | null;
  taxable_base: string;
  tax_amount: string;
  line_total: string;
  category_id: string | null; // categoría (facturas recibidas)
  // Artículo de inventario vinculado a la línea (cruce con Inventory): al emitir,
  // dispara purchase_in (bill) / sale_out (invoice) + enlace purchased_item/sold_item.
  inventory_item_id: string | null;
  // Bien de inversión (inmovilizado): al emitir un bill, la línea carga a
  // Inmovilizado material en vez de a Gastos (C-N2 capitalizar).
  is_capital?: boolean;
  // Descuento por línea: importe o porcentaje según discount_kind (lo devuelve el backend en cada línea).
  discount_value: string | null;
  discount_kind: 'percent' | 'fixed' | null;
}

export interface DocPayment {
  id: string;
  amount: string;
  date: string;
  method: string | null;
  reference: string | null;
}

/** Fila de la lista de documentos (GET /finance/documents). */
export interface FinanceDoc {
  id: string;
  type: DocType;
  number: string | null;
  /** Contacto cliente/proveedor del documento (antes party_id). */
  contact_id: string;
  status: DocStatus;
  issue_date: string;
  due_date: string | null;
  currency: string;
  subtotal: string;
  tax_total: string;
  total: string;
  discount_value: string | null;
  // El backend usa percent|fixed para el descuento de documento.
  discount_kind: 'percent' | 'fixed' | null;
  // Categoría de INGRESO de la venta (factura/presupuesto) — #4. Las recibidas no la usan.
  category_id: string | null;
  notes: string | null;
  terms: string | null;
  // Justificante adjunto (facturas recibidas): referencia a un fichero del Drive.
  external_ref?: { attachment?: { file_id: string; filename: string | null } } | null;
}

/** Detalle de un documento (GET /finance/documents/:id → doc + lines + payments). */
export interface FinanceDocDetail extends FinanceDoc {
  lines: DocLine[];
  payments: DocPayment[];
}

// ─── Inputs ──────────────────────────────────────────────────────────────

/**
 * Alta/edición de un contacto-finanzas (POST/PATCH /finance/contacts).
 * En edición, `roles` REEMPLAZA el set completo. La dirección de facturación va
 * como objeto único `billing_address` (NO array).
 */
export interface SaveFinanceContactInput {
  /** id presente ⇒ PATCH (editar); ausente ⇒ POST (crear). */
  id?: string;
  name: string;
  roles: FinanceRole[];
  /** Email opcional para crear/enlazar un contacto del CRM al dar de alta. */
  email?: string;
  tax_id?: string;
  legal_name?: string;
  currency?: string;
  payment_terms?: number | null;
  website?: string;
  billing_address?: BillingAddress | null;
  notes?: string | null;
  tags?: string[] | null;
}

/** Entidades relacionadas de un documento (cruce de dominios) → enlaces en la UI. */
export interface DocRelatedItem { item_id: string; name: string; category: string | null; quantity: string; relation: 'purchased' | 'sold' | null }
export interface DocRelatedPayment { id: string; amount: string; date: string; method: string | null; account_id: string | null; account_name: string | null }
export interface DocRelated { type: string; inventory: DocRelatedItem[]; payments: DocRelatedPayment[] }

export interface CreateTaxRateInput {
  name: string;
  rate: string;
  mode?: TaxMode;
}

export interface DocLineInput {
  description: string;
  quantity: string | number;
  unit_price: string | number;
  tax_rate_id?: string | null;
  tax_mode?: TaxMode;
  category_id?: string | null; // categoría de gasto (facturas recibidas) → desglose en Personal
  // Artículo de inventario vinculado (opcional): habilita el cruce con Inventory
  // al emitir (purchase_in/sale_out + enlace). El backend ya mapea inventory_item_id.
  inventory_item_id?: string | null;
  // Bien de inversión: capitaliza la línea (Inmovilizado) en vez de gasto (C-N2).
  is_capital?: boolean;
  // Descuento por línea (opcional). El backend lo resta de la base bruta de la
  // línea antes del descuento de documento y antes del IVA.
  discount_value?: string | number;
  discount_kind?: 'percent' | 'fixed';
}

export interface CreateDocumentInput {
  type: DocType;
  /** Contacto cliente/proveedor del documento (antes party_id). */
  contact_id: string;
  /** Número del proveedor (solo facturas recibidas; el resto auto-numera al emitir). */
  number?: string;
  currency?: string;
  issue_date?: string;
  due_date?: string;
  discount_value?: string | number;
  // Nota: el backend usa percent|fixed para el descuento de documento (no amount).
  discount_kind?: 'percent' | 'fixed';
  // Categoría de ingreso de la venta (#4). '' / null = sin categoría.
  category_id?: string | null;
  notes?: string;
  terms?: string;
  lines?: DocLineInput[];
}

/** Campos editables de un borrador (notas/condiciones/descuento de documento). */
export interface UpdateDocumentInput {
  number?: string; // nº del proveedor (facturas recibidas en borrador)
  notes?: string;
  terms?: string;
  discount_value?: string | number;
  discount_kind?: 'percent' | 'fixed';
  issue_date?: string;
  due_date?: string;
  category_id?: string | null; // categoría de ingreso (ventas) → desglose en Personal
}

/** Datos de la empresa emisora del usuario (fila de finance_company). */
export interface Company {
  id?: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  /** Dirección de facturación de la empresa (objeto único). */
  billing_address: BillingAddress | null;
  default_currency: string;
  custom_fields: CustomFields | null;
}

/** Body del upsert de empresa (PUT /finance/company). */
export interface SaveCompanyInput {
  name: string;
  legal_name?: string;
  tax_id?: string;
  /** Dirección de facturación (objeto único). */
  billing_address?: BillingAddress;
  default_currency?: string;
  email?: string;
  phone?: string;
  website?: string;
  logo_url?: string;
}

export interface RecordPaymentInput {
  document_id: string;
  amount: string | number;
  account_id: string;
  date?: string;
  method?: string;
  reference?: string;
}

export interface CreateCreditNoteInput {
  invoice_id: string;
  amount: string | number;
  reason?: string;
}

/** Cuenta de correo emisora (GET /finance/email-accounts; sin secretos). */
export interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  name: string;
  is_default: boolean;
}

/** Ajustes de marca del usuario para sus facturas (users.settings.finance_brand). */
export interface Brand {
  logo: string | null;
  accent_color: string | null;
  font_family: string | null;
}

// ─── Resumen de facturación (gráficas del Resumen) ─────────────────────────
// Forma del contrato GET /finance/summary/invoicing. Importes como string
// (snake_case end-to-end). Sólo datos del schema; el dash deriva lo visual.

/** Facturado vs cobrado de un mes (mes 'YYYY-MM', antiguo→reciente). */
export interface InvoicingByMonth {
  month: string; // 'YYYY-MM'
  invoiced: string; // SUM total de facturas emitidas ese mes (issue_date)
  collected: string; // SUM pagos recibidos ese mes
}

/** Antigüedad del saldo pendiente de facturas abiertas, por días de retraso. */
export interface InvoicingAging {
  current: string; // sin vencer / sin due / due >= hoy
  d1_30: string; // 1..30 días de retraso
  d31_60: string; // 31..60 días
  d60_plus: string; // > 60 días
  total: string; // suma de los tramos
}

/** Cliente del top por facturado (con su saldo pendiente). */
export interface InvoicingTopClient {
  /** Contacto cliente (antes party_id). */
  contact_id: string;
  name: string;
  invoiced: string;
  outstanding: string;
}

export interface InvoicingSummary {
  by_month: InvoicingByMonth[];
  aging: InvoicingAging;
  top_clients: InvoicingTopClient[];
}

/** Antigüedad del saldo pendiente de PAGO a proveedores (aging AP). */
export interface ApAging {
  current: string; d1_30: string; d31_60: string; d60_plus: string; total: string;
}

/** Liquidación de IVA (Modelo 303) en un periodo: repercutido − soportado. */
export interface VatReport {
  output: string; // IVA repercutido (ventas)
  input: string;  // IVA soportado (compras, deducible)
  to_settle: string; // a liquidar = output − input
  from: string; to: string;
}

/** Un punto de la serie de facturación por periodo (bucket diario o mensual). */
export interface InvoicingSeriesPoint {
  bucket: string; // 'YYYY-MM-DD' (diario) o 'YYYY-MM' (mensual)
  invoiced: string; // facturado en el bucket
  collected: string; // cobrado en el bucket
  billed: string; // gastos (facturas recibidas type='bill') en el bucket
}

export interface DocumentFilters {
  type?: DocType;
  status?: DocStatus;
  contact_id?: string;
}

/** Filtros del listado de contactos-finanzas (GET /finance/contacts). */
export interface FinanceContactFilters {
  role?: FinanceRole;
  search?: string;
}

// ─── Store ───────────────────────────────────────────────────────────────

interface FinanceBillingState {
  contacts: FinanceContact[];
  taxRates: TaxRate[];
  documents: FinanceDoc[];
  currentDoc: FinanceDocDetail | null;
  selectedContactId: string | null;
  loading: boolean;
  error: string | null;

  fetchFinanceContacts: (filters?: FinanceContactFilters) => Promise<void>;
  fetchContactDetail: (id: string) => Promise<FinanceContactDetail>;
  fetchTaxRates: () => Promise<void>;
  fetchDocuments: (filters?: DocumentFilters) => Promise<void>;
  fetchDocument: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  setSelectedContact: (id: string | null) => void;

  /** Crea (sin id) o edita (con id) un contacto-finanzas. */
  saveFinanceContact: (data: SaveFinanceContactInput) => Promise<FinanceContact>;
  /** Marca un contacto existente del CRM como cliente/proveedor. */
  tagContact: (contactId: string, role: FinanceRole) => Promise<FinanceContact>;
  createTaxRate: (data: CreateTaxRateInput) => Promise<TaxRate>;
  deleteTaxRate: (id: string) => Promise<void>;
  fetchEmailAccounts: () => Promise<EmailAccount[]>;
  sendInvoice: (id: string, opts?: { to?: string; subject?: string; message?: string; account_id?: string }) => Promise<{ email_id: string; to: string[]; filename: string }>;

  createDocument: (data: CreateDocumentInput) => Promise<FinanceDocDetail>;
  updateDocument: (id: string, patch: UpdateDocumentInput) => Promise<void>;
  addLine: (docId: string, line: DocLineInput) => Promise<void>;
  updateLine: (docId: string, lineId: string, line: Partial<DocLineInput>) => Promise<void>;
  removeLine: (docId: string, lineId: string) => Promise<void>;
  emitDocument: (id: string) => Promise<void>;
  recordPayment: (input: RecordPaymentInput) => Promise<void>;
  createCreditNote: (input: CreateCreditNoteInput) => Promise<void>;
  acceptQuote: (id: string) => Promise<void>;
  declineQuote: (id: string) => Promise<void>;
  convertQuote: (id: string) => Promise<FinanceDocDetail>;

  fetchBrand: () => Promise<Brand>;
  saveBrand: (b: Partial<Brand>) => Promise<Brand>;
  fetchPreviewHtml: (docId: string) => Promise<string>;

  fetchCompany: () => Promise<Company | null>;
  saveCompany: (c: SaveCompanyInput) => Promise<Company>;

  // Cruce cross-dominio (opt-in): factura recibida de artículo nuevo → propuesta de inventario.
  fetchCrossDomainSettings: () => Promise<{ bill_propose_items: boolean }>;
  saveCrossDomainSettings: (s: { bill_propose_items: boolean }) => Promise<{ bill_propose_items: boolean }>;

  fetchInvoicingSummary: (opts?: { months?: number; from?: string; to?: string }) => Promise<InvoicingSummary>;
  fetchInvoicingSeries: (opts: { from?: string; to?: string }) => Promise<InvoicingSeriesPoint[]>;
  fetchApAging: (opts?: { from?: string; to?: string }) => Promise<ApAging>;
  fetchVatReport: (opts?: { from?: string; to?: string }) => Promise<VatReport>;
  fetchDocumentRelated: (id: string) => Promise<DocRelated>;
  attachDocument: (id: string, file: { file_id: string; filename?: string }) => Promise<void>;
  removeAttachment: (id: string) => Promise<void>;
}

export const useFinanceBillingStore = create<FinanceBillingState>((set, get) => ({
  contacts: [],
  taxRates: [],
  documents: [],
  currentDoc: null,
  selectedContactId: null,
  loading: false,
  error: null,

  fetchFinanceContacts: async (filters) => {
    const r = await api.get<{ data: FinanceContact[] }>('/finance/contacts', filters as Record<string, string | undefined>);
    set({ contacts: r.data });
  },
  fetchContactDetail: async (id) => {
    const r = await api.get<{ data: FinanceContactDetail }>(`/finance/contacts/${id}`);
    return r.data;
  },
  fetchTaxRates: async () => {
    const r = await api.get<{ data: TaxRate[] }>('/finance/tax-rates');
    set({ taxRates: r.data });
  },
  fetchDocuments: async (filters) => {
    const r = await api.get<{ data: FinanceDoc[] }>('/finance/documents', filters as Record<string, string | undefined>);
    set({ documents: r.data });
  },
  fetchDocument: async (id) => {
    const r = await api.get<{ data: FinanceDocDetail }>(`/finance/documents/${id}`);
    set({ currentDoc: r.data });
  },
  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([get().fetchFinanceContacts(), get().fetchTaxRates(), get().fetchDocuments()]);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error al cargar facturación' });
    } finally {
      set({ loading: false });
    }
  },
  setSelectedContact: (id) => set({ selectedContactId: id }),

  saveFinanceContact: async (data) => {
    const { id, ...body } = data;
    const r = id
      ? await api.patch<{ data: FinanceContact }>(`/finance/contacts/${id}`, body)
      : await api.post<{ data: FinanceContact }>('/finance/contacts', body);
    await get().fetchFinanceContacts();
    return r.data;
  },
  tagContact: async (contactId, role) => {
    const r = await api.post<{ data: FinanceContact }>(`/finance/contacts/${contactId}/role`, { role });
    await get().fetchFinanceContacts();
    return r.data;
  },
  createTaxRate: async (data) => {
    const r = await api.post<{ data: TaxRate }>('/finance/tax-rates', data);
    await get().fetchTaxRates();
    return r.data;
  },
  deleteTaxRate: async (id) => {
    await api.delete(`/finance/tax-rates/${id}`);
    await get().fetchTaxRates();
  },
  fetchEmailAccounts: async () => {
    const r = await api.get<{ data: EmailAccount[] }>('/finance/email-accounts');
    return r.data;
  },
  sendInvoice: async (id, opts) => {
    const r = await api.post<{ data: { email_id: string; to: string[]; filename: string } }>(`/finance/documents/${id}/send`, opts ?? {});
    return r.data;
  },

  createDocument: async (data) => {
    const r = await api.post<{ data: FinanceDocDetail }>('/finance/documents', data);
    await get().fetchDocuments();
    set({ currentDoc: r.data });
    return r.data;
  },
  updateDocument: async (id, patch) => {
    await api.patch(`/finance/documents/${id}`, patch);
    // Refresca el detalle (currentDoc) y la lista para reflejar notas/condiciones/descuento.
    await Promise.all([get().fetchDocument(id), get().fetchDocuments()]);
  },
  addLine: async (docId, line) => {
    await api.post(`/finance/documents/${docId}/lines`, line);
    await get().fetchDocument(docId);
  },
  updateLine: async (docId, lineId, line) => {
    await api.patch(`/finance/documents/${docId}/lines/${lineId}`, line);
    await get().fetchDocument(docId);
  },
  removeLine: async (docId, lineId) => {
    await api.delete(`/finance/documents/${docId}/lines/${lineId}`);
    await get().fetchDocument(docId);
  },
  emitDocument: async (id) => {
    await api.post(`/finance/documents/${id}/emit`);
    await Promise.all([get().fetchDocuments(), get().fetchDocument(id)]);
  },
  recordPayment: async (input) => {
    await api.post('/finance/payments', input);
    await Promise.all([get().fetchDocuments(), get().fetchDocument(input.document_id)]);
  },
  createCreditNote: async (input) => {
    await api.post('/finance/credit-notes', input);
    await Promise.all([get().fetchDocuments(), get().fetchDocument(input.invoice_id)]);
  },
  acceptQuote: async (id) => {
    await api.post(`/finance/documents/${id}/accept`);
    await Promise.all([get().fetchDocuments(), get().fetchDocument(id)]);
  },
  declineQuote: async (id) => {
    await api.post(`/finance/documents/${id}/decline`);
    await Promise.all([get().fetchDocuments(), get().fetchDocument(id)]);
  },
  convertQuote: async (id) => {
    const r = await api.post<{ data: FinanceDocDetail }>(`/finance/documents/${id}/convert`);
    await Promise.all([get().fetchDocuments(), get().fetchDocument(id)]);
    return r.data;
  },

  fetchBrand: async () => {
    const r = await api.get<{ data: Brand }>('/finance/brand');
    return r.data;
  },
  saveBrand: async (b) => {
    const r = await api.put<{ data: Brand }>('/finance/brand', b);
    return r.data;
  },
  fetchPreviewHtml: async (docId) => {
    const r = await api.get<{ data: { html: string } }>(`/finance/documents/${docId}/preview`);
    return r.data.html;
  },

  fetchCompany: async () => {
    const r = await api.get<{ data: Company | null }>('/finance/company');
    return r.data ?? null;
  },
  saveCompany: async (c) => {
    const r = await api.put<{ data: Company }>('/finance/company', c);
    return r.data;
  },

  fetchCrossDomainSettings: async () => {
    const r = await api.get<{ data: { bill_propose_items: boolean } }>('/finance/cross-domain-settings');
    return r.data;
  },
  saveCrossDomainSettings: async (s) => {
    const r = await api.put<{ data: { bill_propose_items: boolean } }>('/finance/cross-domain-settings', s);
    return r.data;
  },

  fetchInvoicingSummary: async (opts) => {
    const r = await api.get<{ data: InvoicingSummary }>(
      '/finance/summary/invoicing',
      opts as Record<string, string | number | undefined> | undefined,
    );
    return r.data;
  },
  fetchInvoicingSeries: async ({ from, to }) => {
    const r = await api.get<{ data: InvoicingSeriesPoint[] }>(
      '/finance/summary/invoicing-series',
      { from, to } as Record<string, string | undefined>,
    );
    return r.data;
  },
  fetchApAging: async (opts) => {
    const r = await api.get<{ data: ApAging }>(
      '/finance/summary/ap-aging',
      opts as Record<string, string | undefined> | undefined,
    );
    return r.data;
  },
  fetchVatReport: async (opts) => {
    const r = await api.get<{ data: VatReport }>('/finance/reports/vat', opts as Record<string, string | undefined> | undefined);
    return r.data;
  },
  fetchDocumentRelated: async (id) => {
    const r = await api.get<{ data: DocRelated }>(`/finance/documents/${id}/related`);
    return r.data;
  },
  attachDocument: async (id, file) => {
    await api.post(`/finance/documents/${id}/attachment`, file);
    await get().fetchDocument(id);
  },
  removeAttachment: async (id) => {
    await api.delete(`/finance/documents/${id}/attachment`);
    await get().fetchDocument(id);
  },
}));
