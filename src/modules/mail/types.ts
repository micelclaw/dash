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

import type { OriginEntity } from '@/types/origins';
export interface Email extends OriginEntity {
  id: string;
  message_id: string | null;
  thread_id: string | null;
  subject: string | null;
  from_address: string;
  from_name: string | null;
  // Estas cuatro llegan a NULO de verdad (la base de datos las admite y los
  // conectores no siempre las rellenan): medido, 360 correos con adjunto y la
  // lista a nulo, y 106 sin copia. El tipo decía que siempre eran listas, así
  // que nadie protegía nada y `attachments.length` tiraba la pantalla entera
  // con «Cannot read properties of null» — abrir ESE correo era imposible.
  // Declararlo como es hace que el compilador exija la protección.
  to_addresses: { address: string; name?: string }[] | null;
  cc_addresses: { address: string; name?: string }[] | null;
  bcc_addresses: { address: string; name?: string }[] | null;
  body_plain: string | null;
  body_html: string | null;
  has_attachments: boolean;
  /** Con adjunto pero sin lista es un estado REAL: se sabe que hay, no cuáles. */
  attachments: { filename: string; mime: string; size: number; path?: string; source_id?: string }[] | null;
  folder: string;
  is_read: boolean;
  is_starred: boolean;
  custom_fields: Record<string, unknown> | null;
  received_at: string;
  source: string;
  source_id: string | null;
  account_id: string | null;
  status: 'received' | 'draft' | 'queued' | 'sending' | 'sent' | 'failed';
  in_reply_to: string | null;
  references: string[];
  labels: string[];
  snoozed_until: string | null;
  pre_snooze_folder: string | null;
  scheduled_at: string | null;
  send_attempts: number;
  heat_score?: number;
  next_retry_at: string | null;
  send_error: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface EmailAccount extends OriginEntity {
  id: string;
  name: string;
  email_address: string;
  display_name: string | null;
  color: string;
  icon: string | null;
  is_default: boolean;
  auth_method: 'password' | 'oauth';
  has_credentials: boolean;
  status: 'connected' | 'error' | 'disconnected';
  last_sync_at: string | null;
  created_at: string;
}

/** Must stay within SORT_COLUMNS in core's domain/emails.repo.ts. */
export type MailSortField = 'received_at' | 'from' | 'subject' | 'category';
export type MailSortOrder = 'asc' | 'desc';

export const MAIL_SORT_OPTIONS: { field: MailSortField; label: string }[] = [
  { field: 'received_at', label: 'Date' },
  { field: 'from', label: 'From' },
  { field: 'subject', label: 'Subject' },
  { field: 'category', label: 'Category' },
];

export interface EmailFilters {
  account_id?: string;
  folder?: string;
  search?: string;
  is_read?: boolean;
  is_starred?: boolean;
  has_attachments?: boolean;
  label?: string;
  status?: string;
  thread_id?: string;
  sort?: MailSortField;
  order?: MailSortOrder;
  limit?: number;
  offset?: number;
}

export interface ComposeData {
  mode: 'new' | 'reply' | 'reply_all' | 'forward' | 'edit_draft';
  to?: { address: string; name?: string }[];
  cc?: { address: string; name?: string }[];
  subject?: string;
  body_html?: string;
  in_reply_to?: string;
  original_email?: Email;
  account_id?: string;
  draft_id?: string;
}

export const SYSTEM_FOLDERS = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM', 'OUTBOX', 'SNOOZED'] as const;
