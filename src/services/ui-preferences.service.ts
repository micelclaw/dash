import { api } from './api';

export interface AutomationExpanded { cron: boolean; hooks: boolean }
export const DEFAULT_AUTOMATION_EXPANDED: AutomationExpanded = { cron: true, hooks: false };
export interface UiPreferences {
  sidebar: { user_collapsed: boolean; pinned: boolean; module_order: Record<string, string[]>; hidden_modules: string[] };
  calendar: { view: 'day' | 'week' | 'month' | 'agenda' | null };
  drive: { density: 'comfortable' | 'compact'; inspector_open: boolean; inspector_tab: 'details' | 'activity' | 'versions' };
  settings_groups: Record<string, boolean>;
  automation?: AutomationExpanded;
}
export type UiPreferencesPatch = Omit<Partial<UiPreferences>, 'automation'> & { automation?: Partial<AutomationExpanded> };
export interface UiPreferencesResponse { preferences: UiPreferences; revision: string; legacy_decision: 'pending' | 'adopted' | 'dismissed' }
export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  sidebar: { user_collapsed: false, pinned: true, module_order: {}, hidden_modules: [] }, calendar: { view: null },
  drive: { density: 'comfortable', inspector_open: true, inspector_tab: 'details' }, settings_groups: {}, automation: { ...DEFAULT_AUTOMATION_EXPANDED },
};
export const uiPreferencesApi = {
  read: async () => (await api.get<{ data: UiPreferencesResponse }>('/configuration/ui-preferences')).data,
  patch: async (patch: UiPreferencesPatch, expected_revision: string) => (await api.patch<{ data: UiPreferencesResponse }>('/configuration/ui-preferences', { patch, expected_revision })).data,
  legacy: async (decision: 'adopt' | 'dismiss', expected_revision: string, preferences?: UiPreferencesPatch) => (await api.post<{ data: UiPreferencesResponse }>('/configuration/ui-preferences/legacy', { decision, expected_revision, preferences })).data,
};

/** Read only the old allowlisted UI keys. Nothing is attributed to the current user here. */
export function readLegacyUiPreferences(storage: Pick<Storage, 'getItem'>): Partial<UiPreferences> | null {
  const read = (key: string): Record<string, unknown> | null => {
    try { const value = JSON.parse(storage.getItem(key) ?? 'null'); const state = value?.state ?? value; return state && typeof state === 'object' && !Array.isArray(state) ? state : null; } catch { return null; }
  };
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 200 && value.every(v => typeof v === 'string' && /^[\w.:-]{1,160}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v));
  const next: Partial<UiPreferences> = {};
  const sidebar = read('claw-sidebar');
  if (sidebar) {
    const order: Record<string, string[]> = {};
    if (sidebar.moduleOrder && typeof sidebar.moduleOrder === 'object' && !Array.isArray(sidebar.moduleOrder)) {
      for (const [key, value] of Object.entries(sidebar.moduleOrder)) if (strings([key]) && strings(value)) order[key] = value;
    }
    next.sidebar = { user_collapsed: sidebar.userCollapsed === true, pinned: typeof sidebar.pinned === 'boolean' ? sidebar.pinned : true, module_order: order, hidden_modules: strings(sidebar.hiddenModules) ? sidebar.hiddenModules : [] };
  }
  const calendar = read('claw-calendar-ui');
  if (calendar && (calendar.view === null || ['day', 'week', 'month', 'agenda'].includes(calendar.view as string))) next.calendar = { view: calendar.view as UiPreferences['calendar']['view'] };
  const drive = read('claw-drive');
  if (drive) next.drive = { density: drive.density === 'compact' ? 'compact' : 'comfortable', inspector_open: typeof drive.inspectorOpen === 'boolean' ? drive.inspectorOpen : true, inspector_tab: ['details', 'activity', 'versions'].includes(drive.inspectorTab as string) ? drive.inspectorTab as UiPreferences['drive']['inspector_tab'] : 'details' };
  const groups = read('settings-sidebar-groups');
  if (groups) {
    next.settings_groups = {};
    for (const [key, value] of Object.entries(groups)) if (['account', 'appearance', 'ai-agents', 'apps', 'connectivity', 'system', 'security', 'admin', 'dev'].includes(key) && typeof value === 'boolean') next.settings_groups[key] = value;
  }
  const automation = read('settings.automation.expanded');
  if (automation) next.automation = { cron: typeof automation.cron === 'boolean' ? automation.cron : DEFAULT_AUTOMATION_EXPANDED.cron, hooks: typeof automation.hooks === 'boolean' ? automation.hooks : DEFAULT_AUTOMATION_EXPANDED.hooks };
  return Object.keys(next).length ? next : null;
}
