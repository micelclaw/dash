/** Security v3: approved hierarchy, inline help and transactions. No presentation action writes policy. */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useVisibleSecurityPolling } from '@/hooks/useVisibleSecurityPolling';
import {
  addAgentSecurityRule, getAgentSecurity, getAgentSecurityRuntime, getSecuritySettings, listCommandProfiles, listProtectedCategories,
  previewAgentSecurity, reconcileAgentSecurity, requestAgentBreakGlass, revokeAgentBreakGlass, revokeAgentSecurityRule, updateAgentSecurity,
  type AgentSecurity as SecurityData, type AgentSecurityRuntime, type AgentSecurityPreview, type AgentSecurityPolicyInput,
  type CommandProfileSummary, type ProtectedSecurityCategory, type SecurityExecMode, type SecurityPolicySettings, type SecurityRuleEffect,
} from '@/services/security-policy.service';
import { AgentSandboxConfig, type SandboxViewState } from './AgentSandboxConfig';
import { SecurityHelpProvider, SecurityHelp, SecuritySection, SecurityFacts, SecurityButton, StatusDot, StatusText, InlineReview, RadioChoice, focusSecurity, settingClass, inputClass, type AspectStatus } from './security/SecurityUi';
import { commandStatus, displayTime, effectiveLease, effectCopy, fallbackCopy, freshTime, isExecMode, leaseOpen, leaseStatus, modeCopy, modeRank, safeSecurityText, sourceCopy, verifiedCommands } from './security/security-state';

interface AgentSecurityProps {
  agentId: string;
  agentName: string;
  showSandbox?: boolean;
  onChanged?: () => void;
  embedded?: boolean;
  profileCatalogRevision?: number;
  onManageProfiles?: () => void;
}
type Fallback = keyof typeof fallbackCopy;
type PolicyDraft = { mode: SecurityExecMode; profileId: string; fallback: Fallback };
type Confirmation = { kind: 'reconcile'; agentId: string; revision: number; mode: SecurityExecMode } | { kind: 'tighten'; fingerprint: string; effect: 'prompt' | 'block'; revision: number } | { kind: 'remove'; id: string; revision: number } | { kind: 'add'; revision: number } | { kind: 'revoke'; id: string; revision: number };
const durations = [5, 15, 30, 60] as const;
const profileSignature = (profile?: CommandProfileSummary) => JSON.stringify(profile ? [profile.id, profile.published_version, profile.extension_policy, profile.max_exec_mode, profile.updated_at] : null);
const savedDraft = (data: SecurityData): PolicyDraft => ({ mode: data.desired.mode ?? 'deny', profileId: data.desired.profile_id ?? '', fallback: data.desired.unattended_fallback ?? 'deny_and_notify' });
const message = (error: unknown) => safeSecurityText(error instanceof Error ? error.message : 'No se pudo completar la operación');
const forbidden = (error: unknown) => error instanceof ApiError && error.status !== undefined && [401, 403, 404].includes(error.status);

function registryData(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.registered_contracts !== 'number' || !Number.isSafeInteger(data.registered_contracts) || data.registered_contracts < 0
    || typeof data.pending_tool_count !== 'number' || !Number.isSafeInteger(data.pending_tool_count) || data.pending_tool_count < 0) return null;
  return { enforced: data.enforced === true, count: data.registered_contracts, pending: data.pending_tool_count, names: Array.isArray(data.pending_native_tools) ? data.pending_native_tools.filter((name): name is string => typeof name === 'string').slice(0, 50) : [] };
}
/** Also consumed by the tool registry contract harness. The pending list is always visible. */
export function ToolSecurityRegistryStatus({ value }: { value: unknown }) {
  const registry = registryData(value);
  if (!registry) return null;
  return <aside role="status" aria-label="Tool security registry" className="mt-4 text-xs leading-relaxed text-[var(--text-dim)]">
    <h4 className="m-0 font-semibold text-[var(--text)]">Contratos de herramientas del servidor<SecurityHelp topic="registry" /></h4>
    <p>{registry.count} contratos registrados · {registry.pending} pendientes. {registry.enforced ? 'Control activo: los contratos sin revisar permanecen bloqueados.' : 'Control del registro desactivado: no se puede afirmar ese bloqueo.'}</p>
    <p>Alcance global del servidor. No se ha comprobado la asignación a este agente.</p>
    <ul className="m-0 list-none divide-y divide-[var(--border)] p-0">{registry.names.map(name => <li key={name} className="py-2 [overflow-wrap:anywhere]">{safeSecurityText(name)} · pendiente de revisión</li>)}</ul>
    {registry.pending > registry.names.length && <p>Se muestran {registry.names.length} de {registry.pending} pendientes comunicados.</p>}
  </aside>;
}

/** Structured allowlisted presentation. JSON is never the primary explanation. */
function ReadableFacts({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value === null || value === undefined) return <span>Sin dato comprobado</span>;
  if (typeof value !== 'object') return <span>{safeSecurityText(value)}</span>;
  if (depth > 2) return <span>Información adicional no resumida</span>;
  if (Array.isArray(value)) return <ul className="m-0 space-y-1 pl-4">{value.slice(0, 20).map((item, index) => <li key={index}><ReadableFacts value={item} depth={depth + 1} /></li>)}</ul>;
  return <dl className="m-0 space-y-1">{Object.entries(value).slice(0, 20).map(([key, item]) => <div key={key} className="min-w-0 [overflow-wrap:anywhere]"><dt className="inline text-[var(--text-muted)]">{key.replaceAll('_', ' ')}: </dt><dd className="m-0 inline">{/(?:authorization|cookie|credential|password|private.?key|api.?key|secret|token)/i.test(key) ? '[oculto]' : <ReadableFacts value={item} depth={depth + 1} />}</dd></div>)}</dl>;
}
function leaseErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_SECURITY_PIN') return 'El PIN de seguridad es incorrecto. No se creó un acceso temporal.';
    if (error.code === 'SECURITY_PIN_REQUIRED') return 'Configura primero un PIN de seguridad en tu cuenta; no se creó un acceso.';
    if (error.code === 'BREAK_GLASS_REQUIRES_INTERACTIVE_BASE_MODE') return 'La base compilada debe permitir Consultar o Revisión automática.';
  }
  return message(error);
}
export function AgentSecurity(props: AgentSecurityProps) {
  const identity = useAuthStore(state => `${state.user?.id ?? 'anonymous'}:${state.user?.role ?? 'user'}`);
  return <SecurityHelpProvider key={`${props.agentId}:${identity}`}><SecurityEditor {...props} /></SecurityHelpProvider>;
}
function SecurityEditor({ agentId, agentName, showSandbox = true, onChanged, embedded = false, profileCatalogRevision = 0, onManageProfiles }: AgentSecurityProps) {
  const actor = useAuthStore(state => state.user);
  const prefix = useId().replaceAll(':', '');
  const id = (name: string) => `${prefix}-${name}`;
  const sectionId = (name: string) => name === 'isolation' ? `isolation-${agentId}` : id(name);
  const root = useRef<HTMLDivElement>(null);
  const confirmationReturn = useRef<HTMLElement | null>(null);
  const alive = useRef(false), requestSequence = useRef(0), mutationLock = useRef(false), initialized = useRef(false);
  const authority = useRef(0);
  const metadataSequence = useRef(0);
  const securityRef = useRef<SecurityData | null>(null);
  const [security, setSecurity] = useState<SecurityData | null>(null);
  const [runtime, setRuntime] = useState<AgentSecurityRuntime | null>(null);
  const [settings, setSettings] = useState<SecurityPolicySettings | null>(null);
  const [profiles, setProfiles] = useState<CommandProfileSummary[]>([]);
  const [categories, setCategories] = useState<ProtectedSecurityCategory[]>([]);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<PolicyDraft>({ mode: 'deny', profileId: '', fallback: 'deny_and_notify' });
  const [preview, setPreview] = useState<{ data: AgentSecurityPreview; input: string; context: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [viewNotice, setViewNotice] = useState(false);
  const [sandbox, setSandbox] = useState<SandboxViewState>({ status: { color: 'orange', text: 'Aislamiento sin comprobar' }, pending: false, busy: false });
  const [sandboxRefresh, setSandboxRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newEffect, setNewEffect] = useState<SecurityRuleEffect>('block');
  const [newExecutable, setNewExecutable] = useState('');
  const [newArguments, setNewArguments] = useState('');
  const [leaseForm, setLeaseForm] = useState(false);
  const [duration, setDuration] = useState<(typeof durations)[number]>(5);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [leaseReview, setLeaseReview] = useState(false);
  const [leaseError, setLeaseError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const discardPrivateState = useCallback((cause: unknown) => {
    // Invalidate callbacks before releasing the UI for a new authorized read.
    authority.current++;
    mutationLock.current = false; initialized.current = false; securityRef.current = null;
    confirmationReturn.current = null;
    setSecurity(null); setRuntime(null); setReceivedAt(null); setRuntimeError(null);
    setDraft({ mode: 'deny', profileId: '', fallback: 'deny_and_notify' });
    setPreview(null); setConfirmation(null); setNotice(null); setActionError(null); setViewNotice(false);
    setAddOpen(false); setNewEffect('block'); setNewExecutable(''); setNewArguments('');
    setLeaseForm(false); setLeaseReview(false); setDuration(5); setReason(''); setPin('');
    setLeaseError(null); setRevokeError(null);
    setSandbox({ status: { color: 'orange', text: 'Aislamiento sin comprobar' }, pending: false, busy: false });
    setError(message(cause)); setBusy(false); setLoading(false); setMetadataLoading(false); setChecking(false);
  }, []);
  useEffect(() => { alive.current = true; const timer = setInterval(() => setNow(Date.now()), 1000); return () => { alive.current = false; clearInterval(timer); }; }, []);
  const refresh = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (mutationLock.current) return;
    const sequence = ++requestSequence.current;
    setChecking(true);
    let accessError: unknown;
    const read = <T,>(promise: Promise<T>) => promise.catch(cause => {
      if (alive.current && isCurrent() && sequence === requestSequence.current && forbidden(cause)) {
        accessError = cause;
        discardPrivateState(cause);
      }
      throw cause;
    });
    const results = await Promise.allSettled([read(getAgentSecurity(agentId)), read(getAgentSecurityRuntime(agentId))]);
    if (!alive.current || !isCurrent() || sequence !== requestSequence.current) return;
    if (accessError) return; // A fulfilled sibling must not restore data after a denial.
    const [policy, observed] = results;
    if (policy.status === 'fulfilled') {
      const next = policy.value;
      if (securityRef.current && JSON.stringify({ desired: securityRef.current.desired, rules: securityRef.current.rules }) !== JSON.stringify({ desired: next.desired, rules: next.rules })) {
        setPreview(null); setConfirmation(null); setLeaseReview(false);
        setNotice('La configuración guardada ha cambiado. El borrador se conserva; vuelve a revisar antes de guardar.');
      }
      const previous = securityRef.current;
      setDraft(current => {
        if (!initialized.current || !previous) return savedDraft(next);
        const old = savedDraft(previous), saved = savedDraft(next);
        return { mode: current.mode !== old.mode ? current.mode : saved.mode, profileId: current.profileId !== old.profileId ? current.profileId : saved.profileId, fallback: current.fallback !== old.fallback ? current.fallback : saved.fallback };
      });
      initialized.current = true; securityRef.current = next; setSecurity(next); setError(null);
    } else {
      setError(message(policy.reason)); setPreview(null); setConfirmation(null); setLeaseReview(false);
    }
    if (observed.status === 'fulfilled') { setRuntime(observed.value); setRuntimeError(null); }
    else { setRuntime(null); setRuntimeError(message(observed.reason)); setLeaseReview(false); }
    setReceivedAt(policy.status === 'fulfilled' && observed.status === 'fulfilled' ? new Date().toISOString() : null);
    setLoading(false); setChecking(false); setNow(Date.now());
  }, [agentId, discardPrivateState]);
  useVisibleSecurityPolling(root, refresh);
  const loadMetadata = useCallback(async () => {
    const sequence = ++metadataSequence.current;
    setMetadataLoading(true);
    const [ps, global, protectedList] = await Promise.allSettled([listCommandProfiles(), getSecuritySettings(), listProtectedCategories()]);
    if (!alive.current || sequence !== metadataSequence.current) return;
    setMetadataLoading(false);
    if (ps.status === 'fulfilled') setProfiles(ps.value.filter(profile => profile.status === 'published')); else setProfiles([]);
    if (global.status === 'fulfilled') setSettings(global.value); else setSettings(null);
    if (protectedList.status === 'fulfilled') setCategories(protectedList.value); else setCategories([]);
    setMetadataError([ps, global, protectedList].some(result => result.status === 'rejected') ? 'No se pudieron leer todos los perfiles, límites o protecciones globales. Los controles que dependen de ellos permanecen limitados.' : null);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void loadMetadata(); }, [loadMetadata, profileCatalogRevision]);
  const selectedProfile = profiles.find(profile => profile.id === draft.profileId);
  const context = profileSignature(selectedProfile);
  const contextRef = useRef(context); useEffect(() => { contextRef.current = context; }, [context]);
  useEffect(() => { if (preview && preview.context !== context) { setPreview(null); setNotice('La versión publicada o los límites del perfil han cambiado. El borrador se conserva; revisa de nuevo antes de guardar.'); } }, [preview, context]);
  const input = useMemo<AgentSecurityPolicyInput | null>(() => security ? { expected_revision: security.desired.revision, requested_exec_mode: draft.mode, profile_id: draft.profileId || null, unattended_fallback: draft.fallback } : null, [security, draft]);
  const inputKey = JSON.stringify(input);
  const inputRef = useRef(inputKey); useEffect(() => { inputRef.current = inputKey; }, [inputKey]);
  const dirty = !!security && (security.desired.mode === null || JSON.stringify(draft) !== JSON.stringify(savedDraft(security)));
  const fresh = !error && !runtimeError && freshTime(receivedAt, now) && freshTime(security?.effective.observed_at, now);
  const actorMaximum = actor?.role === 'owner' ? 'auto' : security?.inherited.owner_max_user_mode ?? 'deny';
  const maximumRank = Math.min(modeRank[actorMaximum], modeRank[selectedProfile?.max_exec_mode ?? 'deny']);
  const invalidPolicy = !security || !!error || (!selectedProfile && draft.mode !== 'deny') || modeRank[draft.mode] > maximumRank;
  const canRules = !!security?.inherited.profile && !error;
  const canAllow = security?.inherited.profile?.extension_policy === 'allow_unprotected';
  const baseReady = !!security && verifiedCommands(security, runtime, fresh);
  const compiledMode = isExecMode(runtime?.requested_mode) ? runtime.requested_mode : null;
  const requestLeaseReason = !['owner', 'admin'].includes(actor?.role ?? '') ? 'Solo el owner o un administrador habilitado puede solicitar acceso temporal.'
    : !settings ? 'No se pudo leer el máximo y la autorización global.'
    : actor?.role === 'admin' && !settings.allow_admin_break_glass ? 'El owner no ha habilitado solicitudes de administradores.'
    : security?.break_glass.some(leaseOpen) ? 'Ya hay un acceso temporal abierto para este agente.'
    : !baseReady ? 'Se requiere una base aplicada y una comprobación vigente del control de comandos.'
    : !compiledMode || !['ask', 'auto'].includes(compiledMode) ? 'La base compilada debe ser Consultar o Revisión automática.'
    : !durations.some(value => value <= settings.break_glass_max_minutes) ? 'El máximo global no permite ninguna duración disponible.' : null;
  const advancedPending = sandbox.pending ? 'isolation' : preview || draft.fallback !== (security?.desired.unattended_fallback ?? 'deny_and_notify') || confirmation?.kind === 'reconcile' ? 'commands'
    : addOpen || ['tighten', 'remove', 'add'].includes(confirmation?.kind ?? '') ? 'rules' : leaseForm || confirmation?.kind === 'revoke' ? 'temporary' : null;
  const jump = (name: string) => { if (['rules', 'temporary', 'diagnostics'].includes(name)) setAdvanced(true); focusSecurity(sectionId(name)); };
  const edit = (patch: Partial<PolicyDraft>) => { setDraft(current => ({ ...current, ...patch })); setPreview(null); setActionError(null); };
  const beginWrite = () => { if (mutationLock.current || sandbox.busy) return false; mutationLock.current = true; requestSequence.current++; setChecking(false); setBusy(true); setReceivedAt(null); return true; };
  const isAuthorizedOperation = (epoch: number) => alive.current && epoch === authority.current;
  const endWrite = (epoch: number) => { if (!isAuthorizedOperation(epoch)) return; mutationLock.current = false; setBusy(false); };
  const afterWrite = async (text: string, epoch: number) => { if (!isAuthorizedOperation(epoch)) return; setPreview(null); setConfirmation(null); setLeaseReview(false); setNotice(text); toast.success(text); mutationLock.current = false; await refresh(); if (isAuthorizedOperation(epoch)) onChanged?.(); };
  const checkNow = () => { if (busy || sandbox.busy) return; void refresh(); void loadMetadata(); setSandboxRefresh(value => value + 1); };
  const reviewPolicy = async () => {
    if (!input || invalidPolicy || !dirty || mutationLock.current) return;
    if (!beginWrite()) return;
    const epoch = authority.current;
    const snapshot = JSON.stringify(input), reviewedContext = context; setActionError(null);
    try { const data = await previewAgentSecurity(agentId, input); if (isAuthorizedOperation(epoch) && inputRef.current === snapshot && contextRef.current === reviewedContext) { setPreview({ data, input: snapshot, context: reviewedContext }); focusSecurity(id('policy-review')); } }
    catch (cause) { if (isAuthorizedOperation(epoch)) { if (forbidden(cause)) { discardPrivateState(cause); return; } setActionError(message(cause)); if (cause instanceof ApiError && cause.status === 409) { mutationLock.current = false; await refresh(); } toast.error('No se pudo revisar la política'); } }
    finally { endWrite(epoch); }
  };
  const savePolicy = async () => {
    if (!input || !preview || preview.input !== inputKey || preview.context !== context || invalidPolicy || !beginWrite()) return;
    const epoch = authority.current;
    const submitted = { ...draft };
    try {
      const published = (await listCommandProfiles()).filter(profile => profile.status === 'published');
      if (!isAuthorizedOperation(epoch)) return;
      if (profileSignature(published.find(profile => profile.id === draft.profileId)) !== preview.context) { setProfiles(published); setPreview(null); setNotice('La versión publicada del perfil cambió. Revisa de nuevo el borrador antes de guardar.'); return; }
      const writeInput = preview.data.profile_version_guard === true ? { ...input, expected_profile_version_id: preview.data.after.profile_version_id } : input;
      const next = await updateAgentSecurity(agentId, writeInput); if (!isAuthorizedOperation(epoch)) return; securityRef.current = next; setSecurity(next); setDraft(submitted); await afterWrite('Política guardada; comprueba su aplicación.', epoch); }
    catch (cause) { if (isAuthorizedOperation(epoch)) { if (forbidden(cause)) { discardPrivateState(cause); return; } setPreview(null); setActionError(`${message(cause)}. Tu borrador se conserva. Revisa el estado guardado antes de reintentar.`); toast.error('No se pudo confirmar el guardado'); mutationLock.current = false; await refresh(); } }
    finally { endWrite(epoch); if (isAuthorizedOperation(epoch)) focusSecurity(sectionId('commands')); }
  };
  const confirmAction = async () => {
    if (!confirmation) return;
    const action = confirmation;
    const saved = securityRef.current?.desired;
    if (action.revision !== security?.desired.revision) return;
    if (action.kind === 'reconcile' && (action.revision !== saved?.revision
      || action.agentId !== agentId || action.mode !== security?.desired.mode || action.mode !== saved?.mode)) {
      setConfirmation(null);
      setActionError('La política guardada cambió. Comprueba de nuevo antes de reaplicarla.');
      return;
    }
    if (!beginWrite()) return;
    const epoch = authority.current;
    setActionError(null);
    try {
      if (action.kind === 'reconcile') await reconcileAgentSecurity(agentId, { expected_revision: action.revision, expected_mode: action.mode });
      if (action.kind === 'tighten') await addAgentSecurityRule(agentId, { effect: action.effect, base_rule_fingerprint: action.fingerprint });
      if (action.kind === 'remove') await revokeAgentSecurityRule(agentId, action.id);
      if (action.kind === 'add') await addAgentSecurityRule(agentId, { effect: newEffect, rule: { effect: newEffect, target: 'gateway', executable_pattern: newExecutable.trim(), argument_matcher: { kind: newArguments.trim() ? 'prefix' : 'exact', value: newArguments.trim() }, cwd_scope: 'agent_workspace', cwd_path: null, description: `Local override for ${agentName}` } });
      if (action.kind === 'revoke') await revokeAgentBreakGlass(agentId, action.id);
      if (!isAuthorizedOperation(epoch)) return;
      if (action.kind === 'add') { setAddOpen(false); setNewExecutable(''); setNewArguments(''); }
      if (action.kind === 'revoke') setRevokeError(null);
      await afterWrite(action.kind === 'revoke' ? 'Revocación solicitada. El registro se refresca; el cierre efectivo requiere comprobación del runtime.' : action.kind === 'reconcile' ? 'Reaplicación solicitada. Comprueba el estado efectivo tras la nueva lectura.' : 'Cambio guardado o solicitado. Comprueba su aplicación.', epoch);
    } catch (cause) {
      if (!isAuthorizedOperation(epoch)) return;
      if (forbidden(cause)) { discardPrivateState(cause); return; }
      const text = message(cause);
      if (action.kind === 'revoke') setRevokeError(`No se pudo confirmar la revocación. ${text}`);
      else setActionError(`${text}. El formulario y el borrador se conservan.`);
      setConfirmation(null); toast.error('No se pudo completar la operación');
      if (action.kind === 'reconcile' && cause instanceof ApiError && cause.status === 409) {
        mutationLock.current = false;
        await refresh();
      }
    } finally { endWrite(epoch); if (isAuthorizedOperation(epoch)) focusSecurity(sectionId(action.kind === 'revoke' ? 'temporary' : action.kind === 'reconcile' ? 'commands' : 'rules')); }
  };
  const submitLease = async () => {
    if (!leaseReview || requestLeaseReason || !settings || duration > settings.break_glass_max_minutes || reason.trim().length < 8 || !pin || !beginWrite()) return;
    const epoch = authority.current;
    setLeaseError(null);
    try { await requestAgentBreakGlass(agentId, { duration_minutes: duration, reason: reason.trim(), pin }); if (!isAuthorizedOperation(epoch)) return; setLeaseForm(false); setLeaseReview(false); setReason(''); await afterWrite('Acceso temporal solicitado; su aplicación debe comprobarse.', epoch); }
    catch (cause) { if (isAuthorizedOperation(epoch)) { const pinRejection = cause instanceof ApiError && ['INVALID_SECURITY_PIN', 'SECURITY_PIN_REQUIRED', 'BREAK_GLASS_REQUIRES_INTERACTIVE_BASE_MODE'].includes(cause.code); if (forbidden(cause) && !pinRejection) { discardPrivateState(cause); return; } setLeaseError(leaseErrorMessage(cause)); setLeaseReview(false); toast.error('Solicitud temporal rechazada o sin confirmar'); } }
    finally { if (isAuthorizedOperation(epoch)) { setPin(''); focusSecurity(sectionId('temporary')); } endWrite(epoch); }
  };

  const commands = security ? commandStatus(security, runtime, fresh) : { color: 'orange', text: 'Cargando estado de comandos' } as AspectStatus;
  const registry = registryData(runtime?.guard.tool_registry);
  const rulesStatus: AspectStatus = !fresh || !registry ? { color: 'orange', text: 'Registro sin comprobar ahora' } : !registry.enforced ? { color: 'red', text: 'Control del registro no aplicado' }
    : registry.pending > 0 ? { color: 'orange', text: `${registry.pending} contratos pendientes`, detail: 'Del servidor; asignación al agente sin comprobar.' } : { color: 'green', text: 'Registro del servidor comprobado', detail: 'Sin contratos pendientes en la lectura vigente.' };
  const temporal = security ? leaseStatus(security, fresh, revokeError) : { color: 'orange', text: 'Acceso temporal sin comprobar' } as AspectStatus;
  const environments: AspectStatus = fresh && runtime?.guard.health === 'unhealthy' ? { color: 'red', text: 'Fallo del control de comandos' } : { color: 'orange', text: 'Comprobación parcial', detail: fresh ? 'Cada proveedor requiere sus propias evidencias.' : 'No hay una observación vigente.' };
  const canReconcile = !!security && isExecMode(security.desired.mode) && fresh && runtime?.drift.recovery === 'reconcile' && !baseReady;
  const rows = [
    ...(showSandbox ? [['isolation', 'Aislamiento', sandbox.status, 'isolation'] as const] : []),
    ['commands', 'Comandos', commands, 'commands'] as const,
    ['temporary', 'Acceso temporal', temporal, 'temporary'] as const,
  ];
  const policyChanged = (value: Partial<PolicyDraft>) => edit(value);
  const startConfirmation = (value: Confirmation) => { confirmationReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setConfirmation(value); setActionError(null); focusSecurity(id(`${value.kind}-review`)); };
  const confirmationPanel = (kind: Confirmation['kind'], title: string, body: ReactNode) => confirmation?.kind === kind ? <InlineReview id={id(`${kind}-review`)} title={title} onCancel={() => { setConfirmation(null); requestAnimationFrame(() => { if (confirmationReturn.current?.isConnected) confirmationReturn.current.focus(); else focusSecurity(sectionId(kind === 'revoke' ? 'temporary' : kind === 'reconcile' ? 'commands' : 'rules')); }); }} cancelLabel="Cancelar" actions={<SecurityButton variant={kind === 'revoke' || kind === 'remove' ? 'destructive' : 'default'} disabled={busy || !!error || confirmation.revision !== security?.desired.revision || (confirmation.kind === 'reconcile' && (confirmation.agentId !== agentId || confirmation.mode !== security?.desired.mode))} onClick={() => void confirmAction()}>Confirmar {kind === 'revoke' ? 'revocación' : kind === 'remove' ? 'retirada' : kind === 'reconcile' ? 'reaplicación' : 'regla'}</SecurityButton>}>{body}</InlineReview> : null;

  return <div ref={root} data-testid="agent-security" data-agent-id={agentId} className="@container flex min-w-0 max-w-full flex-col gap-5 [overflow-wrap:anywhere] text-[var(--text)]" aria-busy={busy || loading || metadataLoading}>
    <header>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">{!embedded && <h2 className="m-0 text-xl font-semibold">Seguridad</h2>}<span className="text-xs text-[var(--text-muted)]">Este agente · {agentName}</span><SecurityButton variant="outline" aria-expanded={advanced} aria-controls={`${id('advanced-sections')} ${sectionId('diagnostics')}`} disabled={!security || busy || sandbox.busy} onClick={() => { if (advanced && advancedPending) { setViewNotice(true); return; } setAdvanced(value => !value); setViewNotice(false); }}>Avanzado<ChevronDown size={13} className={advanced ? 'rotate-180' : ''} /></SecurityButton></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="m-0 text-xs text-[var(--text-muted)]">{checking ? 'Comprobando…' : `Última comprobación: ${displayTime(security?.effective.observed_at)}`}{receivedAt && !fresh ? ' · histórica o sin verificar' : ''}</p><SecurityButton variant="outline" onClick={checkNow} disabled={busy || checking || sandbox.busy}><RefreshCw size={12} />Comprobar ahora</SecurityButton></div>
    </header>
    {error && <p role="alert" className="m-0 text-xs text-[var(--error)]">{error}. {security ? 'El borrador se conserva; la observación no está verificada.' : 'No se muestran valores de una visita anterior.'}</p>}
    {runtimeError && <p role="alert" className="m-0 text-xs text-[var(--amber)]">No se pudo comprobar el runtime. {runtimeError}. Los registros de acceso no demuestran efectividad actual.</p>}
    {loading && !security && <p role="status" className="text-xs text-[var(--text-muted)]">Cargando seguridad y permisos…</p>}
    {security && <>
      {viewNotice && advancedPending && <p role="status" className="m-0 border-l-2 border-[var(--amber)] pl-3 text-xs text-[var(--text-dim)]">Hay cambios o una revisión abierta en Avanzado. Revisa o cancela antes de cerrarlo. <SecurityButton variant="link" onClick={() => jump(advancedPending)}>Ir a los cambios pendientes</SecurityButton></p>}
      <ul aria-label="Resumen de seguridad" className="m-0 list-none divide-y divide-[var(--border)] border-y border-[var(--border)] p-0">{rows.map(([target, label, status, topic]) => <li key={target} className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px] items-start gap-1">
        <button type="button" onClick={() => jump(target)} className="flex min-w-0 flex-1 gap-2 border-0 bg-transparent px-0 py-2 text-left text-xs leading-relaxed text-[var(--text)] hover:bg-[var(--card)]"><StatusDot status={status} /><span className="min-w-0"><strong className="text-[13px]">{label}</strong> — <StatusText status={status} />{status.detail && <span className="block text-[var(--text-muted)]">{status.detail}</span>}{target === 'temporary' && security.break_glass.some(leaseOpen) && <span className="block text-[var(--amber)]">Ver y revocar →</span>}</span></button><SecurityHelp topic={topic} />
      </li>)}</ul>
      {notice && <p role="status" className="m-0 text-xs leading-relaxed text-[var(--text-dim)]">{notice}</p>}
      {registry && (!registry.enforced || registry.pending > 0) && <p className="m-0 text-xs text-[var(--amber)]"><StatusText status={rulesStatus} /> · <SecurityButton variant="link" onClick={() => jump('diagnostics')}>Ver estado del registro de herramientas</SecurityButton></p>}
      {showSandbox && <AgentSandboxConfig agentId={agentId} agentName={agentName} advanced={advanced} refreshKey={sandboxRefresh} onState={setSandbox} showStatus={false} />}
      <SecuritySection id={sectionId('commands')} title="Comandos" topic="commands">
        {metadataError && <p role="alert" className="text-xs text-[var(--amber)]">{metadataError}</p>}
        {security.desired.mode === null && <p className="text-xs text-[var(--amber)]">Sin política gestionada. Seleccionar opciones prepara un borrador; no cambia la política nativa ni bloquea comandos automáticamente.</p>}
        <p className="text-xs text-[var(--text-muted)]">Controla comandos ejecutados en el equipo; las demás herramientas conservan sus propios permisos.</p>
        <SecurityFacts rows={[
          ['Límite del dueño', security.agent.owner_role === 'owner' ? 'Revisión automática · dueño owner' : `${modeCopy[security.inherited.owner_max_user_mode]} · global${security.agent.owner_role ? '' : '; rol del dueño sin comprobar'}`],
          ['Límite del perfil', selectedProfile ? modeCopy[selectedProfile.max_exec_mode] : 'Sin perfil: solo No ejecutar comandos'],
        ]} />
        <fieldset className={settingClass} disabled={busy || !!error}><legend className="text-[13px] font-semibold">Cómo supervisar los comandos<SecurityHelp topic="mode" /></legend>{(Object.keys(modeCopy) as SecurityExecMode[]).map(mode => <RadioChoice key={mode} name={id('mode')} value={mode} label={`${mode === 'allowlist' ? 'allow' : mode} · ${modeCopy[mode]}`} checked={draft.mode === mode} disabled={modeRank[mode] > maximumRank} description={modeRank[mode] > maximumRank ? 'No disponible: supera el máximo del perfil o el límite de tu rol.' : mode === 'auto' ? 'Solo operaciones compatibles; no elude las protecciones ni una confirmación obligatoria.' : undefined} onChange={() => policyChanged({ mode })} />)}</fieldset>
        <fieldset className={settingClass} disabled={busy || !!error}>
          <legend className="text-[13px] font-semibold">Perfil asignado<SecurityHelp topic="profile" /></legend>
          <label htmlFor={id('profile')} className="sr-only">Perfil de comandos de este agente</label>
          <select id={id('profile')} name={id('profile')} value={draft.profileId} className={`${inputClass} max-w-xl`} onChange={event => policyChanged({ profileId: event.target.value })}>
            <option value="" disabled={draft.mode !== 'deny'}>Ningún perfil · solo al no ejecutar comandos</option>
            {draft.profileId && !selectedProfile && <option value={draft.profileId} disabled>Perfil guardado no disponible</option>}
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name} · versión {profile.published_version}</option>)}
          </select>
          {selectedProfile && <p className="text-xs text-[var(--text-muted)]">Publicado y compartido · {selectedProfile.extension_policy === 'allow_unprotected' ? 'permite extensiones no protegidas' : 'solo restricciones locales'}</p>}
          {draft.profileId && !selectedProfile && <p className="text-xs text-[var(--amber)]">El perfil guardado no está disponible para elegir. Su valor se conserva; elige uno publicado antes de guardar.</p>}
          <div className="flex flex-wrap gap-2"><SecurityButton variant="link" onClick={() => jump('rules')}>Ver reglas y bloqueos</SecurityButton>{onManageProfiles && <SecurityButton variant="link" onClick={onManageProfiles}>Gestionar perfiles compartidos ↓</SecurityButton>}</div>
        </fieldset>
        {actor?.role === 'owner' && security.agent.owner_role && security.agent.owner_role !== 'owner' && <p className="text-xs text-[var(--amber)]">Puedes guardar intención como owner. Al compilar se conserva el límite del dueño de este agente; guardar no lo amplía.</p>}
        <fieldset hidden={!advanced} className={settingClass} disabled={busy || !!error}><legend className="text-[13px] font-semibold">Sin atención humana<SecurityHelp topic="fallback" /></legend><p className="text-xs text-[var(--text-muted)]">Intención propia guardada: {security.desired.unattended_fallback ? fallbackCopy[security.desired.unattended_fallback] : 'sin dato'}</p>{(Object.keys(fallbackCopy) as Fallback[]).map(value => <RadioChoice key={value} name={id('fallback')} value={value} label={fallbackCopy[value]} checked={draft.fallback === value} onChange={() => policyChanged({ fallback: value })} />)}<p className="text-xs text-[var(--text-muted)]">Implementación parcial: no se han demostrado tres comportamientos distintos ni avisos diferenciados. Las operaciones que necesitan una persona siguen bloqueadas sin su decisión.</p></fieldset>
        {dirty && <p className="text-xs text-[var(--amber)]">Borrador sin guardar. Guardado y observado permanecen separados.</p>}
        {actionError && <p role="alert" className="text-xs text-[var(--error)]">{actionError}</p>}
        <div className="flex flex-wrap gap-2"><SecurityButton variant="outline" disabled={!dirty || busy} onClick={() => { setDraft(savedDraft(security)); setPreview(null); setActionError(null); }}>Cancelar cambios</SecurityButton><SecurityButton id={id('preview')} disabled={!dirty || invalidPolicy || busy || sandbox.busy} onClick={() => void reviewPolicy()}>Revisar cambios</SecurityButton></div>
        {preview && <InlineReview id={id('policy-review')} title="Revisar supervisión" onCancel={() => { setPreview(null); focusSecurity(id('preview')); }} actions={<SecurityButton disabled={busy || invalidPolicy || preview.input !== inputKey || preview.context !== context} onClick={() => void savePolicy()}>Guardar y solicitar aplicación</SecurityButton>}>
          <SecurityFacts rows={[
            ['Modo guardado → propuesto', `${security.desired.mode ? modeCopy[security.desired.mode] : 'Sin política'} → ${modeCopy[draft.mode]}`],
            ['Perfil', `${security.inherited.profile?.name ?? 'Ninguno'} → ${selectedProfile ? `${selectedProfile.name} v${selectedProfile.published_version}` : 'Ninguno'}`],
            ['Sin atención humana', `${security.desired.unattended_fallback ? fallbackCopy[security.desired.unattended_fallback] : 'Sin dato'} → ${fallbackCopy[draft.fallback]} (intención)`],
            ['Reglas de perfil', preview.data.impact.profile_rules], ['Reglas locales', preview.data.impact.local_overrides],
            ['Se conservan', preview.data.impact.retained_local_overrides ?? 'No detallado por esta versión del servidor'], ['Permisos locales que se revocan', preview.data.impact.revoked_allow_overrides ?? 'No detallado por esta versión del servidor'],
          ]} />
          {(preview.data.impact.revoked_allow_overrides ?? 0) > 0 && <ul>{security.rules.overrides.filter(rule => rule.effect === 'allow').map(rule => <li key={rule.id}>{safeSecurityText(rule.rule.executable_pattern)} · {sourceCopy[rule.source]} · {rule.id}</li>)}</ul>}
          {preview.data.warnings.map(warning => <p key={warning}>{safeSecurityText(warning)}</p>)}{preview.data.profile_version_guard !== true && <p className="text-[var(--amber)]">Si se publica otra versión del perfil durante el guardado, este servidor puede usarla. Vuelve a comprobar el perfil tras guardar.</p>}<p>No se ejecutan comandos en esta revisión. El servidor conserva el límite del dueño y del perfil. Guardar solicita aplicación; debe comprobarse después.</p>
        </InlineReview>}
        {(advanced || canReconcile) && <><div className="mt-3"><SecurityButton variant="outline" disabled={!canReconcile || busy} onClick={() => { const mode = security.desired.mode; if (isExecMode(mode)) startConfirmation({ kind: 'reconcile', agentId, revision: security.desired.revision, mode }); }}>Volver a aplicar lo guardado</SecurityButton></div><p className="text-xs text-[var(--text-muted)]">{canReconcile ? 'Reenvía lo guardado. No guarda el borrador ni amplía el límite del dueño.' : 'Disponible ante una discrepancia recuperable con comunicación vigente.'}</p></>}
        {confirmationPanel('reconcile', 'Confirmar reaplicación', <p>Se solicitará aplicar lo guardado: {confirmation?.kind === 'reconcile' ? `${modeCopy[confirmation.mode]} · revisión ${confirmation.revision}` : 'sin dato'}. El borrador visible se conserva. Esta acción escribe configuración; Comprobar ahora solo consulta. La respuesta no demuestra que la política ya esté aplicada.</p>)}
        <div id={id('advanced-sections')} hidden={!advanced} className="mt-5 min-w-0 space-y-5">
        <SecuritySection nested id={sectionId('rules')} title="Reglas y bloqueos" topic="rules">
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">Procedencia: global, heredada o propia. Las reglas locales no reducen las protecciones globales.<SecurityHelp topic="origins" /></p>
          {categories.length ? <SecurityFacts rows={categories.filter(category => category.enabled).map(category => [category.label, `${category.floor === 'deny' ? 'Bloquear' : category.floor === 'secure_confirmation' ? 'Confirmación segura' : 'Confirmación humana'} · global${category.immutable ? ' · inmutable' : ''}`])} /> : <p className="text-xs text-[var(--text-muted)]">Valores de categorías globales sin comprobar; no se infiere que estén desactivadas.</p>}
          <ul aria-label="Reglas del agente" className="m-0 list-none divide-y divide-[var(--border)] p-0">{security.rules.profile.map(rule => {
            const overrides = security.rules.overrides.filter(item => item.base_rule_fingerprint === rule.fingerprint);
            const ranks = { allow: 0, prompt: 1, block: 2 };
            const strongest = Math.max(ranks[rule.effect], ...overrides.map(item => ranks[item.effect]));
            return <li key={rule.fingerprint} className="py-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><strong className="[overflow-wrap:anywhere]">{safeSecurityText(rule.executable_pattern)} {safeSecurityText(rule.argument_matcher.value)}</strong><span>{effectCopy[rule.effect]} · heredada</span></div><p className="my-2 text-xs text-[var(--text-muted)]">{security.inherited.profile?.name} v{security.inherited.profile?.version ?? 'sin dato'} · {rule.target} · {rule.cwd_scope} · {rule.category}</p><div className="flex flex-wrap gap-2"><SecurityButton variant="outline" disabled={!canRules || busy || strongest >= 1} onClick={() => startConfirmation({ kind: 'tighten', effect: 'prompt', fingerprint: rule.fingerprint, revision: security.desired.revision })}>Pedir confirmación</SecurityButton><SecurityButton variant="outline" disabled={!canRules || busy || strongest >= 2} onClick={() => startConfirmation({ kind: 'tighten', effect: 'block', fingerprint: rule.fingerprint, revision: security.desired.revision })}>Bloquear</SecurityButton></div>{overrides.map(item => <div key={item.id} className="mt-2 text-xs"><span>{effectCopy[item.effect]} · restricción propia</span> <SecurityButton variant="outline" disabled={busy || !!error} onClick={() => startConfirmation({ kind: 'remove', id: item.id, revision: security.desired.revision })}>Quitar restricción</SecurityButton></div>)}</li>;
          })}{security.rules.overrides.filter(item => !item.base_rule_fingerprint).map(rule => <li key={rule.id} className="py-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong>{safeSecurityText(rule.rule.executable_pattern)} {safeSecurityText(rule.rule.argument_matcher?.value)}</strong><span>{effectCopy[rule.effect]}</span></div><p className="my-2 text-[var(--text-muted)]">{sourceCopy[rule.source]} · {rule.rule.target} · {rule.rule.cwd_scope}</p><SecurityButton variant="outline" disabled={busy || !!error} onClick={() => startConfirmation({ kind: 'remove', id: rule.id, revision: security.desired.revision })}>Quitar regla</SecurityButton></li>)}</ul>
          {!security.rules.profile.length && !security.rules.overrides.length && <p className="text-xs text-[var(--text-muted)]">Sin reglas gestionadas devueltas. No demuestra qué permite la política nativa.</p>}
          {confirmationPanel('tighten', 'Revisar restricción de regla', <p>{confirmation?.kind === 'tighten' && <><strong>{safeSecurityText(security.rules.profile.find(rule => rule.fingerprint === confirmation.fingerprint)?.executable_pattern)} · {confirmation.fingerprint}</strong> → {effectCopy[confirmation.effect]}. </>}Se añade una restricción propia; no cambia la coincidencia ni las protecciones heredadas.</p>)}
          {confirmationPanel('remove', 'Revisar retirada de regla', <p>{confirmation?.kind === 'remove' && <><strong>{safeSecurityText(security.rules.overrides.find(rule => rule.id === confirmation.id)?.rule.executable_pattern)} · {confirmation.id}</strong> → retirar regla local. </>}Retirar una restricción puede ampliar lo permitido; las reglas compartidas y las protecciones siguen vigentes.</p>)}
          <div className="mt-3"><SecurityButton id={id('add-rule-trigger')} variant="outline" disabled={!canRules || busy || addOpen} onClick={() => { setAddOpen(true); focusSecurity(id('new-rule')); }}>Añadir regla</SecurityButton></div>
          {!canRules && <p className="text-xs text-[var(--text-muted)]">Hace falta un perfil gestionado y acceso de escritura para añadir o endurecer reglas.</p>}
          {addOpen && <div className="mt-3 border-l-2 border-[var(--border)] pl-3" onKeyDown={event => { if (event.key === 'Escape' && !confirmation && !busy) { event.preventDefault(); setAddOpen(false); focusSecurity(id('add-rule-trigger')); } }}><h4 id={id('new-rule')} tabIndex={-1}>Nueva regla de este agente<SecurityHelp topic="rule" /></h4><fieldset className={settingClass} disabled={busy || !canRules}><legend>Efecto</legend>{(['block', 'prompt', 'allow'] as const).map(effect => <RadioChoice key={effect} name={id('new-effect')} value={effect} label={effectCopy[effect]} checked={newEffect === effect} disabled={effect === 'allow' && !canAllow} description={effect === 'allow' && !canAllow ? 'El perfil no admite permisos locales.' : undefined} onChange={() => { setNewEffect(effect); setConfirmation(null); }} />)}</fieldset><label className="block text-xs">Ejecutable<input className={inputClass} value={newExecutable} disabled={busy} maxLength={160} onChange={event => { setNewExecutable(event.target.value); setConfirmation(null); }} /></label><label className="mt-3 block text-xs">Prefijo de argumentos<input className={inputClass} value={newArguments} disabled={busy} maxLength={500} onChange={event => { setNewArguments(event.target.value); setConfirmation(null); }} /></label><p className="text-xs text-[var(--text-muted)]">Target: Gateway · carpeta de este agente. Argumentos vacíos: coincidencia exacta; con texto: prefijo. El servidor valida categoría y protecciones.</p><div className="flex flex-wrap gap-2"><SecurityButton variant="outline" disabled={busy} onClick={() => { setAddOpen(false); setConfirmation(null); focusSecurity(id('add-rule-trigger')); }}>Cancelar regla</SecurityButton><SecurityButton disabled={!canRules || !newExecutable.trim() || busy || (newEffect === 'allow' && !canAllow)} onClick={() => startConfirmation({ kind: 'add', revision: security.desired.revision })}>Revisar regla</SecurityButton></div>{confirmationPanel('add', 'Revisar nueva regla', <p>{effectCopy[newEffect]}: {safeSecurityText(newExecutable)} {safeSecurityText(newArguments)}. No puede eludir una protección o una regla heredada.</p>)}</div>}
          {actionError && <p role="alert" className="text-xs text-[var(--error)]">{actionError}</p>}
        </SecuritySection>
        <SecuritySection nested id={sectionId('temporary')} title="Acceso temporal" topic="temporary">
          <SecurityFacts rows={[
            ['Registros devueltos', `${security.break_glass.length} · ${security.break_glass.some(lease => effectiveLease(lease, runtime, fresh, now)) ? 'hay efectividad atestada en la lectura vigente' : 'efectividad o ausencia sin comprobar'}`],
            ['Máximo global', settings ? `${settings.break_glass_max_minutes} minutos · servidor` : 'Sin dato'],
            ['Administradores', settings ? settings.allow_admin_break_glass ? 'Habilitados por owner · global' : 'No habilitados por owner · global' : 'Sin dato'],
            ['Base compilada', fresh && compiledMode ? modeCopy[compiledMode] : 'Sin comprobación vigente'],
          ]} />
          {requestLeaseReason && <p className="text-xs text-[var(--text-muted)]">{requestLeaseReason}</p>}
          <SecurityButton id={id('request-lease-trigger')} variant="outline" disabled={!!requestLeaseReason || busy || leaseForm} onClick={() => { setLeaseForm(true); setLeaseReview(false); setLeaseError(null); setDuration(durations.find(value => value <= (settings?.break_glass_max_minutes ?? 0)) ?? 5); focusSecurity(id('lease-form')); }}>Solicitar acceso temporal</SecurityButton>
          {security.break_glass.map(lease => <div key={lease.id} className="my-3 border-t border-[var(--border)] pt-3"><SecurityFacts rows={[
            ['Estado del registro', ({ active: 'Activo', pending_application: 'Aplicación pendiente', application_failed: 'Falló aplicación', expired: 'Caducado', revoked: 'Revocado' })[lease.status]],
            ['Alcance', `${lease.adapter_id} · comandos elegibles; no concede herramientas`], ['Motivo', safeSecurityText(lease.reason)], ['Vencimiento', displayTime(lease.expires_at)],
            ['Efectividad', effectiveLease(lease, runtime, fresh, now) ? 'Atestada por Core y vigente para el control de esta lectura' : 'Sin comprobar ahora. Registro y reloj no demuestran aplicación ni cierre'],
            ['Aplicación del proveedor', `${lease.provider_application} · guard ${lease.guard_policy_version ?? 'sin versión'}`],
          ]} />{leaseOpen(lease) && <SecurityButton variant="destructive" disabled={busy || !!error} onClick={() => startConfirmation({ kind: 'revoke', id: lease.id, revision: security.desired.revision })}>Revocar acceso temporal</SecurityButton>}</div>)}
          {confirmationPanel('revoke', 'Confirmar revocación', <p>{confirmation?.kind === 'revoke' && <><strong>{confirmation.id}</strong> · {security.break_glass.find(lease => lease.id === confirmation.id)?.adapter_id} · vence {displayTime(security.break_glass.find(lease => lease.id === confirmation.id)?.expires_at)} → revocar. </>}Se conserva la política base. Se puede intentar aunque el runtime esté desconectado. El cierre efectivo no se deduce de la respuesta ni del reloj.</p>)}
          {leaseForm && <div className="mt-3 border-l-2 border-[var(--amber)] pl-3" onKeyDown={event => { if (event.key === 'Escape' && !leaseReview && !busy) { event.preventDefault(); setLeaseForm(false); setPin(''); focusSecurity(id('request-lease-trigger')); } }}><h4 id={id('lease-form')} tabIndex={-1}>Solicitar para este agente</h4><fieldset className={settingClass} disabled={busy}><legend>Duración<SecurityHelp topic="duration" /></legend>{durations.map(value => <RadioChoice key={value} name={id('duration')} value={String(value)} label={`${value} minutos`} checked={duration === value} disabled={value > (settings?.break_glass_max_minutes ?? 0)} description={value > (settings?.break_glass_max_minutes ?? 0) ? 'Supera el máximo global.' : undefined} onChange={() => { setDuration(value); setLeaseReview(false); }} />)}</fieldset><label className="block text-xs">Motivo<textarea className={inputClass} minLength={8} maxLength={500} value={reason} disabled={busy} onChange={event => { setReason(event.target.value); setLeaseReview(false); }} /><span className="text-[var(--text-muted)]">Entre 8 y 500 caracteres.</span></label><label className="mt-3 block text-xs">PIN de seguridad<input type="password" autoComplete="off" inputMode="numeric" maxLength={128} className={inputClass} value={pin} disabled={busy} onChange={event => { setPin(event.target.value); setLeaseReview(false); }} /></label><p className="text-xs text-[var(--text-muted)]">Se verifica el PIN propio en el servidor. No se guarda en esta vista ni en el navegador.</p>{leaseError && <p role="alert" className="text-xs text-[var(--error)]">{leaseError}</p>}<div className="flex flex-wrap gap-2"><SecurityButton variant="outline" disabled={busy} onClick={() => { setLeaseForm(false); setLeaseReview(false); setPin(''); setLeaseError(null); focusSecurity(id('request-lease-trigger')); }}>Cancelar solicitud</SecurityButton><SecurityButton id={id('lease-preview')} disabled={!!requestLeaseReason || busy || reason.trim().length < 8 || !pin} onClick={() => { setLeaseReview(true); focusSecurity(id('lease-review')); }}>Revisar acceso temporal</SecurityButton></div>{leaseReview && <InlineReview id={id('lease-review')} title="Confirmar acceso temporal" onCancel={() => { setLeaseReview(false); focusSecurity(id('lease-preview')); }} actions={<SecurityButton variant="destructive" disabled={!!requestLeaseReason || busy || !pin} onClick={() => void submitLease()}>Confirmar con PIN</SecurityButton>}><p>{duration} minutos · {safeSecurityText(reason)}. Amplía comandos elegibles y mantiene protecciones. La solicitud no demuestra aplicación; el estado se comprobará después.</p></InlineReview>}</div>}
          {revokeError && <p role="alert" className="text-xs text-[var(--error)]">{revokeError}</p>}
        </SecuritySection>
        </div>
      </SecuritySection>
      <SecuritySection id={sectionId('diagnostics')} title="Estado y diagnóstico" topic="diagnostics" status={environments} hidden={!advanced}>
          <h4 className="text-sm">Comandos del equipo · OpenClaw<SecurityHelp topic="guard" /></h4>
          <SecurityFacts rows={[
            ['Comprobación', fresh ? `Vigente · ${displayTime(security.effective.observed_at)}` : 'Sin evidencia vigente'],
            ['Revisiones', `Guardada ${security.desired.revision} / aplicada ${security.desired.applied_revision ?? 'sin dato'}`],
            ['Modo guardado', security.desired.mode ? modeCopy[security.desired.mode] : 'Sin política gestionada'],
            ['Modo observado', fresh && isExecMode(runtime?.effective_mode) ? modeCopy[runtime.effective_mode] : 'Sin comprobación vigente'],
            ['Perfil guardado', security.inherited.profile ? `${security.inherited.profile.name} v${security.inherited.profile.version ?? 'sin dato'} · compartido y publicado` : 'Ninguno'],
            ['Predeterminado global', `${modeCopy[security.inherited.server_default_mode]} · solo nuevas políticas`],
            ['Modo compilado', compiledMode ? `${modeCopy[compiledMode]}${fresh ? '' : ' · última lectura, sin comprobar ahora'}` : 'Sin dato'],
            ['Control de comandos', runtime ? <ReadableFacts value={runtime.guard.health} /> : 'Sin dato'],
            ['Sustrato host', <ReadableFacts value={runtime?.openclaw_exec} />], ['Confirmaciones', <ReadableFacts value={runtime?.approvals} />],
          ]} />
          {(runtime?.adapters ?? security.adapters).map(adapter => <div key={adapter.id} className="border-t border-[var(--border)] py-3"><h4 className="m-0 text-sm">{adapter.label ?? adapter.id}</h4><SecurityFacts rows={[
            ['Disponibilidad', `${adapter.availability}${fresh ? '' : ' · lectura sin verificar ahora'}`],
            ['Configuración solicitada', <ReadableFacts value={adapter.requested_policy} />], ['Observación propia', <ReadableFacts value={adapter.effective_policy} />], ['Capas', <ReadableFacts value={adapter.source_layers} />],
            ...('apply_effect' in adapter ? [['Aplicación', adapter.apply_effect], ['Confirmación humana', adapter.approval_transport], ['Capacidades comunicadas', <ReadableFacts value={adapter.guard_capabilities} />], ['Notas', <ReadableFacts value={adapter.notes} />]] as Array<[string, ReactNode]> : []),
          ]} /><p className="text-xs text-[var(--text-muted)]">Disponibilidad y salud del equipo no demuestran los permisos nativos de un proveedor. Solo se muestran entornos comunicados por Core.</p></div>)}
          {!runtime?.adapters.length && <p className="text-xs text-[var(--text-muted)]">No se han comunicado entornos nativos activos. No se deducen del modelo elegido.</p>}
          <SecurityFacts rows={(runtime?.layers ?? []).map(layer => [layer.source.replaceAll('_', ' '), <ReadableFacts value={layer.value} />])} />
          {registry ? <ToolSecurityRegistryStatus value={runtime?.guard.tool_registry} /> : <p className="mt-3 text-xs text-[var(--text-muted)]">Registro de herramientas: sin comprobación de enforcement. No se conceden permisos desde esta lista.</p>}
          <h4 className="text-sm">Recuperación y límites<SecurityHelp topic="layers" /></h4><SecurityFacts rows={[
            ['Recuperación', (runtime?.recovery ?? security.recovery) ? <ReadableFacts value={runtime?.recovery ?? security.recovery} /> : 'Sin episodio de recuperación comunicado'],
            ['Efecto de guardar', 'Solicita aplicación y lectura posterior; no revierte acciones ya ejecutadas. El sandbox no se confirma por configurar sus valores.'],
            ['Errores de comunicación', error || runtimeError || 'Ninguno comunicado en la última consulta'],
          ]} />
      </SecuritySection>
    </>}
  </div>;
}
