import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { useConfigurationStore } from '@/stores/configuration.store';
import { useConfigurationAvailabilityStore } from '@/stores/configuration-availability.store';
import { useUiPreferencesStore } from '@/stores/ui-preferences.store';
import { useConfigurationAvailabilityState } from '@/hooks/use-configuration-availability';
import { configurationApi, configurationExportReadiness, type ConfigurationExport, type ConfigurationIssue, type ConfigurationRecoveryPoint } from '@/services/configuration.service';
import { SettingSection } from '../SettingSection';
import { ConfigurationMappings } from '../ConfigurationMappings';

const panel = 'rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4';
type ExportCapture = { result: ConfigurationExport; binding: string; sequence: number; revision?: string };
// These stores are read again at the side effect, rather than trusting a render
// captured before a role, account, availability or scope change.
function exportBinding(): string | null {
  const auth = useAuthStore.getState(), state = useConfigurationStore.getState(), availability = useConfigurationAvailabilityStore.getState();
  if (!auth.user?.id || !auth.isAuthenticated || auth.logoutState !== 'idle' || state.mode !== 'export'
    || state.scope === 'instance' && !['owner', 'admin'].includes(auth.user.role)
    || availability.sessionKey !== `${auth.user.id}:${auth.sessionGeneration}` || availability.status !== 'available'
    || !configurationExportReadiness(state.catalog, state.scope).available) return null;
  const selected = state.selected.map(id => state.catalog?.blocks.filter(block => block.id === id));
  if (!selected.length || selected.some(matches => matches?.length !== 1 || !matches[0]?.authorized || !matches[0]?.available)) return null;
  return JSON.stringify([auth.user.id, auth.sessionGeneration, auth.user.role, auth.isAuthenticated, auth.logoutState, state.scope, state.mode,
    state.selected, state.catalog?.export ?? null, state.catalog?.coverage.complete, selected.map(matches => [matches![0]!.id, matches![0]!.authorized, matches![0]!.available])]);
}
function readableCapture(capture: ExportCapture, scope: 'personal' | 'instance') {
  const view = capture.result.readable, revision = capture.revision;
  if (!view?.available || !revision || !/^[a-f0-9]{64}$/.test(revision) || view.revision !== revision || view.media_type !== 'application/json'
    || capture.result.filename !== `micelclaw-configuration-v1-${revision.slice(0, 12)}.micelcfg`
    || view.filename !== `micelclaw-configuration-v1-${revision.slice(0, 12)}-readable.json` || typeof view.content !== 'string') return null;
  try {
    const content = JSON.parse(view.content);
    if (content.format !== 'micelclaw-configuration-readable' || content.version !== 1 || content.export_revision !== revision
      || content.scope !== scope || content.coverage?.selected_capture_complete !== true || content.coverage?.instance_complete !== false) return null;
    return view;
  } catch { return null; }
}
function Issues({ title, items }: { title: string; items: ConfigurationIssue[] }) {
  if (!items.length) return null;
  const needsPackage = items.some(item => ['APPLICATION_PACKAGE_REQUIRED', 'APPLICATION_EXACT_PACKAGE_REQUIRED', 'OFFICE_PROVIDER_UNAVAILABLE', 'OFFICE_EXACT_PROVIDER_REQUIRED'].includes(item.code));
  return <div className="mt-3"><p className="text-sm font-medium">{title}</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--text-muted)]">{items.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>
    {needsPackage && <div className="mt-2 text-xs"><a className="font-medium text-[var(--accent)] underline underline-offset-2" href="/micelhub" target="_blank" rel="noopener noreferrer">Revisar paquete en MicelHub ↗</a><p className="mt-1 text-[var(--text-muted)]">Comprueba el paquete y la versión indicados. Después vuelve y actualiza la previsualización.</p></div>}
  </div>;
}
function LegacyPreferences() {
  const { ready, legacy, legacyDecision, error, saving, decideLegacy, refresh } = useUiPreferencesStore();
  const [working, setWorking] = useState(false);
  const decide = async (decision: 'adopt' | 'dismiss') => {
    const token = useAuthStore.getState().sessionGeneration;
    setWorking(true);
    try { await decideLegacy(decision); if (useAuthStore.getState().sessionGeneration === token) toast.success(decision === 'adopt' ? 'Preferencias del navegador adoptadas en tu cuenta' : 'Se conservarán tus preferencias de cuenta'); }
    catch { if (useAuthStore.getState().sessionGeneration === token) toast.error('No se pudo guardar la decisión. Actualiza y reintenta.'); }
    finally { setWorking(false); }
  };
  return <>
    {error && <div className={`${panel} mb-4`} role="status"><p className="text-sm">{error}</p><Button className="mt-2" variant="outline" size="sm" onClick={() => void refresh()}>Reintentar sincronización</Button></div>}
    {ready && legacy && legacyDecision === 'pending' && <div className={`${panel} mb-4`}>
      <p className="text-sm font-medium">Preferencias antiguas de este navegador</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Este navegador guardaba preferencias sin indicar su propietario. Puedes adoptarlas en tu cuenta para sincronizarlas entre dispositivos o conservar las de tu cuenta.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={working || saving} onClick={() => void decide('adopt')}>Adoptar en mi cuenta</Button><Button size="sm" variant="outline" disabled={working || saving} onClick={() => void decide('dismiss')}>Conservar las de mi cuenta</Button></div>
    </div>}
  </>;
}

function RecoveryPoints({ disabled, revision, labels, open }: { disabled: boolean; revision?: string; labels: Record<string, string>; open(id: string): void }) {
  const generation = useAuthStore(value => value.sessionGeneration);
  const [points, setPoints] = useState<ConfigurationRecoveryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const sequence = useRef(0);
  const refresh = async () => {
    const token = useAuthStore.getState().sessionGeneration, request = ++sequence.current;
    setLoading(true); setError(false);
    try { const result = await configurationApi.recovery(); if (token === useAuthStore.getState().sessionGeneration && request === sequence.current) setPoints(result); }
    catch { if (token === useAuthStore.getState().sessionGeneration && request === sequence.current) setError(true); }
    finally { if (token === useAuthStore.getState().sessionGeneration && request === sequence.current) setLoading(false); }
  };
  useEffect(() => { setPoints([]); void refresh(); return () => { sequence.current++; }; }, [generation, revision]);
  return <div className={`${panel} mt-4`} data-testid="configuration-recovery">
    <p className="text-sm font-medium">Recuperación de configuración</p>
    <p className="mt-1 text-xs text-[var(--text-muted)]">Se conservan como máximo tres puntos protegidos en la instancia. Aquí aparecen los que puedes consultar con tu cuenta. Los efectos externos pueden requerir comprobación o intervención.</p>
    {loading ? <p className="mt-3 flex items-center gap-2 text-xs" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando puntos…</p> : error ? <div className="mt-3" role="status"><p className="text-xs">No se pudieron consultar los puntos de recuperación.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => void refresh()}>Reintentar consulta</Button></div> : !points.length ? <p className="mt-3 text-xs text-[var(--text-muted)]">Todavía no hay puntos de recuperación disponibles para tu cuenta.</p> : <ul className="mt-3 space-y-3">{points.map(point => <li key={point.id} className="flex flex-wrap items-center justify-between gap-3 text-xs"><span>{new Date(point.created_at).toLocaleString()} · {point.scope === 'instance' ? 'Instancia' : 'Personal'}<span className="mt-0.5 block text-[var(--text-muted)]">{point.blocks.map(block => labels[block] ?? block).join(', ')}</span></span><Button size="sm" variant="outline" disabled={disabled} onClick={() => open(point.id)}>Preparar recuperación</Button></li>)}</ul>}
  </div>;
}

export function ConfigurationMigrationSection() {
  const state = useConfigurationStore();
  const availability = useConfigurationAvailabilityState();
  const userId = useAuthStore(value => value.user?.id);
  const role = useAuthStore(value => value.user?.role);
  const sessionGeneration = useAuthStore(value => value.sessionGeneration);
  const authenticated = useAuthStore(value => value.isAuthenticated);
  const logoutState = useAuthStore(value => value.logoutState);
  const admin = role === 'owner' || role === 'admin';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reauth, setReauth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [acceptActivation, setAcceptActivation] = useState(false);
  const [exportCapture, setExportCapture] = useState<ExportCapture | null>(null);
  const exportCaptureRef = useRef<ExportCapture | null>(null);
  const exportSequence = useRef(0);
  const mounted = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const reauthInput = useRef<HTMLInputElement>(null);
  const blobUrls = useRef(new Set<string>());
  const exportAvailability = configurationExportReadiness(state.catalog, state.scope);
  const invalidateExport = () => {
    ++exportSequence.current; exportCaptureRef.current = null; setExportCapture(null);
    for (const url of blobUrls.current) URL.revokeObjectURL(url);
    blobUrls.current.clear();
  };
  const clearCredentials = () => {
    setPassword(''); setConfirmation(''); setReauth('');
    // React may batch the state update until after the request has started.
    for (const input of [passwordInput.current, confirmationInput.current, reauthInput.current]) if (input) input.value = '';
  };

  useEffect(() => {
    mounted.current = true;
    let binding = exportBinding();
    const changed = () => {
      const next = exportBinding();
      if (binding !== next) { binding = next; invalidateExport(); }
    };
    const unsubscribe = [useAuthStore.subscribe(changed), useConfigurationStore.subscribe(changed), useConfigurationAvailabilityStore.subscribe(changed)];
    return () => {
      mounted.current = false; ++exportSequence.current; exportCaptureRef.current = null;
      unsubscribe.forEach(stop => stop());
      for (const url of blobUrls.current) URL.revokeObjectURL(url);
      blobUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    clearCredentials(); invalidateExport(); setFile(null); setAcceptActivation(false);
    if (fileInput.current) fileInput.current.value = '';
    useConfigurationStore.getState().reset();
    return () => useConfigurationStore.getState().reset();
  }, [userId, sessionGeneration, role, authenticated, logoutState]);
  useEffect(() => {
    if (availability.available && authenticated && logoutState === 'idle') void useConfigurationStore.getState().load('personal');
  }, [availability.available, userId, sessionGeneration, role, authenticated, logoutState]);
  useEffect(() => { setAcceptActivation(false); }, [state.preview?.preview_revision, state.previewDirty]);
  useEffect(() => {
    if (state.mode === 'export' && !exportAvailability.available) clearCredentials();
  }, [state.mode, exportAvailability.available]);
  useEffect(() => {
    if (state.operation?.status !== 'applying') return;
    const timer = setInterval(() => { void useConfigurationStore.getState().refreshOperation(); }, 1500);
    return () => clearInterval(timer);
  }, [state.operation?.status]);

  const clearForm = () => { invalidateExport(); clearCredentials(); setFile(null); if (fileInput.current) fileInput.current.value = ''; };
  const begin = (mode: 'export' | 'import') => { clearForm(); state.begin(mode); };
  const downloadFile = (contents: string, filename: string, mediaType: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type: mediaType }));
    blobUrls.current.add(url);
    try {
      const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    } finally {
      setTimeout(() => { URL.revokeObjectURL(url); blobUrls.current.delete(url); }, 1000);
    }
  };
  const currentExport = (binding: string, sequence: number) => mounted.current && sequence === exportSequence.current && binding === exportBinding();
  const download = async () => {
    if (password !== confirmation) { toast.error('Las contraseñas del archivo no coinciden'); return; }
    const binding = exportBinding();
    if (!binding) { clearForm(); return; }
    const archivePassword = password, reauthPassword = reauth;
    invalidateExport(); const sequence = exportSequence.current;
    clearCredentials();
    const result = await state.export(archivePassword, reauthPassword);
    if (!result || !currentExport(binding, sequence)) return;
    const capture = { result, binding, sequence, revision: result.readable?.revision };
    exportCaptureRef.current = capture; setExportCapture(capture);
    downloadFile(result.file, result.filename, 'application/octet-stream');
    toast.success('Configuración cifrada descargada');
  };
  const downloadReadable = () => {
    const capture = exportCaptureRef.current;
    if (!capture || capture !== exportCapture || !currentExport(capture.binding, capture.sequence)) { invalidateExport(); return; }
    const readable = readableCapture(capture, useConfigurationStore.getState().scope);
    if (readable) downloadFile(readable.content, readable.filename, readable.media_type);
  };
  const open = async () => {
    if (!file) return;
    if (file.size > 23 * 1024 * 1024) { toast.error('El archivo supera el tamaño admitido'); return; }
    const token = sessionGeneration, archivePassword = password, selectedFile = file;
    clearForm();
    try {
      const contents = await selectedFile.text(); if (useAuthStore.getState().sessionGeneration !== token) return;
      await state.open(contents, archivePassword);
    }
    catch { if (useAuthStore.getState().sessionGeneration === token) toast.error('No se pudo leer el archivo seleccionado'); }
    finally { if (useAuthStore.getState().sessionGeneration === token) setPassword(''); }
  };
  const cancel = async () => { clearForm(); await state.cancel(); };
  const importing = state.mode === 'import';
  const readable = useMemo(() => exportCapture ? readableCapture(exportCapture, state.scope) : null, [exportCapture, state.scope]);
  const preview = state.preview;
  const activeOperation = !!state.operation && !['completed', 'cancelled'].includes(state.operation.status);
  const blocks = importing && preview ? preview.blocks : state.catalog?.blocks ?? [];
  const resultLabels: Record<string, string> = { pending: 'Pendiente', applying: 'Aplicando', verified: 'Aplicado y comprobado', pending_activation: 'Guardado; pendiente de activación', failed: 'Falló', uncertain: 'Resultado incierto; requiere revisión', omitted: 'Omitido' };

  if (!availability.available) return <div className="max-w-4xl text-[var(--text)]" data-testid="configuration-unavailable">
    <SettingSection title="Configuración y migración">
      <div className={panel} role="status">
        <p className="flex items-center gap-2 text-sm">{availability.status === 'checking' && <Loader2 className="h-4 w-4 animate-spin" />}{availability.status === 'checking' ? 'Comprobando disponibilidad…' : availability.status === 'forbidden' ? 'No tienes acceso a esta función con tu sesión actual.' : availability.status === 'error' ? 'No se pudo comprobar la disponibilidad. Puedes volver a intentarlo.' : 'Esta función todavía no está disponible. Puedes volver a intentarlo más tarde.'}</p>
        <Button className="mt-3" variant="outline" disabled={availability.status === 'checking'} onClick={() => void availability.check()}>Volver a comprobar</Button>
      </div>
    </SettingSection>
  </div>;

  if (state.operation?.control_only) return <div className="max-w-4xl text-[var(--text)]" data-testid="configuration-migration">
    <SettingSection title="Configuración y migración">
      <div className={panel} data-testid="configuration-control-only">
        <p className="text-sm" role="status">Hay una importación activa que puedes detener. Su contenido no está disponible en esta sesión.</p>
        <Button className="mt-3" variant="outline" disabled={state.busy} onClick={() => void cancel()}>Cancelar importación activa</Button>
        {state.error && <p className="mt-3 text-sm" role="alert">{state.error}</p>}
      </div>
    </SettingSection>
  </div>;

  return <div className="max-w-4xl text-[var(--text)]" data-testid="configuration-migration">
    <SettingSection title="Configuración y migración" description="Exporta los ajustes autorizados en un archivo cifrado o revisa una configuración antes de importarla.">
      <LegacyPreferences />
      <div className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium">Configuración de esta instancia</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">{state.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state.snapshot ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {state.busy ? 'Consultando configuración…' : state.snapshot ? `Actualizada · ${new Date(state.snapshot.generated_at).toLocaleString()}` : 'Pendiente de obtener una captura coherente'}</p>
          </div>
          <label className="flex items-center gap-2 text-xs">Ámbito
            <select className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5" value={state.scope} disabled={state.busy || activeOperation} onChange={event => { clearForm(); void state.load(event.target.value as 'personal' | 'instance'); }}>
              <option value="personal">Mi configuración autorizada</option>{admin && <option value="instance">Toda la instancia</option>}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={state.busy || !exportAvailability.available || activeOperation} onClick={() => begin('export')}><Download className="h-4 w-4" />Exportar configuración</Button>
          <Button variant="outline" disabled={state.busy || !state.catalog || activeOperation} onClick={() => begin('import')}><FileUp className="h-4 w-4" />Importar archivo</Button>
          <Button variant="ghost" size="icon" aria-label="Actualizar configuración" disabled={state.busy} onClick={() => void state.load()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {state.catalog && !exportAvailability.available && <p className="mt-3 text-sm" role="status">{exportAvailability.reason}</p>}
        {state.catalog && !state.catalog.coverage.complete && <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs" role="status">
          <p className="font-medium">La cobertura de configuración todavía tiene limitaciones.</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">{state.catalog.coverage.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
        </div>}
        {state.error && <div className="mt-4 rounded border border-red-500/30 p-3 text-sm" role="alert">{state.error}<p className="mt-1 text-xs text-[var(--text-muted)]">Actualiza la previsualización si cambió la configuración o vuelve a abrir el archivo si no se pudo descifrar.</p></div>}
        {state.notice && <p className="mt-3 text-sm" role="status">{state.notice}</p>}
        {state.snapshot && <Issues title="Limitaciones de la captura" items={state.snapshot.warnings} />}
      </div>

      {state.mode !== 'idle' && <div className={`${panel} mt-4`}>
        {importing && !state.operation && <form className="mb-4 space-y-3" onSubmit={event => { event.preventDefault(); void open(); }}>
          <div><label htmlFor="configuration-file" className="mb-1 block text-sm font-medium">Archivo cifrado de configuración</label><Input ref={fileInput} id="configuration-file" type="file" accept=".micelcfg,.json,application/octet-stream,application/json" disabled={state.busy} onChange={event => setFile(event.target.files?.[0] ?? null)} /></div>
          <div><label htmlFor="configuration-import-password" className="mb-1 block text-sm">Contraseña del archivo</label><Input ref={passwordInput} id="configuration-import-password" type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} disabled={state.busy} /></div>
          <p className="text-xs text-[var(--text-muted)]">Abrir y previsualizar no modifica tus ajustes.</p>
          <Button type="submit" disabled={state.busy || !file || !password}>{state.busy && <Loader2 className="h-4 w-4 animate-spin" />}Abrir y descifrar</Button>
        </form>}
        {(!importing || preview) && <fieldset disabled={state.busy || state.operation?.status === 'applying' || (importing && state.operation?.status === 'completed')}>
          <legend className="mb-3 text-sm font-medium">Bloques de configuración</legend>
          <div className="grid gap-3 sm:grid-cols-2">{blocks.map(block => {
            const absent = 'present' in block && !block.present;
            const unavailable = 'compatible' in block ? !block.compatible : !block.available;
            const disabled = absent || unavailable || !block.authorized;
            return <label key={block.id} className={`flex items-start gap-2 text-sm ${disabled ? 'text-[var(--text-muted)]' : ''}`}>
              <Checkbox aria-label={block.label} checked={state.selected.includes(block.id)} disabled={disabled} onCheckedChange={value => state.select(block.id, value === true)} />
              <span>{block.label}{(block.reason || disabled) && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{absent ? 'No está presente en el archivo.' : block.reason || (!block.authorized ? 'No tienes permiso para este ámbito.' : 'No disponible en este destino.')}</span>}</span>
            </label>;
          })}</div>
        </fieldset>}

        {!importing && !exportAvailability.available && <Button className="mt-5" variant="outline" disabled={state.busy} onClick={() => void cancel()}>Volver</Button>}
        {!importing && exportAvailability.available && <form className="mt-5 space-y-3" onSubmit={event => { event.preventDefault(); void download(); }}>
          <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><ShieldCheck className="h-4 w-4" />El archivo incluye secretos portátiles cifrados. Guarda su contraseña en un lugar seguro.</p>
          <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm" htmlFor="configuration-export-password">Contraseña del archivo</label><Input ref={passwordInput} id="configuration-export-password" type="password" autoComplete="new-password" minLength={12} value={password} disabled={state.busy} onChange={event => setPassword(event.target.value)} required /></div>
            <div><label className="mb-1 block text-sm" htmlFor="configuration-export-confirmation">Repetir contraseña</label><Input ref={confirmationInput} id="configuration-export-confirmation" type="password" autoComplete="new-password" minLength={12} value={confirmation} disabled={state.busy} onChange={event => setConfirmation(event.target.value)} required /></div></div>
          {state.scope === 'instance' && <div><label className="mb-1 block text-sm" htmlFor="configuration-reauth">Tu contraseña de Micelclaw</label><Input ref={reauthInput} id="configuration-reauth" type="password" autoComplete="current-password" value={reauth} disabled={state.busy} onChange={event => setReauth(event.target.value)} required /><p className="mt-1 text-xs text-[var(--text-muted)]">La exportación de toda la instancia requiere reautenticación y queda auditada.</p></div>}
          <p className="text-xs text-[var(--text-muted)]">Se excluyen documentos, conversaciones, memorias, correos, fotos y datos de trabajo.</p>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={state.busy} onClick={() => void cancel()}>Volver</Button><Button type="submit" disabled={state.busy || !state.selected.length || password.length < 12 || password !== confirmation || state.scope === 'instance' && !reauth}>{state.busy && <Loader2 className="h-4 w-4 animate-spin" />}Descargar archivo cifrado</Button></div>
          <Issues title="Necesita adaptación o autenticación" items={exportCapture?.result.warnings ?? []} />
        </form>}

        {!importing && exportCapture && <div className="mt-4 border-t border-[var(--border)] pt-4" data-testid="configuration-readable-export">
          <p className="text-sm font-medium">Ajustes legibles de esta exportación</p>
          {readable ? <>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Incluye los valores completos clasificados de la misma selección. Es una vista de consulta sin secretos; para importar utiliza el archivo cifrado .micelcfg. No acredita activación ni una instancia completa.</p>
            <Button className="mt-3" type="button" variant="outline" disabled={state.busy} onClick={downloadReadable}><Download className="h-4 w-4" />Descargar ajustes legibles .json</Button>
          </> : <>
            <p className="mt-1 text-xs text-[var(--text-muted)]" role="status">{exportCapture.result.readable === undefined ? 'Este servidor no incluye una vista legible. El archivo cifrado conserva la selección exportada.' : 'La vista legible completa no está disponible. El archivo cifrado conserva la selección exportada.'}</p>
            {exportCapture.result.readable?.available === false && <Issues title="Motivo" items={exportCapture.result.readable.issues} />}
          </>}
        </div>}

        {importing && preview && <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-sm font-medium">Previsualización</p>
          <ConfigurationMappings requests={preview.mapping_requests ?? []} mappings={state.mappings} disabled={state.busy || state.operation?.status === 'applying' || state.operation?.status === 'completed'} onChange={state.mapReference} />
          {state.previewDirty && <p className="mt-2 text-xs text-amber-600" role="status">La selección o la configuración ha cambiado. Actualiza la previsualización antes de aplicar.</p>}
          {preview.changes.length > 0 && <div className="mt-3"><p className="text-sm">Se actualizarán</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--text-muted)]">{preview.changes.map((change, index) => <li key={`${change.adapter}-${index}`}>{change.summary}</li>)}</ul></div>}
          {preview.preserved.length > 0 && <div className="mt-3"><p className="text-sm">Se conservarán</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--text-muted)]">{preview.preserved.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
          <Issues title="Relaciones omitidas" items={preview.omissions} /><Issues title="Necesita resolver" items={preview.blockers} /><Issues title="Observaciones" items={preview.warnings} />
          {preview.activation.length > 0 && <div className="mt-3"><p className="text-sm font-medium">Activación o interrupción necesaria</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--text-muted)]">{preview.activation.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <label className="mt-3 flex items-start gap-2 text-sm"><Checkbox checked={acceptActivation} disabled={state.busy} onCheckedChange={value => setAcceptActivation(value === true)} /><span>Acepto las activaciones e interrupciones indicadas para esta operación.</span></label>
          </div>}
          <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={state.busy || state.operation?.status === 'applying'} onClick={() => void cancel()}>Cancelar operación</Button>
            {state.operation?.status !== 'completed' && <Button variant="outline" disabled={state.busy || state.operation?.status === 'applying'} onClick={() => void state.prepare()}><RefreshCw className="h-4 w-4" />Actualizar previsualización</Button>}
            {state.operation?.status !== 'completed' && state.operation?.status !== 'stopped' && <Button disabled={state.busy || !preview.can_apply || state.previewDirty || !!preview.activation.length && !acceptActivation} onClick={() => void state.apply(acceptActivation)}>Aplicar configuración</Button>}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">Antes de aplicar se prepara un punto protegido de los ajustes afectados. Se conservan los tres últimos en la instancia.</p>
        </div>}
        {importing && !preview && <div className="mt-3"><Button variant="outline" disabled={state.busy} onClick={() => void cancel()}>Volver</Button></div>}
      </div>}

      {state.operation && state.operation.results.length > 0 && <div className={`${panel} mt-4`} aria-live="polite">
        <p className="text-sm font-medium">Resultado de la importación</p><p className="mt-1 text-xs text-[var(--text-muted)]">Operación {state.operation.id}</p>
        <ul className="mt-3 space-y-3">{state.operation.results.map(result => <li key={result.id} className="flex items-start gap-2 text-sm">
          {result.state === 'verified' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : result.state === 'applying' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />}
          <span>{state.catalog?.blocks.find(block => block.id === result.id)?.label ?? result.id} · {resultLabels[result.state]}<span className="mt-0.5 block text-xs text-[var(--text-muted)]">{result.message}</span></span>
        </li>)}</ul>
        {state.operation.status === 'stopped' && <div className="mt-4 flex flex-wrap gap-2"><Button disabled={state.busy || state.previewDirty || !preview?.can_apply || !!preview.activation.length && !acceptActivation} onClick={() => void state.apply(acceptActivation, true)}>Corregir y reintentar</Button><Button variant="outline" disabled={state.busy || state.previewDirty || !preview?.can_apply || !!preview.activation.length && !acceptActivation} onClick={() => void state.apply(acceptActivation, true, true)}>Continuar bloques independientes</Button></div>}
        <Button className="mt-4" size="sm" variant="outline" disabled={state.busy} onClick={() => void state.refreshOperation()}>Consultar resultado</Button>
      </div>}
      <RecoveryPoints disabled={state.busy || activeOperation} revision={state.operation?.recovery?.id} labels={Object.fromEntries((state.catalog?.blocks ?? []).map(block => [block.id, block.label]))} open={id => { clearForm(); void state.openRecovery(id); }} />
    </SettingSection>
  </div>;
}
