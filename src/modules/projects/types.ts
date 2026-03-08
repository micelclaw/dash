// ─── Core entities ────────────────────────────────────

export interface Board {
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
  created_at: string;
  updated_at: string;
  _permission?: 'owner' | 'edit' | 'view';
}

export interface BoardSettings {
  background?: { type: 'color' | 'gradient' | 'image'; value: string };
  cardCoverDefault?: 'normal' | 'full' | 'none';
  showCardNumbers?: boolean;
  showLabelsText?: boolean;
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
  is_done_column: boolean;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Card {
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
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  assignee_ids: string[] | null;
  tags: string[] | null;
  checklist: ChecklistItem[] | null;
  attachment_ids: string[] | null;
  cover_image_id: string | null;
  custom_fields: Record<string, unknown> | null;
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

// ─── Extended entities ────────────────────────────────

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  type: 'comment' | 'activity';
  content: string | null;
  activity_action: string | null;
  activity_meta: Record<string, unknown> | null;
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
  labels?: Label[];
  custom_field_defs?: CustomFieldDef[];
}

// ─── Filter / UI state ───────────────────────────────

export interface CardFilters {
  priority?: string;
  assignee_id?: string;
  tag?: string;
  label_id?: string;
  due_before?: string;
  due_after?: string;
  completed?: boolean;
  has_dependencies?: boolean;
  is_blocked?: boolean;
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
