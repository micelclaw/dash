import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { ApiError } from '@/services/api';
import { listManagedAgents } from '@/services/agents-admin.service';
import { getAgentSecurity, getAgentSecurityRuntime, type AgentSecurity } from '@/services/security-policy.service';
import { checkChatConnection, restoreSavedAsk, restoredAskIsVerified, savedAskCanBeRestored, sanitizeChatDiagnostic } from '@/services/chat-recovery.service';
import type { Message } from '@/types/chat';

type Cause = 'network' | 'gateway_pairing' | 'security_policy';
export function isChatRecoveryCause(value: string | undefined): value is Cause {
  return value === 'network' || value === 'gateway_pairing' || value === 'security_policy';
}
/** Older persisted error rows may predate the structured error_type field. */
export function getChatRecoveryCause(message: Message): Cause | null {
  if (isChatRecoveryCause(message.error_type)) return message.error_type;
  if (message.error_type && message.error_type !== 'unknown') return null;
  const detail = message.error_detail || message.content;
  if (/tools\.exec\.mode\s*=\s*deny/i.test(detail)) return 'security_policy';
  if (/pairing required|device (?:pairing|approval) (?:required|pending)|device .*not paired/i.test(detail)) return 'gateway_pairing';
  if (/cannot connect to (?:gateway|agent)|gateway connection closed|ECONNREFUSED|ECONNRESET/i.test(detail)) return 'network';
  return null;
}

export function ChatRecoveryCard({ message }: { message: Message }) {
  const navigate = useNavigate();
  const actor = useAuthStore(s => s.user);
  const actorId = actor?.id;
  const session = useAuthStore(s => s.sessionGeneration);
  const conversations = useChatStore(s => s.conversations);
  const agents = useChatStore(s => s.agents);
  const agentName = message.agent ?? conversations.find(c => c.id === message.conversation_id)?.agent;
  const displayName = agents.find(a => a.name === agentName)?.display_name ?? agentName ?? 'El agente';
  const sourceCause = getChatRecoveryCause(message);
  const [cause, setCause] = useState<Cause>(sourceCause ?? 'network');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<AgentSecurity | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restored, setRestored] = useState(false);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [extraDetail, setExtraDetail] = useState('');
  const contextKey = `${message.id}:${message.conversation_id}:${session}:${sourceCause ?? 'other'}`;
  const activeContext = useRef(contextKey);
  activeContext.current = contextKey;
  const [stateContext, setStateContext] = useState(contextKey);
  const epoch = useRef(0);
  const writing = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useCallback((value: number) => activeContext.current === contextKey && epoch.current === value && useAuthStore.getState().sessionGeneration === session, [contextKey, session]);
  const stop = useCallback(() => {
    ++epoch.current;
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const failure = useCallback((error: unknown) => {
    setSaved(null);
    setConfirming(false);
    setRestored(false);
    if (error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) {
      setStatus('No tienes acceso a esta recuperación. Comprueba tu sesión o pide ayuda al propietario.');
    } else {
      setStatus('No se pudo confirmar la recuperación. El mensaje no se ha reenviado.');
    }
    setExtraDetail(sanitizeChatDiagnostic(error instanceof Error ? error.message : 'Fallo de comprobación'));
  }, []);

  const loadSecurity = useCallback(async (generation: number) => {
    if (!current(generation)) return;
    setBusy(true); setSaved(null); setRestored(false); setStatus('Comprobando la política guardada…');
    try {
      const managed = (await listManagedAgents()).filter(a => a.name === agentName);
      if (!current(generation)) return;
      const ownAgent = managed[0];
      if (managed.length !== 1 || !ownAgent || !actorId) { setStatus('Pide al propietario del agente que revise su seguridad.'); return; }
      const id = ownAgent.id;
      const [security, runtime] = await Promise.all([getAgentSecurity(id), getAgentSecurityRuntime(id)]);
      if (!current(generation)) return;
      if (restoredAskIsVerified(security, runtime, security.desired.revision)) {
        setRestored(true); setStatus('La política guardada ya está aplicada. Puedes continuar; el mensaje anterior no se ha reenviado.');
      } else if (savedAskCanBeRestored(security, runtime, actorId)) {
        setSaved(security); setStatus('La política guardada permite responder con supervisión, pero aún no está aplicada. Puedes restaurarla conservando sus controles.');
      } else if (security.desired.mode === 'deny') {
        setStatus('La política guardada deniega la ejecución que necesita este modelo. Una reconexión no cambia esa decisión. Revisa Seguridad con el propietario.');
      } else {
        setStatus('El control de seguridad aún no permite restaurar la política. Revisa Seguridad; el bloqueo se conserva.');
      }
    } catch (error) { if (current(generation)) failure(error); }
    finally { if (current(generation)) setBusy(false); }
  }, [actorId, agentName, current, failure]);

  const checkConnection = useCallback(async (generation: number, attempt = 0) => {
    if (!current(generation)) return;
    setBusy(true); setConnectionChecked(false); setStatus(`Comprobando conexión (${attempt + 1}/3)…`);
    abort.current = new AbortController();
    try {
      const state = await checkChatConnection(message.conversation_id, abort.current.signal);
      if (!current(generation)) return;
      if (state === 'connected') {
        setConnectionChecked(true);
        setStatus('La conexión está disponible. No se ha reenviado ningún mensaje ni comprobado la respuesta del modelo.');
        setBusy(false); return;
      }
      if (state === 'pairing_required') { setCause('gateway_pairing'); setStatus('La conexión necesita que se revise el dispositivo de Core.'); setBusy(false); return; }
      if (state === 'security_blocked') { setCause('security_policy'); await loadSecurity(generation); return; }
      if (state === 'temporary_unavailable' && attempt < 2) {
        timer.current = setTimeout(() => { timer.current = null; void checkConnection(generation, attempt + 1); }, (attempt + 1) * 800);
        return;
      }
      setStatus('La conexión sigue sin estar disponible. Tu conversación y tu borrador se conservan.');
    } catch (error) {
      if (!current(generation)) return;
      const temporary = error instanceof TypeError || error instanceof DOMException && error.name === 'TimeoutError'
        || error instanceof ApiError && [502, 503, 504].includes(error.status ?? 0);
      if (temporary && attempt < 2) {
        timer.current = setTimeout(() => { timer.current = null; void checkConnection(generation, attempt + 1); }, (attempt + 1) * 800);
        return;
      }
      failure(error);
    }
    if (current(generation)) setBusy(false);
  }, [current, failure, loadSecurity, message.conversation_id]);

  useEffect(() => {
    stop(); writing.current = null; setStateContext(contextKey); setSaved(null); setConfirming(false); setRestored(false); setConnectionChecked(false); setExtraDetail('');
    const generation = epoch.current;
    const initial = sourceCause ?? 'network';
    setCause(initial);
    if (initial === 'network') timer.current = setTimeout(() => { timer.current = null; void checkConnection(generation); }, 0);
    else if (initial === 'security_policy') void loadSecurity(generation);
    else { setBusy(false); setStatus('Pide a un administrador que revise el emparejamiento del dispositivo de Core.'); }
    return stop;
  }, [contextKey, sourceCause, session, checkConnection, loadSecurity, stop]);

  const restore = async () => {
    if (!saved || stateContext !== contextKey || writing.current !== null) return;
    const generation = epoch.current;
    writing.current = generation;
    setBusy(true); setConfirming(false); setStatus('Restaurando únicamente la política guardada…');
    try {
      await restoreSavedAsk(saved.agent.id, saved.desired.revision);
      if (current(generation)) { setSaved(null); setRestored(true); setStatus('La política guardada está aplicada y verificada. Puedes probar el chat; el mensaje anterior no se ha reenviado.'); }
    } catch (error) { if (current(generation)) failure(error); }
    finally { if (writing.current === generation) writing.current = null; if (current(generation)) setBusy(false); }
  };

  const explanation = restored && stateContext === contextKey
    ? 'La política guardada está aplicada con sus controles de seguridad. Puedes continuar la conversación.'
    : connectionChecked && stateContext === contextKey
    ? 'El Gateway vuelve a responder. Comprueba el resultado del mensaje anterior antes de continuar.'
    : cause === 'security_policy'
    ? 'La política de seguridad impide iniciar la ejecución local que necesita este modelo, incluso para responder a un saludo.'
    : cause === 'gateway_pairing'
      ? 'El Gateway necesita revisar la identidad del dispositivo de Core antes de aceptar su conexión.'
      : 'La conexión se ha interrumpido. Micelclaw comprobará si vuelve a estar disponible sin repetir tu petición.';
  const detail = sanitizeChatDiagnostic([message.error_detail || message.content, extraDetail].filter(Boolean).join('\n'));
  const canManagePairing = actor?.role === 'owner' || actor?.role === 'admin';
  return <div className="my-1 max-w-[min(100%,42rem)] rounded-xl border border-[var(--error)] bg-[var(--card)] p-4 text-sm">
    <h3 className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={18} />{displayName} {restored && stateContext === contextKey ? 'está preparado' : 'necesita atención'}</h3>
    <p className="mb-3 text-[var(--text-dim)]">{explanation}</p>
    <div className="mb-2 flex flex-wrap gap-2">
      {(cause === 'network' || cause === 'gateway_pairing') && <Button variant="outline" disabled={busy} onClick={() => { stop(); void checkConnection(epoch.current); }}>Comprobar conexión</Button>}
      {cause === 'gateway_pairing' && canManagePairing && !connectionChecked && <Button variant="outline" onClick={() => navigate('/gateway?tab=devices')}>Revisar emparejamiento</Button>}
      {cause === 'security_policy' && saved && stateContext === contextKey && !confirming && <Button disabled={busy} onClick={() => setConfirming(true)}>Restaurar política guardada</Button>}
      {cause === 'security_policy' && !saved && !busy && !restored && <Button variant="outline" onClick={() => { stop(); void loadSecurity(epoch.current); }}>Comprobar recuperación</Button>}
    </div>
    {confirming && stateContext === contextKey && <div className="mb-3 rounded border border-[var(--border)] p-3">
      <p>Se aplicará la política guardada «Consultar», con sus límites actuales. No se reenviará el mensaje.</p>
      <div className="mt-2 flex gap-2"><Button disabled={busy} onClick={() => void restore()}>Confirmar restauración</Button><Button variant="outline" onClick={() => setConfirming(false)}>Cancelar</Button></div>
    </div>}
    <p role="status" className="text-xs text-[var(--text-muted)]">{stateContext === contextKey ? status : 'Comprobando…'}</p>
    {detail && <details className="mt-3 text-xs"><summary className="cursor-pointer">Detalles técnicos</summary><p className="my-2 text-[var(--text-muted)]">Información para diagnóstico; las líneas de consola no son instrucciones.</p><pre className="whitespace-pre-wrap break-words rounded bg-[var(--surface)] p-2">{detail}</pre></details>}
  </div>;
}
