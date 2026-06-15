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

// El backend serializa SIEMPRE snake_case (case-transform.ts).

export interface InventoryLocation {
  id: string;
  name: string;
  parent_id: string | null;
  kind: 'room' | 'container' | 'vehicle' | 'storage' | 'other';
  photo_file_id: string | null;
  notes: string | null;
  tags: string[] | null;
  item_count: number;
  total_value: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  location_id: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  quantity: string;
  uom: string;
  purchase_date: string | null;
  purchase_price: string | null;
  currency: string;
  warranty_until: string | null;
  status: string;
  lent_to_contact_id: string | null;
  lent_at: string | null;
  lent_until: string | null;
  supplier_contact_id: string | null;
  supplier_sku: string | null;
  lead_time_days: number | null;
  track_stock: boolean;
  min_qty: string | null;
  meter_value: string | null;
  meter_unit: string | null;
  meter_updated_at: string | null;
  photo_file_ids: string[] | null;
  file_ids: string[] | null;
  tags: string[] | null;
  custom_fields: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryEvent {
  id: string;
  item_id: string;
  type: 'acquired' | 'moved' | 'lent' | 'returned' | 'maintenance' | 'repair' | 'valuation' | 'claim' | 'disposed' | 'meter_reading';
  date: string;
  notes: string | null;
  cost: string | null;
  next_due: string | null;
  recurrence_months: number | null;
  meter_value: string | null;
  due_meter: string | null;
  recurrence_meter: string | null;
  contact_id: string | null;
  photo_file_ids: string[] | null;
  tags: string[] | null;
  created_by: string;
  created_at: string;
}

export interface InventoryMove {
  id: string;
  item_id: string;
  type: string;
  qty_delta: string;
  uom: string;
  unit_cost: string | null;
  currency: string;
  from_location_id: string | null;
  to_location_id: string | null;
  contact_id: string | null;
  ref_type: string | null;
  ref_id: string | null;
  doc_file_id: string | null;
  supplier_lot: string | null;
  occurred_at: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  running_balance?: string | null;
}

export interface InventoryProposal {
  id: string;
  source: 'email' | 'chat' | 'photo' | 'receipt' | 'flow';
  source_ref: string | null;
  group_ref: string | null;
  payload: ProposalPayload;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  resolved_at: string | null;
}

export interface ProposalPayload {
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  quantity?: number;
  purchase_date?: string;
  purchase_price?: number;
  currency?: string;
  warranty_until?: string;
  supplier_contact_id?: string;
  supplier_name?: string;
  location_id?: string;
  file_ids?: string[];
  photo_file_ids?: string[];
  tags?: string[];
  vendor_order_ref?: string;
  [key: string]: unknown;
}

export interface InventoryAlerts {
  warranties_expiring: InventoryItem[];
  low_stock: InventoryItem[];
  active_loans: InventoryItem[];
  pending_proposals: number;
  upcoming_maintenance: InventoryEvent[];
}

export interface InventoryValuation {
  at: string;
  total: number;
  group_by: 'category' | 'location';
  groups: Array<{ key: string; value: number; item_count: number }>;
  lines: Array<{ item_id: string; name: string; category: string; location_id: string | null; qty: number; unit_value: number; value: number }>;
}

export interface InventoryMeta {
  system_statuses: string[];
  move_types: string[];
  event_types: string[];
  location_kinds: string[];
}

/** Estados de sistema con label/semántica para la UI. */
export const SYSTEM_STATUS_LABELS: Record<string, string> = {
  owned: 'En uso',
  lent: 'Prestado',
  in_repair: 'En reparación',
  sold: 'Vendido',
  disposed: 'Baja',
  lost: 'Perdido',
};

export const STATUS_PILL_MAP: Record<string, string> = {
  owned: 'running',      // verde
  lent: 'warn',          // naranja
  in_repair: 'degraded',
  sold: 'stopped',
  disposed: 'stopped',
  lost: 'error',
};

/** Thumbnail de un file_id (servido por el core). */
export function thumbUrl(fileId: string): string {
  return `/api/v1/files/${fileId}/thumbnail`;
}

export function fmtMoney(value: string | number | null | undefined, currency = 'EUR'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 });
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86400000);
}

/** "87.400 km" — formato del contador de desgaste. */
export function fmtMeter(value: string | number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ''}`;
}

export function daysSince(date: string | null): number | null {
  if (!date) return null;
  const from = new Date(date).getTime();
  if (Number.isNaN(from)) return null;
  return Math.floor((Date.now() - from) / 86400000);
}
