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

// ─── Core entities ────────────────────────────────────

import type { OriginEntity } from '@/types/origins';
export interface Board extends OriginEntity {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  default_view: string | null;
  swimlane_field: string | null;
  settings: BoardSettings;
  archived: boolean;
  position: number;
  tags: string[] | null;
  card_counter: number;
  /**
   * El tablero "Personal": donde caen las tareas que no son de ningún proyecto.
   * Uno por usuario. Se FILTRA de la rejilla (si no, sus tareas se verían dos
   * veces: en la bandeja de la izquierda y en su baldosa), pero es un tablero
   * normal en la base — se renombra, se comparte y se archiva.
   */
  is_default?: boolean;
  /** Identidad del origen para distinguir tableros locales de espejos externos. */
  source?: string;
  source_id?: string | null;
  connector_id?: string | null;
  /** Marca resuelta por Core (Todoist, Notion, Nextcloud…), nunca inferida por título. */
  _provider_slug?: string | null;
  created_at: string;
  updated_at: string;
  _permission?: 'owner' | 'edit' | 'view';
  /** Contadores que el backend ya calculaba para los agentes y el dash no pedía. */
  _card_count?: number;
  _done_count?: number;
  _overdue_count?: number;
}

export interface BoardSettings {
  background?: { type: 'color' | 'gradient' | 'image'; value: string };
  cardCoverDefault?: 'normal' | 'full' | 'none';
  showCardNumbers?: boolean;
  defaultPriority?: string;
  cardAging?: { enabled: boolean; daysToAge: number };
  calendarSync?: { enabled: boolean; calendarName: string; syncCompletedCards: boolean };
}

export interface Column {
  id: string;
  board_id: string;
  title: string;
  color: string | null;
  position: number;
  wip_limit: number | null;
  /** A qué estado del estándar equivale esta columna. `null` = a ninguno, y es
   *  legítimo: "Bloqueado" no es ninguno de los cuatro. Ver utils/status-semantic. */
  status_semantic: 'needs_action' | 'in_progress' | 'completed' | 'cancelled' | null;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Card extends OriginEntity {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: string | null;
  color: string | null;
  due_date: string | null;
  start_date: string | null;
  all_day?: boolean;
  start_all_day?: boolean;
  due_all_day?: boolean;
  timezone?: string | null;
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  assignee_ids: string[] | null;
  external_assignees?: ExternalAssignee[] | null;
  tags: string[] | null;
  checklist: ChecklistItem[] | null;
  attachment_ids: string[] | null;
  cover_image_id: string | null;
  custom_fields: Record<string, unknown> | null;
  recurrence?: unknown;
  reminders?: unknown;
  source?: string;
  source_id?: string | null;
  connector_id?: string | null;
  remote_url?: string | null;
  external_payload?: Record<string, unknown> | null;
  status?: string;
  percent_complete?: number | null;
  created_by: string | null;
  parent_card_id: string | null;
  card_number: number | null;
  cover_color: string | null;
  cover_size: 'normal' | 'full' | null;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ExternalAssignee {
  provider_id?: string;
  providerId?: string;
  display_name?: string;
  displayName?: string;
  email?: string | null;
  avatar_url?: string | null;
  provider_slug?: string;
  providerSlug?: string;
  is_current_user?: boolean;
}

// ─── Extended entities ────────────────────────────────

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  type: 'comment' | 'activity';
  content: string | null;
  activity_action: string | null;
  activity_meta: Record<string, unknown> | null;
  connector_id?: string | null;
  source?: string;
  source_id?: string | null;
  remote_author?: { id?: string; display_name?: string; displayName?: string; email?: string | null; avatar_url?: string | null; avatarUrl?: string | null } | null;
  remote_created_at?: string | null;
  remote_metadata?: Record<string, unknown> | null;
  edited_at: string | null;
  created_at: string;
}

export interface Dependency {
  id: string;
  blocking_card_id: string;
  blocked_card_id: string;
  type: string;
  created_by: string | null;
  created_at: string;
}

export interface CustomFieldDef {
  id: string;
  board_id: string;
  name: string;
  type: CustomFieldType;
  options: unknown;
  required: boolean;
  position: number;
  show_on_card: boolean;
  created_at: string;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'url';

export interface Checklist {
  id: string;
  card_id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface Automation {
  id: string;
  board_id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  execution_count: number;
  last_executed: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardTemplate {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  template_data: unknown;
  is_system: boolean;
  created_at: string;
}

export interface EntityLink {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string;
  created_at: string;
}

// ─── Composite types ─────────────────────────────────

export interface ColumnWithCards extends Column {
  cards: Card[];
}

export interface FullBoard extends Board {
  columns: ColumnWithCards[];
  custom_field_defs?: CustomFieldDef[];
}

// ─── Filter / UI state ───────────────────────────────

export interface CardFilters {
  priority?: string;
  assignee_id?: string;
  tag?: string;
  due_before?: string;
  due_after?: string;
  completed?: boolean;
  has_dependencies?: boolean;
  is_blocked?: boolean;
  show_archived?: boolean;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export type ViewMode = 'board' | 'list' | 'timeline' | 'calendar' | 'dashboard';

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface DragState {
  activeId: string | null;
  activeType: 'card' | 'column' | null;
  overId: string | null;
  overType: 'card' | 'column' | null;
}

// ─── Multi-select ────────────────────────────────────

export interface MultiSelectState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}
