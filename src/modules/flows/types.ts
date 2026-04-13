/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

// Re-export from store for convenience
export type { Flow, FlowRun, FlowStep, StepTypeDefinition, FlowStats } from '@/stores/flows.store';

// Step category metadata for the palette
export interface StepCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const STEP_CATEGORIES: StepCategory[] = [
  { id: 'email', label: 'Email', icon: 'Mail', color: 'var(--mod-mail)' },
  { id: 'notes', label: 'Notes', icon: 'StickyNote', color: 'var(--mod-notes)' },
  { id: 'calendar', label: 'Calendar', icon: 'Calendar', color: 'var(--mod-calendar)' },
  { id: 'contacts', label: 'Contacts', icon: 'Users', color: 'var(--mod-contacts)' },
  { id: 'kanban', label: 'Projects', icon: 'Kanban', color: 'var(--mod-projects)' },
  { id: 'photos', label: 'Photos', icon: 'Image', color: 'var(--mod-photos)' },
  { id: 'diary', label: 'Diary', icon: 'BookOpen', color: 'var(--mod-diary)' },
  { id: 'files', label: 'Files', icon: 'FolderOpen', color: 'var(--mod-drive)' },
  { id: 'feeds', label: 'Feeds', icon: 'Rss', color: 'var(--mod-feeds)' },
  { id: 'search', label: 'Search', icon: 'Search', color: 'var(--mod-search)' },
  { id: 'ai', label: 'AI', icon: 'Brain', color: '#ec4899' },
  { id: 'notification', label: 'Notify', icon: 'Bell', color: '#f59e0b' },
  { id: 'home', label: 'Home', icon: 'Home', color: '#06b6d4' },
  { id: 'system', label: 'System', icon: 'Activity', color: '#ef4444' },
  { id: 'control', label: 'Control', icon: 'ShieldCheck', color: '#6b7280' },
  { id: 'agent', label: 'Agent', icon: 'Bot', color: 'var(--mod-agents)' },
];

export const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual', description: 'Run only when you click Execute' },
  { value: 'cron', label: 'Scheduled', description: 'Run on a schedule' },
  { value: 'event', label: 'Event', description: 'Run when something happens' },
  { value: 'sensor', label: 'Sensor', description: 'Run on Home Assistant event' },
  { value: 'webhook', label: 'Webhook', description: 'Run from external URL' },
  { value: 'context', label: 'Context', description: 'Run on context change' },
];
