import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { LockKeyhole, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { readSecureConfigurationOperation, submitSecureConfigurationValue, cancelSecureConfigurationOperation, acceptSecureConfigurationOperation, type SecureConfigurationOperation } from '@/services/configuration-conversation.service';

const statusText: Record<SecureConfigurationOperation['state'], string> = {
  prepared: 'Propuesta preparada.', waiting_for_credential: 'Introduce la credencial en este formulario seguro.',
  human_action_required: 'Este cambio necesita una acción humana.', applying: 'Aplicando el cambio…',
  saved: 'Credencial guardada y releída. La autenticación externa todavía no se ha comprobado.',
  verified: 'Preferencia aplicada y comprobada.', pending_activation: 'Configuración guardada y releída. Su activación todavía necesita comprobarse.',
  cancelled: 'Operación cancelada.', expired: 'El formulario caducó. Pide al agente que prepare otro.',
  uncertain: 'El resultado requiere comprobación. Consulta Settings antes de preparar otro cambio.', failed: 'No se completó el cambio. Consulta su estado antes de reintentar.',
};

export function SecureConfigurationForm({ operationId, conversationId }: { operationId: string; conversationId: string }) {
  const generation = useAuthStore(s => s.sessionGeneration);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null); const labelId = useId();
  const [operation, setOperation] = useState<SecureConfigurationOperation | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [continued, setContinued] = useState(false);
  const context = `${generation}:${operationId}:${conversationId}`;
  const current = useRef(context); current.current = context;
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setBusy(true); setMessage('');
    try {
      const value = await readSecureConfigurationOperation(operationId, conversationId, abort.signal);
      if (current.current === context && !abort.signal.aborted) setOperation(value);
    } catch {
      if (current.current === context && !abort.signal.aborted) { setOperation(null); setMessage('Este formulario no está disponible en esta conversación o sesión.'); }
    } finally { if (current.current === context && !abort.signal.aborted) setBusy(false); }
  }, [operationId, conversationId, context]);
  useEffect(() => {
    setOperation(null); setContinued(false); if (input.current) input.current.value = '';
    void load();
    return () => { controller.current?.abort(); if (input.current) input.current.value = ''; };
  }, [load]);
  function continueConversation(value: SecureConfigurationOperation) {
    const chat = useChatStore.getState();
    if (chat.activeConversationId !== conversationId || useAuthStore.getState().sessionGeneration !== generation) return;
    const result = chat.sendMessage(`He completado la acción de configuración ${value.change_id}. Consulta configuration_result para continuar; no se ha enviado ninguna credencial al chat.`);
    if (result.accepted) setContinued(true);
    else setMessage('El cambio quedó guardado. Puedes continuar cuando termine el turno actual o se recupere la conexión.');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!operation || busy) return;
    const credential = input.current?.value ?? ''; if (input.current) input.current.value = '';
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    setBusy(true); setMessage('');
    try {
      const value = operation.state === 'human_action_required'
        ? await acceptSecureConfigurationOperation(operationId, abort.signal)
        : await submitSecureConfigurationValue(operationId, conversationId, credential, abort.signal);
      if (current.current !== context || abort.signal.aborted) return;
      setOperation(value);
      if (['saved', 'verified', 'pending_activation'].includes(value.state)) { toast.success('Configuración guardada'); continueConversation(value); }
    } catch {
      if (current.current === context && !abort.signal.aborted) {
        setOperation(null); setMessage(operation.private_input ? 'No se pudo confirmar el resultado. Actualiza su estado antes de volver a introducir el valor privado.' : 'No se pudo confirmar el resultado. Actualiza su estado antes de volver a introducir la credencial.');
      }
    } finally { if (current.current === context && !abort.signal.aborted) setBusy(false); }
  }
  async function cancel() {
    if (busy) return; if (input.current) input.current.value = '';
    setBusy(true); setMessage('');
    try { const value = await cancelSecureConfigurationOperation(operationId, conversationId); if (current.current === context) setOperation(value); }
    catch { if (current.current === context) setMessage('No se pudo confirmar la cancelación. Actualiza su estado.'); }
    finally { if (current.current === context) setBusy(false); }
  }
  const waiting = operation?.state === 'waiting_for_credential';
  const accepting = operation?.state === 'human_action_required';
  const privateInput = operation?.private_input;
  const finished = operation && ['saved', 'verified', 'pending_activation'].includes(operation.state);
  return <section className="my-2 max-w-xl rounded-lg border border-[var(--border)] bg-[var(--card)] p-3" aria-labelledby={labelId}>
    <div className="mb-2 flex items-center gap-2"><LockKeyhole size={16} aria-hidden /><strong id={labelId}>{operation?.label ?? 'Acción segura de configuración'}</strong>{busy && <Loader2 size={14} className="animate-spin" aria-label="Cargando" />}</div>
    {operation && <p className="mb-2 text-sm text-[var(--text-muted)]" role="status">{waiting && privateInput ? 'Introduce las instrucciones en este formulario privado.' : statusText[operation.state]}</p>}
    {!!operation?.consequences?.length && <div className="mb-3 text-sm"><p className="mb-1 font-medium">Consecuencias del cambio</p><ul className="list-disc space-y-1 pl-5">{operation.consequences.map((text,index) => <li key={index}>{text}</li>)}</ul></div>}
    {message && <p className="mb-2 text-sm" role="status">{message}</p>}
    {(waiting || accepting) && <form onSubmit={submit}>
      {waiting && <>
        <label htmlFor={`${labelId}-value`} className="mb-1 block text-sm">{privateInput?.label ?? 'API key'}</label>
        {privateInput?.kind === 'multiline_text'
          ? <textarea className="flex w-full bg-[var(--card)] px-3 py-1 text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50" style={{border:'1px solid var(--border)',borderRadius:'var(--radius-md)'}} id={`${labelId}-value`} ref={node => { input.current = node; }} rows={6} minLength={privateInput.min_length} maxLength={privateInput.max_length} required={privateInput.min_length > 0} autoComplete="off" autoCorrect="off" spellCheck={false} disabled={busy} />
          : <Input id={`${labelId}-value`} ref={node => { input.current = node; }} type="password" minLength={8} maxLength={16384} required autoComplete="new-password" autoCorrect="off" spellCheck={false} disabled={busy} />}
        <p className="my-2 text-xs text-[var(--text-muted)]">{privateInput?.description ?? 'El valor se envía directamente a Micelclaw. No se añade al chat ni al contexto del agente.'}</p>
      </>}
      {accepting && <p className="mb-3 text-sm">Valor propuesto: <code>{JSON.stringify(operation?.proposed_value)}</code></p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => void cancel()} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy}>{waiting ? 'Guardar y continuar' : 'Aplicar y continuar'}</Button></div>
    </form>}
    {finished && !continued && <Button variant="outline" onClick={() => continueConversation(operation)} disabled={busy}>Continuar con el agente</Button>}
    {!waiting && !accepting && <Button variant="ghost" size="sm" onClick={() => void load()} disabled={busy}>Actualizar estado</Button>}
  </section>;
}
