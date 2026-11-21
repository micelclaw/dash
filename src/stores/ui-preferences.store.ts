import { create } from 'zustand';
import { ApiError } from '@/services/api';
import { DEFAULT_AUTOMATION_EXPANDED, DEFAULT_UI_PREFERENCES, readLegacyUiPreferences, uiPreferencesApi, type AutomationExpanded, type UiPreferences, type UiPreferencesPatch, type UiPreferencesResponse } from '@/services/ui-preferences.service';
import { useSidebarStore } from './sidebar.store';
import { useCalendarUiStore } from './calendar-ui.store';
import { useDriveStore } from './drive.store';

interface UiPreferencesState {
  userId: string | null; ready: boolean; saving: boolean; error: string | null;
  preferences: UiPreferences; revision: string; legacy: Partial<UiPreferences> | null; legacyDecision: UiPreferencesResponse['legacy_decision'];
  setSettingsGroups(value: Record<string, boolean>): void;
  setAutomationExpanded(panel: keyof AutomationExpanded, expanded: boolean): void;
  decideLegacy(decision: 'adopt' | 'dismiss'): Promise<void>;
  refresh(): Promise<void>;
}
let generation = 0; let readCounter = 0; let hydrating = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: UiPreferencesPatch = {};
let inFlight: symbol | undefined;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Sidebar/settings_groups retain whole-domain intent. Only Automation's two
 * independent panels accumulate field deltas through debounce and CAS retry. */
function mergePending(base: UiPreferencesPatch, patch: UiPreferencesPatch): UiPreferencesPatch {
  return { ...base, ...patch, ...(patch.automation === undefined ? {} : { automation: { ...base.automation, ...patch.automation } }) };
}
function overlayPreferences(base: UiPreferences, patch: UiPreferencesPatch): UiPreferences {
  const { automation, ...rest } = patch;
  return { ...base, ...rest, ...(automation === undefined ? {} : { automation: { ...DEFAULT_AUTOMATION_EXPANDED, ...base.automation, ...automation } }) };
}
function apply(preferences: UiPreferences, resetTransient = false) {
  hydrating = true;
  try {
    const sidebar = preferences.sidebar;
    const current = useSidebarStore.getState();
    useSidebarStore.setState({ userCollapsed: sidebar.user_collapsed, collapsed: resetTransient || current.userCollapsed !== sidebar.user_collapsed ? sidebar.user_collapsed : current.collapsed, pinned: sidebar.pinned, moduleOrder: sidebar.module_order, hiddenModules: sidebar.hidden_modules, ...(resetTransient ? { hoverExpanded: false, mobileOpen: false } : {}) });
    useCalendarUiStore.setState({ view: preferences.calendar.view });
    useDriveStore.setState({ density: preferences.drive.density, inspectorOpen: preferences.drive.inspector_open, inspectorTab: preferences.drive.inspector_tab });
  } finally { hydrating = false; }
}
function queue(patch: UiPreferencesPatch) {
  const state = useUiPreferencesStore.getState();
  if (hydrating || !state.userId) return;
  pending = mergePending(pending, patch);
  if (state.ready) ++readCounter;
  useUiPreferencesStore.setState({ preferences: overlayPreferences(state.preferences, patch), error: state.ready ? null : state.error });
  if (state.ready) { clearTimeout(timer); timer = setTimeout(() => { void flush(generation); }, 300); }
}
async function flush(expectedGeneration: number) {
  if (inFlight || expectedGeneration !== generation || !useUiPreferencesStore.getState().ready || !Object.keys(pending).length) return;
  const flight = Symbol(); inFlight = flight; const patch = pending; pending = {}; useUiPreferencesStore.setState({ saving: true });
  ++readCounter;
  try {
    let result: UiPreferencesResponse;
    try { result = await uiPreferencesApi.patch(patch, useUiPreferencesStore.getState().revision); }
    catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'UI_PREFERENCES_CHANGED' || expectedGeneration !== generation) throw error;
      const current = await uiPreferencesApi.read();
      if (expectedGeneration !== generation) return;
      result = await uiPreferencesApi.patch(patch, current.revision);
    }
    if (expectedGeneration !== generation) return;
    const preferences = overlayPreferences(result.preferences, pending);
    useUiPreferencesStore.setState({ preferences, revision: result.revision, saving: false, error: null }); apply(preferences);
  } catch {
    if (expectedGeneration === generation) {
      pending = mergePending(patch, pending);
      useUiPreferencesStore.setState({ saving: false, error: 'No se han sincronizado las preferencias. Reintenta cuando haya conexión.' });
    }
  } finally {
    if (inFlight === flight) inFlight = undefined;
    if (expectedGeneration === generation && Object.keys(pending).length && !useUiPreferencesStore.getState().error) timer = setTimeout(() => { void flush(expectedGeneration); }, 300);
  }
}
export const useUiPreferencesStore = create<UiPreferencesState>((set, get) => ({
  userId: null, ready: false, saving: false, error: null, preferences: structuredClone(DEFAULT_UI_PREFERENCES), revision: '', legacy: null, legacyDecision: 'pending',
  setSettingsGroups: settings_groups => queue({ settings_groups }),
  setAutomationExpanded: (panel, expanded) => {
    if ((panel !== 'cron' && panel !== 'hooks') || typeof expanded !== 'boolean') return;
    queue({ automation: { [panel]: expanded } });
  },
  refresh: async () => {
    const token = generation;
    if (!get().userId) return;
    if (get().ready && Object.keys(pending).length) { await flush(token); return; }
    if (inFlight) return;
    const readTicket = ++readCounter;
    try {
      const response = await uiPreferencesApi.read(); if (token !== generation || readTicket !== readCounter) return;
      const preferences = overlayPreferences(response.preferences, pending);
      set({ preferences, revision: response.revision, legacyDecision: response.legacy_decision, ready: true, error: null });
      apply(preferences);
      if (Object.keys(pending).length) timer = setTimeout(() => { void flush(token); }, 300);
    } catch { if (token === generation) set({ error: 'No se pudieron cargar las preferencias sincronizadas.' }); }
  },
  decideLegacy: async decision => {
    const token = generation;
    if (Object.keys(pending).length) await flush(token);
    const state = get();
    if (!state.userId || !state.ready || inFlight || Object.keys(pending).length) throw new ApiError('UI_PREFERENCES_BUSY', 'Espera a que se sincronicen tus preferencias y reintenta.');
    const flight = Symbol(); inFlight = flight;
    try {
      ++readCounter;
      const response = await uiPreferencesApi.legacy(decision, state.revision, decision === 'adopt' ? state.legacy ?? undefined : undefined);
      if (token !== generation) return;
      const preferences = overlayPreferences(response.preferences, pending);
      set({ preferences, revision: response.revision, legacyDecision: response.legacy_decision, legacy: null, error: null }); apply(preferences);
    } finally {
      if (inFlight === flight) inFlight = undefined;
      if (token === generation && Object.keys(pending).length && !get().error) timer = setTimeout(() => { void flush(token); }, 300);
    }
  },
}));

/** No global browser state is hydrated. Server values win on every authenticated session. */
export function activateUiPreferences(userId: string | null): () => void {
  const token = ++generation; ++readCounter; clearTimeout(timer); pending = {}; inFlight = undefined;
  const defaults = structuredClone(DEFAULT_UI_PREFERENCES); apply(defaults, true); useDriveStore.setState({ activeTab: 'my-drive' });
  let legacy: Partial<UiPreferences> | null = null;
  try { legacy = readLegacyUiPreferences(localStorage); } catch { /* storage unavailable */ }
  useUiPreferencesStore.setState({ userId, ready: false, saving: false, error: null, preferences: defaults, revision: '', legacy, legacyDecision: 'pending' });
  if (!userId) return () => undefined;
  const unsubscribe = [
    useSidebarStore.subscribe((state, previous) => {
      if (state.userCollapsed === previous.userCollapsed && state.pinned === previous.pinned && state.moduleOrder === previous.moduleOrder && state.hiddenModules === previous.hiddenModules) return;
      queue({ sidebar: { user_collapsed: state.userCollapsed, pinned: state.pinned, module_order: state.moduleOrder, hidden_modules: state.hiddenModules } });
    }),
    useCalendarUiStore.subscribe((state, previous) => { if (state.view !== previous.view) queue({ calendar: { view: state.view } }); }),
    useDriveStore.subscribe((state, previous) => {
      const drive = { density: state.density, inspector_open: state.inspectorOpen, inspector_tab: state.inspectorTab };
      if (!same(drive, { density: previous.density, inspector_open: previous.inspectorOpen, inspector_tab: previous.inspectorTab })) queue({ drive });
    }),
  ];
  const refresh = () => { if (token === generation) void useUiPreferencesStore.getState().refresh(); };
  refresh(); const interval = setInterval(refresh, 30_000); window.addEventListener('focus', refresh);
  return () => {
    unsubscribe.forEach(stop => stop()); clearInterval(interval); window.removeEventListener('focus', refresh);
    if (token === generation) { ++generation; clearTimeout(timer); pending = {}; apply(structuredClone(DEFAULT_UI_PREFERENCES), true); useDriveStore.setState({ activeTab: 'my-drive' }); useUiPreferencesStore.setState({ userId: null, ready: false, legacy: null, preferences: structuredClone(DEFAULT_UI_PREFERENCES) }); }
  };
}
