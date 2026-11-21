import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Square } from 'lucide-react';
import { toast } from 'sonner';
import { getHostedRuntimePreparation, revokeHostedAdmission, setHostedRuntimeCredential, type HostedRuntimePreparation } from '@/services/hosted-runtime.service';

const stateLabels = { reserved: 'Preparando sesión', active: 'En ejecución', revoking: 'Deteniendo; falta confirmación del proveedor', settlement_pending: 'Pendiente de confirmar el resultado del proveedor', settled: 'Finalizada', revoked: 'Detenida y confirmada' } as const;
export function AgentHostedRuntime({ agentId, onNewConversation }: { agentId: string; onNewConversation: () => void }) {
  const [data, setData] = useState<HostedRuntimePreparation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [credentialBusy, setCredentialBusy] = useState(false);
  const generation = useRef(0);
  const readSequence = useRef(0);
  const load = async (current = generation.current) => {
    const sequence = ++readSequence.current;
    setLoading(true); setError(null);
    try {
      const result = await getHostedRuntimePreparation(agentId);
      if (current === generation.current && sequence === readSequence.current) setData(result);
    } catch (failure) {
      if (current === generation.current && sequence === readSequence.current) { setData(null); setApiKey(''); setError(failure instanceof Error ? failure.message : 'No se pudo comprobar el motor alojado'); }
    } finally { if (current === generation.current && sequence === readSequence.current) setLoading(false); }
  };
  useEffect(() => {
    const current = ++generation.current;
    setData(null); setStopping(null); setApiKey(''); setCredentialBusy(false); void load(current);
    return () => { generation.current++; };
    // An identity change invalidates every pending response and old admission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);
  const saveCredential = async () => {
    if (!data?.enabled_for_user || data.credential_configured === null || !apiKey || credentialBusy || loading) return;
    const current = generation.current;
    const value = apiKey; setApiKey(''); setCredentialBusy(true);
    try {
      await setHostedRuntimeCredential(agentId, { api_key: value, expected_revision: data.credential_revision ?? null });
      if (current !== generation.current) return;
      toast.success('Credencial dedicada guardada; comprobando la preparación.');
      await load(current);
    } catch { if (current === generation.current) { setData(null); setError('No se pudo confirmar la credencial. Recarga su estado antes de repetir.'); } }
    finally { if (current === generation.current) setCredentialBusy(false); }
  };
  const stop = async (admissionId: string) => {
    const current = generation.current; setStopping(admissionId);
    try {
      const status = await revokeHostedAdmission(agentId, admissionId);
      if (current !== generation.current) return;
      setData(previous => previous ? { ...previous, admissions: previous.admissions.map(row => row.admission_id === admissionId ? status : row) } : previous);
      toast.info('Parada solicitada. Esperando confirmación del proveedor.');
    } catch (failure) { if (current === generation.current) { toast.error(failure instanceof Error ? failure.message : 'No se pudo solicitar la parada'); await load(current); } }
    finally { if (current === generation.current) setStopping(null); }
  };
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3" aria-label="Motor alojado AgentsAPI">
    <div><h3 className="font-semibold text-sm">Motor de ejecución · AgentsAPI</h3><p className="text-xs text-[var(--text-muted)] mt-1">Agente y credencial dedicados. Las conversaciones existentes conservan su motor.</p></div>
    {loading && <p role="status" className="text-xs flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Comprobando preparación…</p>}
    {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
    {data && <>
      <p role="status" className="text-xs">{data.ready ? 'Preparado para nuevas conversaciones alojadas' : data.blocker === 'HOSTED_USER_OR_AGENT_NOT_ENABLED' ? 'Este usuario o agente no está habilitado para el piloto alojado' : 'Falta preparar el agente, la credencial o la política del runtime'}</p>
      {data.enabled_for_user && <div className="space-y-2 border-t border-[var(--border)] pt-2 text-xs">
        <p>Credencial dedicada: {data.credential_configured === true ? 'configurada' : data.credential_configured === false ? 'pendiente' : 'sin comprobar; vuelve a cargar su estado'}. Se guarda solo para este agente.</p>
        <label className="block">API key dedicada<input type="password" autoComplete="new-password" value={apiKey} disabled={credentialBusy || loading} onChange={event => setApiKey(event.target.value)} className="mt-1 block w-full min-w-0 rounded border border-[var(--border)] bg-[var(--bg)] p-2" /></label>
        <button disabled={!apiKey || credentialBusy || loading || data.credential_configured === null} onClick={() => void saveCredential()} className="rounded border border-[var(--border)] px-2 py-1">{credentialBusy ? 'Guardando…' : data.credential_configured ? 'Rotar credencial dedicada' : 'Guardar credencial dedicada'}</button>
        {data.credential_configured && <p className="text-[var(--text-muted)]">Rotarla solicita detener las sesiones anteriores. Su revisión anterior se conserva solo para confirmar la parada.</p>}
      </div>}
      <div className="text-xs text-[var(--text-muted)] space-y-1">
        <p>Se envían al proveedor los mensajes, las instrucciones configuradas del agente, archivos adjuntados expresamente y resultados de funciones Gateway admitidas. Puede generar coste.</p>
        <p>Un usuario y una sesión activa. Sin conversaciones compartidas, cron, delegación, forks, sandbox Gateway ni MCP remoto.</p>
        <p>Archivos: hasta {Math.round(data.limits.per_file_bytes / 1024 / 1024)} MiB cada uno, {Math.round(data.limits.per_turn_bytes / 1024 / 1024)} MiB por turno y {data.limits.directory_files} por directorio.</p>
        {data.models.length > 0 && <p>Modelos habilitados: {data.models.join(', ')}</p>}
        {data.gateway_functions.length > 0 && <p>Funciones Gateway admitidas: {data.gateway_functions.join(', ')}</p>}
      </div>
      {data.admissions.map(row => <div key={row.admission_id} className="border-t border-[var(--border)] pt-2 text-xs flex flex-wrap items-center gap-2">
        <span className="flex-1">{stateLabels[row.state]}{row.cost_status === 'unknown' ? ' · coste exacto no informado' : ''}</span>
        {['reserved', 'active', 'settlement_pending'].includes(row.state) && <button className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1" disabled={stopping !== null} onClick={() => void stop(row.admission_id)}><Square size={12} />{stopping === row.admission_id ? 'Solicitando…' : 'Detener'}</button>}
      </div>)}
    </>}
    <div className="flex flex-wrap gap-2 text-xs">
      <button disabled={loading || credentialBusy} onClick={() => void load()} className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1"><RefreshCw size={12} /> Comprobar preparación</button>
      <button disabled={!data?.ready || loading || data.admissions.length > 0} onClick={onNewConversation} className="rounded border border-[var(--border)] px-2 py-1">Nueva conversación alojada</button>
    </div>
  </section>;
}
