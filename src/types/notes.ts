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

export interface Note {
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
