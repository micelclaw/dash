import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { getConnectorSyncSchedule, runConnector } from '@/services/sync.service';
import type { ConnectorSyncSchedule, ConnectorRunAction } from '@/services/sync.service';
import type { PlatformCapability } from '@/services/messages.service';

const feedback: Record<ConnectorRunAction, string> = {
  sync_started: 'Sincronización solicitada; los mensajes aparecerán cuando termine.',
  stream_reconnected: 'Reconexión solicitada.',
  stream_already_live: 'El canal ya está conectado en tiempo real.',
  refreshed: 'Actualización solicitada; el historial aparecerá cuando termine.',
  noop: 'Este canal recibe mensajes en tiempo real; no hay nada que sincronizar.',
};

export function ChannelSyncStatus({ capability }: { capability?: PlatformCapability }) {
  // `can_observe` puede ser false durante syncing: no es permiso para ocultar
  // información. El GET autorizado confirma direction y el estado para el botón.
  if (!capability?.connector || capability.transport !== 'native' || capability.stream !== 'not_applicable') return null;
  return <PullSyncStatus key={capability.connector.id} connectorId={capability.connector.id} />;
}

function PullSyncStatus({ connectorId }: { connectorId: string }) {
  const [schedule, setSchedule] = useState<ConnectorSyncSchedule | null>();
  const [error, setError] = useState(false);
  const [running, setRunning] = useState(false);
  const [requested, setRequested] = useState(false);
  const pendingSince = useRef<number | null>(null);
  const sawSyncing = useRef(false);
  const completions = useRef(0);
  const mounted = useRef(false);
  const request = useRef(0);
  const runningRef = useRef(false);
  const delayedRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useWebSocket('sync.completed');
  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      const result = await getConnectorSyncSchedule(connectorId);
      if (mounted.current && current === request.current) {
        setSchedule(result); setError(false);
        if (pendingSince.current !== null) {
          if (result?.status === 'syncing') sawSyncing.current = true;
          else if (sawSyncing.current || Date.now() - pendingSince.current >= 30_000) {
            if (!sawSyncing.current) toast.info('La solicitud fue aceptada, pero no se ha confirmado su finalización. Puedes consultar el estado o reintentar.');
            pendingSince.current = null; setRequested(false);
          }
        }
      }
    } catch {
      if (mounted.current && current === request.current) setError(true);
    }
  }, [connectorId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      ++request.current;
      window.removeEventListener('focus', onFocus);
      if (delayedRefresh.current) clearTimeout(delayedRefresh.current);
    };
  }, [refresh]);
  useEffect(() => {
    if (completed?.data.connector_id === connectorId) {
      ++completions.current;
      pendingSince.current = null; setRequested(false);
      void refresh();
    }
  }, [completed, connectorId, refresh]);
  useEffect(() => {
    if (!requested && schedule?.status !== 'syncing') return;
    const timer = setInterval(() => { void refresh(); }, 10_000);
    return () => clearInterval(timer);
  }, [requested, schedule?.status, refresh]);

  const run = async () => {
    if (runningRef.current || pendingSince.current !== null) return;
    runningRef.current = true;
    setRunning(true);
    const completionAtStart = completions.current;
    try {
      const action = await runConnector(connectorId, { requireAction: true });
      if (mounted.current) {
        if (action === 'sync_started' && completionAtStart === completions.current) {
          pendingSince.current = Date.now(); sawSyncing.current = false; setRequested(true);
        }
        toast.success(feedback[action]);
      }
    } catch {
      if (mounted.current) toast.error('No se pudo solicitar la sincronización. Puede que ya esté en curso; revisa el estado o vuelve a intentarlo.');
    } finally {
      runningRef.current = false;
      if (mounted.current) {
        setRunning(false);
        void refresh();
        if (delayedRefresh.current) clearTimeout(delayedRefresh.current);
        delayedRefresh.current = setTimeout(() => { void refresh(); }, 2500);
      }
    }
  };

  if (schedule === null) return null;
  const blocked = !schedule || error || !['connected', 'active', 'error'].includes(schedule.status);
  const state = schedule?.status === 'paused' ? 'Sincronización pausada.'
    : schedule?.status === 'pending_pairing' ? 'Pendiente de vinculación.'
    : schedule?.status === 'syncing' ? 'Sincronización en curso.'
    : schedule?.status === 'error' ? 'La última sincronización falló; puedes reintentar.' : '';
  const last = schedule?.last_sync_at ? new Date(schedule.last_sync_at) : null;
  return (
    <section aria-label="Sincronización del canal" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: '1 1 220px' }} aria-live="polite">
        {error ? 'No se pudo consultar la sincronización.' : !schedule ? 'Consultando sincronización…' : <>
          <div>{schedule.interval_minutes === null ? 'Sincronización periódica (intervalo no disponible).' : `Sincronización cada ${schedule.interval_minutes} min.`} No es tiempo real; los mensajes de fuera llegan en el siguiente sondeo y puede tardar más si hay retrasos.</div>
          <div>{state} Última sincronización: {last && Number.isFinite(last.getTime()) ? last.toLocaleString() : 'todavía no registrada'}.</div>
        </>}
      </div>
      {error ? <Button type="button" variant="outline" size="sm" onClick={() => { void refresh(); }}>Reintentar</Button> : <Button type="button" variant="outline" size="sm" onClick={() => { void run(); }} disabled={running || requested || blocked}>{running ? 'Solicitando…' : requested ? 'Sincronización solicitada…' : 'Sincronizar ahora'}</Button>}
    </section>
  );
}
