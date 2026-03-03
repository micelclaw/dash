export interface Email {
  id: string;
  message_id: string | null;
  thread_id: string | null;
  subject: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: { address: string; name?: string }[];
  cc_addresses: { address: string; name?: string }[];
  bcc_addresses: { address: string; name?: string }[];
  body_plain: string | null;
  body_html: string | null;
  has_attachments: boolean;
  attachments: { filename: string; mime: string; size: number; path?: string }[];
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

export interface EmailAccount {
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

export const SMART_CATEGORIES = ['Primary', 'Updates', 'Social', 'Promotions'] as const;
