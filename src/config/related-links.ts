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

// SSOT compartido para los paneles "Relacionados" (entity_links) de TODOS los
// módulos. Antes cada hook (use-note-links, use-email-links, …) tenía su propio
// DOMAIN_MAP/ROUTE_MAP que actuaba de allowlist → los chips de finanzas e
// inventario se descartaban. Centralizando aquí, cualquier registro enlazado de
// cualquier dominio (note/contact/email/event/file/diary/kanban_card/inventory/
// finance_document/finance_journal_entry) resuelve título+ruta y se
// pinta en el panel (el icono/color/label ya los da resolveEntity de entity-refs).

import { api } from '@/services/api';
import type { EntityLink, LinkedRecord } from '@/types/links';

// endpoint de detalle + campo del que sacar el título legible. Las claves cubren
// la forma SINGULAR y PLURAL en que entity_links guarda cada dominio.
const DOMAIN_MAP: Record<string, { endpoint: string; titleField: string }> = {
  note: { endpoint: '/notes', titleField: 'title' }, notes: { endpoint: '/notes', titleField: 'title' },
  email: { endpoint: '/emails', titleField: 'subject' }, emails: { endpoint: '/emails', titleField: 'subject' },
  event: { endpoint: '/events', titleField: 'title' }, events: { endpoint: '/events', titleField: 'title' },
  contact: { endpoint: '/contacts', titleField: 'display_name' }, contacts: { endpoint: '/contacts', titleField: 'display_name' },
  file: { endpoint: '/files', titleField: 'filename' }, files: { endpoint: '/files', titleField: 'filename' },
  diary: { endpoint: '/diary', titleField: 'entry_date' }, diary_entries: { endpoint: '/diary', titleField: 'entry_date' },
  inventory_item: { endpoint: '/inventory/items', titleField: 'name' }, inventory: { endpoint: '/inventory/items', titleField: 'name' },
  // Finanzas NATIVAS (GET de detalle verificados: documents/transactions/:id).
  // Los clientes/proveedores son CONTACTOS (dominio `contact`, ya mapeado arriba).
  finance_document: { endpoint: '/finance/documents', titleField: 'number' },
  finance_journal_entry: { endpoint: '/finance/transactions', titleField: 'description' },
  // Tarea del kanban. Desde la ola 1 SÍ hay endpoint plano (`GET /projects/cards/:id`),
  // así que el panel de Relacionados enseña el título real en vez de la palabra "Tarjeta".
  kanban_card: { endpoint: '/projects/cards', titleField: 'title' },
  kanban_cards: { endpoint: '/projects/cards', titleField: 'title' },
};

const ROUTE_MAP: Record<string, string> = {
  note: '/notes', notes: '/notes',
  event: '/calendar', events: '/calendar',
  contact: '/contacts', contacts: '/contacts',
  email: '/mail', emails: '/mail',
  file: '/drive', files: '/drive',
  diary: '/diary', diary_entries: '/diary',
  kanban_card: '/projects', kanban_cards: '/projects',
};

// Título de respaldo (mientras carga / si el registro fue borrado o no tiene enrich).
const FALLBACK_LABEL: Record<string, string> = {
  note: 'Nota', notes: 'Nota', event: 'Evento', events: 'Evento',
  contact: 'Contacto', contacts: 'Contacto', email: 'Email', emails: 'Email',
  file: 'Archivo', files: 'Archivo', diary: 'Diario', diary_entries: 'Diario',
  kanban_card: 'Tarjeta', kanban_cards: 'Tarjeta', inventory_item: 'Artículo', inventory: 'Artículo',
  finance_document: 'Factura', finance_journal_entry: 'Movimiento',
};

// Etiqueta legible de la relación (subtítulo de la chip).
export const RELATIONSHIP_LABEL: Record<string, string> = {
  mentions: 'Mencionado', related_to: 'Relacionado',
  purchased_item: 'Comprado en esta factura', sold_item: 'Vendido en esta factura',
  billed_to: 'Facturado a', billed_by: 'Facturado por', billed_to_contact: 'Contacto de facturación',
  settled_by: 'Pagado con', paid_from: 'Pagado desde', paid_into: 'Cobrado en', paid_by: 'Pagado por',
  billing_party: 'Cliente/proveedor',
};

/** Ruta de navegación de la chip por dominio (finanzas usan ?doc=/?contact=/tab=personal). */
export function relatedRouteFor(domain: string, recordId: string): string {
  if (domain === 'inventory_item' || domain === 'inventory') return '/inventory?tab=catalog';
  if (domain === 'finance_document') return `/finance?tab=facturacion&doc=${recordId}`;
  if (domain === 'finance_journal_entry') return '/finance?tab=personal';
  return `${ROUTE_MAP[domain] || '/'}?id=${recordId}`;
}

/** Convierte un entity_link en el registro enlazado (el "otro lado" del link). */
export function resolveLink(link: EntityLink, currentId: string): LinkedRecord {
  const isSource = link.source_id === currentId;
  const domain = isSource ? link.target_type : link.source_type;
  const recordId = isSource ? link.target_id : link.source_id;
  return {
    link,
    domain,
    record: {
      id: recordId,
      title: FALLBACK_LABEL[domain] ?? 'Registro',
      subtitle: RELATIONSHIP_LABEL[link.relationship ?? ''] ?? (link.relationship || link.link_type),
      route: relatedRouteFor(domain, recordId),
    },
  };
}

/** Enriquece en paralelo los títulos reales (best-effort; si falla, deja el label). */
export async function enrichLinkedRecords(records: LinkedRecord[]): Promise<void> {
  await Promise.allSettled(records.map(async (rec) => {
    const config = DOMAIN_MAP[rec.domain];
    if (!config) return; // sin endpoint de detalle (p.ej. kanban_card) → se queda el label
    try {
      const res = await api.get<{ data: Record<string, unknown> }>(`${config.endpoint}/${rec.record.id}`);
      const d = res.data ?? {};
      const title = d[config.titleField] ?? d.name ?? d.title ?? d.number ?? d.description ?? d.display_name ?? d.subject ?? d.filename;
      if (title) rec.record.title = String(title);
      rec.record.subtitle = RELATIONSHIP_LABEL[rec.link.relationship ?? ''] ?? String(rec.link.relationship || rec.link.link_type || '');
    } catch {
      // registro borrado o sin permiso → se queda el label de respaldo
    }
  }));
}
