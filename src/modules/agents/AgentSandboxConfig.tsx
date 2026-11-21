/** Per-agent isolation. Configuration is never presented as container read-back. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/services/api';
import { getAgentSandbox, patchAgentSandbox, sandboxPatch, type AgentSandboxConfiguration, type SandboxOverrides } from '@/services/agent-sandbox.service';
import { InlineReview, RadioChoice, SecurityButton, SecurityFacts, SecurityHelp, SecuritySection, focusSecurity, settingClass, type AspectStatus } from './security/SecurityUi';

export interface SandboxViewState { status: AspectStatus; pending: boolean; busy: boolean }
interface Props { agentId: string; agentName: string; advanced?: boolean; showStatus?: boolean; refreshKey?: number; onState?: (state: SandboxViewState) => void }
const keys = ['mode', 'scope', 'workspace_access'] as const;
const names: Record<keyof SandboxOverrides, Record<string, string>> = {
  mode: { off: 'Sin sandbox del agente', 'non-main': 'Salvo la sesión principal', all: 'Todas las sesiones' },
  scope: { session: 'Una sesión', agent: 'Sesiones de este agente', shared: 'Varios agentes' },
  workspace_access: { rw: 'Lectura y escritura', ro: 'Solo lectura', none: 'Sin montar el workspace' },
};
const labels = { mode: 'Sesiones que se quiere aislar', scope: 'Compartir contenedor', workspace_access: 'Workspace del agente' };
const topics = { mode: 'sessions', scope: 'container', workspace_access: 'workspace' } as const;
const pick = (config: AgentSandboxConfiguration): SandboxOverrides => ({ mode: config.agent.mode, scope: config.agent.scope, workspace_access: config.agent.workspace_access });
const initialStatus: AspectStatus = { color: 'orange', text: 'Aislamiento sin comprobar', detail: 'Cargando configuración y permiso de lectura.' };
const accessLost = (cause: unknown) => cause instanceof ApiError && cause.status !== undefined && [401, 403, 404].includes(cause.status);

export function AgentSandboxConfig(props: Props) { return <SandboxEditor key={props.agentId} {...props} />; }
function SandboxEditor({ agentId, agentName, advanced = true, showStatus = true, refreshKey = 0, onState }: Props) {
  const [config, setConfig] = useState<AgentSandboxConfiguration | null>(null);
  const [draft, setDraft] = useState<SandboxOverrides | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(false), sequence = useRef(0), configRef = useRef(config);
  const activeWrite = useRef<number | null>(null);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current++; }; }, []);
  const discardPrivateState = useCallback(() => {
    sequence.current++; activeWrite.current = null;
    configRef.current = null;
    setConfig(null); setDraft(null); setReview(null); setNotice(null); setDenied(true);
    setBusy(false); setLoading(false);
    setError('No tienes permiso para leer o editar el aislamiento de este agente. El rol de administrador no amplía este permiso.');
  }, []);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const next = await getAgentSandbox(agentId);
      if (!alive.current || request !== sequence.current) return;
      const previous = configRef.current;
      if (previous && JSON.stringify(previous) !== JSON.stringify(next)) setReview(null);
      setDraft(current => current && previous ? Object.fromEntries(keys.map(key => [key, current[key] !== previous.agent[key] ? current[key] : next.agent[key]])) as unknown as SandboxOverrides : pick(next));
      configRef.current = next; setConfig(next);
      setError(null); setDenied(false);
    } catch (cause) {
      if (!alive.current || request !== sequence.current) return;
      if (accessLost(cause)) discardPrivateState();
      else { setError('No se pudo leer el aislamiento. Conservamos el borrador; reintenta la consulta.'); setNotice(null); }
      setReview(null);
    } finally { if (alive.current && request === sequence.current) setLoading(false); }
  }, [agentId, discardPrivateState]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const saved = config ? pick(config) : null;
  const dirty = !!saved && !!draft && keys.some(key => saved[key] !== draft[key]);
  const configuredMode = config ? config.agent.mode ?? config.global.mode : null;
  const configuredScope = config ? config.agent.scope ?? config.global.scope : null;
  const status: AspectStatus = denied ? { color: 'orange', text: 'Sin permiso de lectura' }
    : error ? { color: 'orange', text: 'Configuración sin comprobar', detail: error }
    : !config ? initialStatus
    : configuredMode === 'off' ? { color: 'red', text: 'Desactivado en configuración', detail: 'Contenedor en uso: sin comprobar.' }
    : configuredMode === 'non-main' || configuredScope === 'shared' ? { color: 'orange', text: 'Protección parcial configurada', detail: configuredMode === 'non-main' ? 'La sesión principal queda fuera; uso sin comprobar.' : 'Comparte contenedor entre agentes; uso sin comprobar.' }
    : { color: 'orange', text: 'Configurado · en uso sin comprobar', detail: `Configurado: ${names.mode[configuredMode ?? ''] ?? configuredMode}.` };
  const pending = !!review || !!saved && !!draft && ['scope', 'workspace_access'].some(key => saved[key as keyof SandboxOverrides] !== draft[key as keyof SandboxOverrides]);
  const statusKey = JSON.stringify(status);
  useEffect(() => { onState?.({ status: JSON.parse(statusKey) as AspectStatus, pending, busy }); }, [statusKey, pending, busy, onState]);
  const edit = (key: keyof SandboxOverrides, value: string | null) => { if (draft) { setDraft({ ...draft, [key]: value }); setReview(null); setNotice(null); } };
  const cancel = () => { if (config) setDraft(pick(config)); setReview(null); setNotice(null); focusSecurity(`isolation-${agentId}`); };
  const save = async () => {
    if (!draft || !saved || busy || loading || error || review !== JSON.stringify({ draft, config })) return;
    const request = ++sequence.current;
    const isCurrent = () => alive.current && request === sequence.current;
    activeWrite.current = request;
    const submitted = { ...draft };
    const patch = sandboxPatch(saved, submitted);
    const sentKeys = keys.filter(key => (key === 'workspace_access' ? 'workspaceAccess' : key) in patch);
    setBusy(true); setError(null);
    try {
      await patchAgentSandbox(agentId, patch);
      if (!isCurrent()) return;
      // A 200 is not a read-back. Preserve the draft until the returned config agrees.
      const next = await getAgentSandbox(agentId);
      if (!isCurrent()) return;
      configRef.current = next; setConfig(next); setReview(null);
      setDraft(Object.fromEntries(keys.map(key => [key, sentKeys.includes(key) ? submitted[key] : next.agent[key]])) as unknown as SandboxOverrides);
      if (sentKeys.some(key => submitted[key] !== next.agent[key])) {
        setError('La configuración releída no coincide con lo solicitado. El borrador se conserva: revisa el antes/después y reintenta. No se ha comprobado el contenedor.');
      } else {
        setDraft(pick(next)); setNotice('Configuración guardada y releída. Contenedor en uso: sin comprobar.'); toast.success(`Aislamiento guardado para ${agentName}`);
      }
    } catch (cause) {
      if (!isCurrent()) return;
      if (accessLost(cause)) { discardPrivateState(); return; }
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar el aislamiento';
      setError(`${message}. Tu borrador se conserva.`); setReview(null); toast.error('No se pudo confirmar el guardado del aislamiento');
    } finally { if (alive.current) { if (activeWrite.current === request) { activeWrite.current = null; setBusy(false); } if (isCurrent()) focusSecurity(`isolation-${agentId}`); } }
  };
  return <SecuritySection id={`isolation-${agentId}`} title="Aislamiento del agente" topic="isolation" status={showStatus ? status : undefined} busy={loading && !config}>
    {loading && <p role="status" className="text-xs text-[var(--text-muted)]">Cargando aislamiento…</p>}
    {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
    {(!config || error) && <SecurityButton variant="outline" onClick={() => void load()} disabled={loading || busy}>Reintentar lectura de aislamiento</SecurityButton>}
    {config && draft && <>
      {keys.map(key => <fieldset key={key} hidden={!advanced && key !== 'mode'} disabled={busy || loading || !!error} className={settingClass}>
        <legend className="text-[13px] font-semibold">{labels[key]}<SecurityHelp topic={topics[key]} /></legend>
        <p className="mb-2 text-xs text-[var(--text-muted)]">{config.agent[key] === null ? 'Guardado: hereda el valor global.' : <>Guardado: {names[key][config.agent[key]] ?? config.agent[key]} · propio del agente.</>}{draft[key] !== config.agent[key] && <span className="block text-[var(--amber)]">Borrador: {draft[key] === null ? 'usar global' : names[key][draft[key]] ?? draft[key]} · sin guardar</span>}</p>
        <RadioChoice name={`sandbox-${key}-${agentId}`} value="inherit" label={`Usar global · ${names[key][config.global[key]] ?? config.global[key]}`} checked={draft[key] === null} onChange={() => edit(key, null)} />
        {Object.entries(names[key]).filter(([value]) => value !== 'none' || config.agent[key] === 'none').map(([value, label]) => <RadioChoice key={value} name={`sandbox-${key}-${agentId}`} value={value} label={label} checked={draft[key] === value} disabled={value === 'none'} onChange={() => edit(key, value)} description={value === 'non-main' ? 'La sesión principal queda fuera de esta petición de aislamiento.' : value === 'shared' ? 'Reutiliza contenedor entre varios agentes.' : value === 'none' ? 'Valor previo conservado; este control no puede asignarlo de nuevo.' : undefined} />)}
        {draft[key] !== null && !(draft[key] in names[key]) && <RadioChoice name={`sandbox-${key}-${agentId}`} value={draft[key]} label={`Valor previo: ${draft[key]}`} checked disabled onChange={() => {}} />}
      </fieldset>)}
      {!advanced && <SecurityFacts rows={[
        ['Contenedor', <>{names.scope[config.agent.scope ?? config.global.scope] ?? config.agent.scope ?? config.global.scope} · {config.agent.scope === null ? 'heredado del global' : 'propio'}<SecurityHelp topic="container" /></>],
        ['Archivos', <>{names.workspace_access[config.agent.workspace_access ?? config.global.workspace_access] ?? config.agent.workspace_access ?? config.global.workspace_access} · {config.agent.workspace_access === null ? 'heredado del global' : 'propio'}<SecurityHelp topic="workspace" /></>],
      ]} />}
      {advanced && <p className="text-xs text-[var(--text-muted)]">Limpieza heredada: {config.global.prune?.idle_hours ?? 'sin dato'} h sin uso / {config.global.prune?.max_age_days ?? 'sin dato'} días. Se conserva.<SecurityHelp topic="cleanup" /></p>}
      {dirty && <p className="text-xs text-[var(--amber)]">Borrador sin guardar. El estado observado no ha cambiado.</p>}
      {notice && <p role="status" className="text-xs text-[var(--text-dim)]">{notice}</p>}
      <div className="flex flex-wrap gap-2"><SecurityButton variant="outline" disabled={busy || loading || !!error} onClick={() => { setDraft(advanced ? { mode: null, scope: null, workspace_access: null } : { ...draft, mode: null }); setReview(null); }}>{advanced ? 'Usar valores globales' : 'Heredar las sesiones'}</SecurityButton><SecurityButton variant="outline" onClick={cancel} disabled={!dirty || busy}>Cancelar cambios</SecurityButton><SecurityButton id={`sandbox-preview-${agentId}`} disabled={!dirty || busy || loading || !!error} onClick={() => { setReview(JSON.stringify({ draft, config })); focusSecurity(`sandbox-review-${agentId}`); }}>Revisar cambios</SecurityButton></div>
      {review && <InlineReview id={`sandbox-review-${agentId}`} title="Revisar aislamiento" onCancel={() => { setReview(null); focusSecurity(`sandbox-preview-${agentId}`); }} actions={<SecurityButton onClick={() => void save()} disabled={busy}>{busy ? 'Guardando…' : 'Guardar configuración'}</SecurityButton>}>
        <SecurityFacts rows={keys.filter(key => saved?.[key] !== draft[key]).map(key => [labels[key], <>{saved?.[key] === null ? 'Heredado: ' : ''}{saved?.[key] ?? config.global[key]} → <strong>{draft[key] === null ? `Global: ${config.global[key]}` : draft[key]}</strong></>])} />
        <p>Solo se envían campos modificados. Se conservan la limpieza y otros valores. Guardar no comprueba un contenedor ni reinicia servicios.</p>
      </InlineReview>}
    </>}
  </SecuritySection>;
}
