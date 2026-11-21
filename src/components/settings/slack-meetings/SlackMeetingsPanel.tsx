import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as meetings from '@/services/slack-meetings.service';
import { useChatStore } from '@/stores/chat.store';

const statuses: Record<meetings.SlackMeeting['status'], string> = {
  reserved: 'Reservada', connecting: 'Conectando', active: 'Sesión vinculada', cleanup_pending: 'Cierre pendiente de confirmar', closed: 'Cerrada',
};
function observedStatus(native: meetings.SlackNativeStatus | null, mode: meetings.SlackMeetingMode) {
  if (!native?.found) return 'Sesión no encontrada';
  const health = native.session?.chrome?.health;
  const reason = health?.manual_action?.reason;
  const reasons: Record<string, string> = { 'slack-login-required': 'Inicia sesión con la cuenta dedicada en el perfil Chrome preparado',
    'slack-admission-required': 'Esperando admisión en Slack', 'slack-session-conflict': 'Cuenta o dispositivo ocupado en otra reunión',
    'slack-confirmation-required': 'Falta confirmar la incorporación en Slack', 'slack-huddle-not-active': 'Una persona debe iniciar el Huddle',
    'slack-permission-required': 'Falta permiso de micrófono en el perfil dedicado', 'slack-microphone-required': 'Micrófono no preparado' };
  if (reason) return reasons[reason] ?? `Acción manual pendiente (${reason})`;
  if (health?.in_call === false) return 'Slack aún no confirma la incorporación';
  if (health?.mic_muted === true && mode !== 'transcribe') return 'Micrófono silenciado';
  if (health?.captioning === false && mode === 'transcribe') return 'Captions no disponibles; actívalos en Slack';
  return `${native.session?.state ?? 'Estado no disponible'} · ${health?.in_call === true ? 'incorporación confirmada por Slack' : 'incorporación sin comprobar'}`;
}

/** No native agent ID, credentials, history or memory is ever accepted from this form. */
export function SlackMeetingsPanel() {
  const [capabilities, setCapabilities] = useState<meetings.SlackMeetingCapabilities | null>(null);
  const [rows, setRows] = useState<meetings.SlackMeeting[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<meetings.SlackMeetingMode>('transcribe');
  const [huddleUrl, setHuddleUrl] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [captions, setCaptions] = useState<Record<string, string[]>>({});
  const [observed, setObserved] = useState<Record<string, string>>({});
  const operation = useRef<string | null>(null);
  const mounted = useRef(false);
  const refreshGeneration = useRef(0);
  const conversations = useChatStore(state => state.conversations);
  const loadConversations = useChatStore(state => state.loadConversations);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const generation = ++refreshGeneration.current;
    try {
      const [caps, list] = await Promise.all([meetings.getSlackMeetingCapabilities(signal), meetings.listSlackMeetings(signal)]);
      if (!signal?.aborted && mounted.current && generation === refreshGeneration.current) { setCapabilities(caps); setRows(list); setError(''); }
    } catch (cause) {
      if (!signal?.aborted && mounted.current && generation === refreshGeneration.current) setError(cause instanceof Error ? cause.message : 'No se pudo comprobar el estado de reuniones');
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    void loadConversations();
    return () => { mounted.current = false; controller.abort(); };
  }, [refresh, loadConversations]);
  const perform = async (action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true); setError('');
    try { await action(); if (mounted.current) await refresh(); }
    catch (cause) { if (mounted.current) { await refresh(); setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación'); } }
    finally { if (mounted.current) setPending(false); }
  };
  return <section aria-label="Reuniones Slack" className="space-y-4 rounded-lg border border-border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Reuniones de Slack</h3>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => void refresh()}><RefreshCw className="size-4" />Actualizar</Button>
    </div>
    <p role="status">Preparación: {capabilities ? capabilities.prepared ? 'Lista' : 'Pendiente' : 'Comprobando…'}{capabilities?.account_busy ? ' · Cuenta ocupada' : ''}</p>
    {capabilities?.reason && <p className="text-sm text-muted-foreground">{capabilities.reason}</p>}
    <p className="text-sm text-muted-foreground">Cuenta y agente de reuniones dedicados, sin acceso a tus apps personales. Memoria entre reuniones desactivada; no aprende datos compartidos.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2"><label htmlFor="slack-meeting-mode">Modo</label><Select value={mode} onValueChange={value => { setMode(value as meetings.SlackMeetingMode); operation.current = null; }} disabled={pending}>
        <SelectTrigger id="slack-meeting-mode"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="transcribe">Transcribir (requiere captions)</SelectItem><SelectItem value="agent">Voz agente</SelectItem><SelectItem value="bidi">Voz bidireccional</SelectItem>
        </SelectContent></Select></div>
      <div className="space-y-2"><label htmlFor="slack-meeting-conversation">Conversación propia de origen</label><Select value={conversationId} onValueChange={value => { setConversationId(value); operation.current = null; }} disabled={pending}>
        <SelectTrigger id="slack-meeting-conversation"><SelectValue placeholder="Elige tu conversación" /></SelectTrigger><SelectContent>
          {conversations.filter(item => !item.access || item.access === 'owner').map(item => <SelectItem key={item.id} value={item.id}>{item.first_message || 'Conversación sin título'}</SelectItem>)}
        </SelectContent></Select></div>
      <div className="space-y-2 sm:col-span-2"><label htmlFor="slack-meeting-url">Enlace de un Huddle ya iniciado</label><Input id="slack-meeting-url" value={huddleUrl} onChange={event => { setHuddleUrl(event.target.value); operation.current = null; }} placeholder="https://app.slack.com/huddle/…" disabled={pending} /></div>
    </div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={pending} />Entiendo que la cuenta dedicada se incorporará y capturará audio; avisaré a los participantes.</label>
    <Button disabled={pending || !capabilities?.prepared || capabilities.account_busy || !acknowledged || !huddleUrl || !conversationId} onClick={() => void perform(async () => {
      operation.current ??= crypto.randomUUID();
      await meetings.joinSlackMeeting({ operation_id: operation.current, conversation_id: conversationId, huddle_url: huddleUrl, mode, capture_acknowledged: acknowledged });
      operation.current = null;
      toast.success('Sesión de reunión vinculada; comprueba el estado y el audio en Slack');
    })}>{pending && <Loader2 className="size-4 animate-spin" />}Entrar</Button>
    <ul className="space-y-3">{rows.map(row => <li key={row.id} className="space-y-2 rounded border border-border p-3">
      <div className="flex flex-wrap justify-between gap-2"><strong>{statuses[row.status]}</strong><span>{row.mode === 'transcribe' ? 'Transcribir' : row.mode === 'agent' ? 'Voz agente' : 'Voz bidireccional'}</span></div>
      <p className="break-all text-xs text-muted-foreground">Conversación: {row.conversation_id}</p>
      {row.huddle_url && <a className="inline-flex items-center gap-1 underline" href={row.huddle_url} target="_blank" rel="noopener noreferrer">Abrir Slack<ExternalLink className="size-3" /></a>}
      {row.mode !== 'transcribe' && <p className="text-sm">Consulta el estado y el audio en Slack. La RPC de transcripción no está disponible en este modo.</p>}
      {observed[row.id] && <p role="status">Estado nativo observado: {observed[row.id]}</p>}
      {captions[row.id] && <ol aria-label="Transcripción" className="space-y-1 text-sm">{captions[row.id]?.map((line, index) => <li key={index}>{line}</li>)}{captions[row.id]?.length === 0 && <li>Sin captions observados. Comprueba que Slack los tiene activados.</li>}</ol>}
      {row.failure_code && <p className="text-sm text-destructive">{row.failure_code}</p>}
      {row.status === 'active' && <Button variant="outline" disabled={pending} onClick={() => void perform(async () => {
        const status = await meetings.getSlackMeetingStatus(row.id);
        if (mounted.current) setObserved(previous => ({ ...previous, [row.id]: observedStatus(status.native, row.mode) }));
        if (row.mode === 'transcribe') {
          const result = await meetings.getSlackMeetingTranscript(row.id);
          if (mounted.current) setCaptions(previous => ({ ...previous, [row.id]: result.lines.map(line => `${line.speaker ? line.speaker + ': ' : ''}${line.text}`) }));
        }
      })}>Actualizar reunión{row.mode === 'transcribe' ? ' y transcripción' : ''}</Button>}
      {row.status !== 'closed' && <Button variant="outline" disabled={pending} onClick={() => void perform(() => meetings.leaveSlackMeeting(row.id))}>Salir y confirmar cierre</Button>}
    </li>)}</ul>
    {!rows.length && capabilities && <p className="text-sm text-muted-foreground">No tienes reuniones registradas.</p>}
    {capabilities?.can_prepare && <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending || capabilities.account_busy} onClick={() => void perform(() => meetings.prepareSlackMeetings())}>Verificar preparación dedicada</Button>
      {(['testListen', 'testSpeech'] as const).map(kind => <Button key={kind} variant="outline" disabled={pending || !capabilities.prepared || capabilities.account_busy || !huddleUrl || !acknowledged}
        onClick={() => void perform(async () => {
          const result = await meetings.probeSlackMeeting({ operation_id: crypto.randomUUID(), kind, huddle_url: huddleUrl, mode: kind === 'testListen' ? 'transcribe' : 'agent' });
          const verified = kind === 'testListen' ? result.result?.listen_verified : result.result?.speech_output_verified;
          toast.info(verified ? 'Señal local verificada; falta confirmación de un participante externo' : 'No se ha verificado la señal de audio');
        })}>{kind === 'testListen' ? 'Probar escucha' : 'Probar voz'}</Button>)}
    </div>}
  </section>;
}
