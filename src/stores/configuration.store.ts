import { create } from 'zustand';
import { ApiError } from '@/services/api';
import { configurationApi, configurationExportReadiness, type ConfigurationCatalog, type ConfigurationExport, type ConfigurationPreview, type ConfigurationSnapshot, type ImportOperation, type ConfigurationMapping, type ConfigurationMappingKind } from '@/services/configuration.service';
import { useAuthStore } from './auth.store';

interface ConfigurationState {
  scope: 'personal' | 'instance'; mode: 'idle' | 'export' | 'import'; catalog: ConfigurationCatalog | null;
  snapshot: ConfigurationSnapshot | null; operation: ImportOperation | null; preview: ConfigurationPreview | null;
  selected: string[]; busy: boolean; error: string | null; notice: string | null; previewDirty: boolean;
  mappings: ConfigurationMapping[];
  load(scope?: 'personal' | 'instance'): Promise<void>;
  begin(mode: 'export' | 'import'): void;
  select(id: string, checked: boolean): void;
  mapReference(kind: ConfigurationMappingKind, sourceId: string, targetId: string): void;
  export(password: string, reauthPassword?: string): Promise<ConfigurationExport | null>;
  open(file: string, password: string): Promise<boolean>;
  openRecovery(id: string): Promise<boolean>;
  prepare(): Promise<void>;
  apply(acceptActivation: boolean, retry?: boolean, continueIndependent?: boolean): Promise<void>;
  refreshOperation(): Promise<void>;
  cancel(): Promise<void>;
  reset(): void;
}
const initial = { scope: 'personal' as const, mode: 'idle' as const, catalog: null, snapshot: null, operation: null, preview: null, selected: [], mappings: [], busy: false, error: null, notice: null, previewDirty: false };
const message = (error: unknown) => error instanceof ApiError ? error.message : 'No se pudo completar la operación. Revisa la conexión y reintenta.';
const session = () => { const auth = useAuthStore.getState(); return `${auth.user?.id ?? ''}:${auth.sessionGeneration}`; };
const terminal = (operation: ImportOperation) => ['completed', 'cancelled'].includes(operation.status);
const consistent = (result: ImportOperation | null, known: ImportOperation): result is ImportOperation => !!result && result.id === known.id && !(result.scope && known.scope && result.scope !== known.scope);
let loadSequence = 0;
export const useConfigurationStore = create<ConfigurationState>((set, get) => {
  // Ownership of this in-memory record only; reset/session changes cannot
  // carry a previous account's operation into recovery for another account.
  let operationSession = session(), operationSequence = 0;
  const known = () => operationSession === session() ? get().operation : null;
  const current = (token: string, sequence: number, id: string) => session() === token && operationSession === token && operationSequence === sequence && get().operation?.id === id;
  function clearForeign() {
    if (get().operation && operationSession !== session()) { ++operationSequence; operationSession = session(); set({ operation: null, preview: null, mappings: [], selected: [], mode: 'idle', previewDirty: false }); }
  }
  return {
  ...initial,
  reset: () => { ++loadSequence; ++operationSequence; operationSession = session(); set(initial); },
  load: async (scope = get().scope) => {
    clearForeign();
    const token = session(), request = ++loadSequence, sequence = operationSequence;
    const fresh = () => session() === token && request === loadSequence && sequence === operationSequence;
    // A failed or superseded read must not make a previous scope's catalog
    // authorize export, including when an older server omits export metadata.
    set({ busy: true, error: null, scope, catalog: null, snapshot: null });
    const values = await Promise.allSettled([configurationApi.catalog(scope), configurationApi.snapshot(scope), configurationApi.current()]);
    if (!fresh()) return;
    const [catalog, snapshot, pointer] = values;
    const previous = known();
    let operation = pointer.status === 'fulfilled' ? pointer.value : null;
    let operationError = pointer.status === 'rejected' ? message(pointer.reason) : null;
    let unconfirmed = false;
    if (previous && !terminal(previous) && !consistent(operation, previous)) {
      // A missing/inaccessible current pointer says nothing terminal about an
      // operation already known to this session. Consult its existing ID.
      try {
        const receipt = await configurationApi.operation(previous.id);
        if (!fresh()) return;
        if (!consistent(receipt, previous)) throw new Error('Inconsistent operation receipt');
        operation = receipt; operationError = null;
      } catch (error) {
        if (!fresh()) return;
        operation = known(); unconfirmed = true; operationError = message(error);
      }
    }
    if (!fresh()) return;
    const latest = known(), same = !!operation && operation.id === latest?.id;
    if (same && latest && terminal(latest) && !operation?.control_only) { operation = latest; unconfirmed = false; }
    const preserve = same && !!latest && !terminal(latest) && !operation?.control_only, intent = get();
    const preview = operation?.preview ?? null;
    const recover = operation && operation.status !== 'cancelled' && operation.status !== 'completed';
    if (operation?.id !== latest?.id) ++operationSequence;
    operationSession = token;
    if (operation && recover && !operation.control_only && operation.scope && operation.scope !== scope) { set({ operation }); await get().load(operation.scope); return; }
    set({ catalog: catalog.status === 'fulfilled' ? catalog.value : null, snapshot: snapshot.status === 'fulfilled' ? snapshot.value : null, busy: false,
      error: catalog.status === 'rejected' ? message(catalog.reason) : snapshot.status === 'rejected' ? message(snapshot.reason) : operationError,
      operation, preview: preserve && (unconfirmed || intent.previewDirty) ? intent.preview : preview,
      mappings: preserve && (unconfirmed || intent.previewDirty) ? intent.mappings : preview?.mappings ?? [], mode: recover ? 'import' : 'idle',
      selected: preserve && (unconfirmed || intent.previewDirty) ? intent.selected : operation?.control_only ? [] : recover && preview ? preview.blocks.filter(b => b.selected).map(b => b.id) : catalog.status === 'fulfilled' ? catalog.value.blocks.filter(b => b.authorized && b.available).map(b => b.id) : [],
      previewDirty: preserve && intent.previewDirty,
      notice: unconfirmed ? 'No se pudo confirmar la operación conocida. Se conserva su último estado; consulta de nuevo antes de continuar.' : recover ? 'Se ha recuperado la operación guardada. Revisa su estado antes de continuar.' : null });
  },
  begin: mode => {
    const catalog = get().catalog;
    const readiness = configurationExportReadiness(catalog, get().scope);
    if (mode === 'export' && !readiness.available) { set({ error: readiness.reason || 'La exportación no está disponible.' }); return; }
    const freshImport = mode === 'import' && (!get().operation || ['completed', 'cancelled'].includes(get().operation!.status));
    if (freshImport) { ++operationSequence; operationSession = session(); }
    set({ mode, error: null, notice: null, previewDirty: false,
      ...(freshImport ? { operation: null, preview: null, mappings: [] } : {}),
      selected: mode === 'export' ? catalog?.blocks.filter(b => b.authorized && b.available).map(b => b.id) ?? [] : freshImport ? [] : get().preview?.blocks.filter(b => b.selected).map(b => b.id) ?? [] });
  },
  select: (id, checked) => {
    const state = get();
    const block = state.mode === 'import' ? state.preview?.blocks.find(b => b.id === id) : state.catalog?.blocks.find(b => b.id === id);
    if (!block || !block.authorized || ('present' in block ? !block.present || !block.compatible : !block.available)) return;
    set({ selected: checked ? [...new Set([...state.selected, id])] : state.selected.filter(value => value !== id), previewDirty: state.mode === 'import', error: null });
  },
  mapReference: (kind, sourceId, targetId) => {
    const state = get(); const request = state.preview?.mapping_requests?.find(value => value.kind === kind && value.source_id === sourceId);
    if (!request || state.busy || targetId && (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(targetId) || !request.candidates.some(candidate => candidate.id === targetId))) return;
    const mappings = state.mappings.filter(value => value.kind !== kind || value.source_id !== sourceId);
    if (targetId) mappings.push({ kind, source_id: sourceId, target_id: targetId });
    set({ mappings, previewDirty: true, error: null });
  },
  export: async (password, reauthPassword) => {
    const readiness = configurationExportReadiness(get().catalog, get().scope);
    if (!readiness.available) { set({ error: readiness.reason || 'La exportación no está disponible.' }); return null; }
    const token = session(); set({ busy: true, error: null, notice: null });
    try {
      const result = await configurationApi.export({ blocks: get().selected, password, scope: get().scope, reauth_password: reauthPassword || undefined });
      if (session() !== token) return null;
      set({ busy: false, notice: 'Archivo cifrado preparado para descargar.' }); return result;
    } catch (error) { if (session() === token) set({ busy: false, error: message(error) }); return null; }
  },
  open: async (file, password) => {
    clearForeign(); ++loadSequence;
    const token = session(), request = ++operationSequence; set({ busy: true, error: null, notice: null });
    try {
      const operation = await configurationApi.open(file, password); if (session() !== token || request !== operationSequence) return false;
      operationSession = token;
      const scope = operation.scope ?? get().scope, changedScope = scope !== get().scope;
      set({ scope, mode: 'import', operation, preview: operation.preview, mappings: operation.preview?.mappings ?? [], selected: operation.preview?.blocks.filter(b => b.selected).map(b => b.id) ?? [], busy: changedScope, previewDirty: false });
      if (changedScope) await get().load(scope); return session() === token && request === operationSequence;
    } catch (error) { if (session() === token && request === operationSequence) set({ busy: false, error: message(error) }); return false; }
  },
  openRecovery: async id => {
    clearForeign();
    if (get().busy || get().operation && !['completed', 'cancelled'].includes(get().operation!.status)) return false;
    ++loadSequence; const token = session(), request = ++operationSequence; set({ busy: true, error: null, notice: null });
    try {
      const operation = await configurationApi.openRecovery(id); if (session() !== token || request !== operationSequence) return false;
      operationSession = token;
      const scope = operation.scope ?? get().scope, changedScope = scope !== get().scope;
      set({ scope, mode: 'import', operation, preview: operation.preview, mappings: operation.preview?.mappings ?? [], selected: operation.preview?.blocks.filter(block => block.selected).map(block => block.id) ?? [], busy: changedScope, previewDirty: false, notice: 'Recuperación preparada. Revisa la previsualización y acepta antes de aplicar.' });
      if (changedScope) await get().load(scope); return session() === token && request === operationSequence;
    } catch (error) { if (session() === token && request === operationSequence) set({ busy: false, error: message(error) }); return false; }
  },
  prepare: async () => {
    const operation = known(); if (!operation || operation.control_only) return;
    ++loadSequence; const token = session(), sequence = operationSequence; set({ busy: true, error: null });
    try {
      const preview = await configurationApi.preview(operation.id, get().selected, get().mappings); if (!current(token, sequence, operation.id)) return;
      if (terminal(get().operation!)) { set({ busy: false }); return; }
      set({ preview, mappings: preview.mappings ?? [], operation: { ...get().operation!, preview }, previewDirty: false, busy: false });
    } catch (error) { if (current(token, sequence, operation.id)) set({ busy: false, error: message(error), previewDirty: true }); }
  },
  apply: async (acceptActivation, retry = false, continueIndependent = false) => {
    const { preview, previewDirty } = get(), operation = known(); if (!operation || operation.control_only || !preview || previewDirty) return;
    ++loadSequence; const token = session(), sequence = operationSequence; set({ busy: true, error: null, notice: null });
    try {
      const result = retry ? await configurationApi.retry(operation.id, preview.preview_revision, acceptActivation, continueIndependent) : await configurationApi.apply(operation.id, preview.preview_revision, acceptActivation);
      if (!current(token, sequence, operation.id)) return;
      if (!consistent(result, operation)) throw new Error('Inconsistent operation receipt');
      if (terminal(get().operation!)) { set({ busy: false }); return; }
      set({ operation: result, preview: result.preview, mappings: result.preview?.mappings ?? [], busy: false, notice: result.status === 'completed' ? 'Importación finalizada. Consulta el resultado de cada bloque.' : null });
    } catch (error) {
      if (!current(token, sequence, operation.id)) return;
      set({ busy: false, error: message(error), previewDirty: get().previewDirty || error instanceof ApiError && ['CONFIGURATION_CHANGED', 'CONFIGURATION_PREVIEW_STALE', 'CONFLICT'].includes(error.code) });
      await get().refreshOperation();
    }
  },
  refreshOperation: async () => {
    const operation = known(); if (!operation) return;
    const token = session(), sequence = operationSequence;
    try {
      const result = await configurationApi.operation(operation.id); if (!current(token, sequence, operation.id)) return;
      if (!consistent(result, operation)) throw new Error('Inconsistent operation receipt');
      if (terminal(get().operation!) && !result.control_only) return;
      set({ operation: result, ...(get().previewDirty && !result.control_only ? {} : { preview: result.preview, mappings: result.preview?.mappings ?? [] }), ...(result.control_only ? { selected: [], previewDirty: false } : {}) });
    } catch (error) { if (current(token, sequence, operation.id)) set({ error: message(error) }); }
  },
  cancel: async () => {
    clearForeign(); const operation = known();
    if (!operation || terminal(operation)) { ++operationSequence; operationSession = session(); set({ mode: 'idle', preview: null, mappings: [], operation: null, error: null, notice: null }); return; }
    ++loadSequence; const token = session(), sequence = operationSequence; set({ busy: true, error: null });
    try { await configurationApi.cancel(operation.id); if (current(token, sequence, operation.id)) { ++operationSequence; operationSession = session(); set({ mode: 'idle', preview: null, mappings: [], operation: null, busy: false, error: null, notice: null, previewDirty: false }); } }
    catch (error) { if (current(token, sequence, operation.id)) set({ busy: false, error: message(error) }); }
  },
  };
});
