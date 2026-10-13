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
export interface NoteSyncState {
  provider: string;
  label: string;
  state: 'synced' | 'pending' | 'conflict' | 'paused' | 'unavailable';
  owner: boolean;
  content_edit: 'structured_required';
  write_certified: boolean;
  remote_editable?: boolean;
  delete_certified?: boolean;
  title_certified?:boolean;
  favorite_certified?:boolean;
  resource_certified?:boolean;
  local_metadata_editable: boolean;
  connector_id?: string;
  local_revision?: string;
}
export interface NoteAttachment {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: 'copied' | 'external';
  reason?: 'unsupported' | 'too_large' | 'unsafe_destination' | 'unavailable';
  /** Stable resource marker, never a provider URL or credential. */
  resource_ref?: string;
  replace_supported?:boolean;
}
export interface Note extends OriginEntity {
  /** Owner-only conservation archive, including preserved native content after disconnect. */
  native_export_available?: boolean;
  id: string;
  title: string | null;
  content: string;
  content_format: 'markdown' | 'html' | 'plain';
  source: string;
  source_id: string | null;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
  heat_score?: number;
  sync?: NoteSyncState | null;
  _shared_permission?: 'read' | 'write';
}

export interface NoteCreateInput {
  title?: string;
  content: string;
  content_format?: 'markdown' | 'html' | 'plain';
  tags?: string[];
  pinned?: boolean;
  custom_fields?: Record<string, unknown>;
}

export interface NoteUpdateInput {
  title?: string;
  content?: string;
  content_format?: string;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
  custom_fields?: Record<string, unknown>;
}

export interface NoteFilters {
  search?: string;
  tag?: string;
  source?: string;
  pinned?: boolean;
  archived?: boolean;
  sort?: 'updated_at' | 'created_at' | 'title';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
