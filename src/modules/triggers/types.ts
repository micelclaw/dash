/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Ola 4 — Type definitions for the event-trigger UI.
 * Mirrors the snake_case shape of `/api/v1/event-triggers` responses.
 */

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type ActionType =
  | 'flow.start'
  | 'event.emit'
  | 'push.send'
  | 'webhook.call'
  | 'audit.persist';

export interface EventTrigger {
  id: string;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  match_pattern: string;
  severity_min: EventSeverity | null;
  condition: unknown;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  rate_limit: { max: number; window_ms: number } | null;
  enabled: boolean;
  last_fired_at: string | null;
  fire_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriggerActionFieldDescriptor {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'enum';
  values?: string[];
  required: boolean;
}

export interface TriggerActionMeta {
  action_types: ActionType[];
  action_configs: Record<ActionType, { fields: TriggerActionFieldDescriptor[] }>;
}
