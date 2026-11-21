import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/services/api';
import { workboardRecoveryApi, type RecoveryItem, type RecoveryList } from './workboard-recovery.service';

const labels: Record<RecoveryItem['state'], string> = { retained: 'Conservado', restoring: 'Recuperación pendiente de confirmar', discarding: 'Eliminación pendiente de confirmar', restored: 'Recuperado', discarded: 'Descarte registrado' };
const size = (n: number) => `${(n / 1024 / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} MiB`;
export function WorkboardRecoveryPanel({ cardId, onChanged }: { cardId: string; onChanged: () => void }) {
  const [list, setList] = useState<RecoveryList | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<RecoveryItem | null>(null), [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState('');
  const generation = useRef(0), attempts = useRef(new Map<string, string>());
  async function load(epoch = generation.current) {
    setBusy(true); setError(''); setConfirm(null); setConsent(false);
    try { const value = await workboardRecoveryApi.list(cardId); if (epoch === generation.current) setList(value); }
    catch (e) { if (epoch === generation.current) { setList(null); setError(e instanceof ApiError && e.status === 503 ? 'La gestión de trabajo recuperable aún no está disponible en esta instalación.' : 'No se pudo comprobar el trabajo. Se conserva sin cambios.'); } }
    finally { if (epoch === generation.current) setBusy(false); }
  }
  useEffect(() => {
    const epoch = ++generation.current; setList(null); setConfirm(null); setConsent(false); setNotice(''); attempts.current.clear(); void load(epoch);
    return () => { generation.current++; };
    // cardId identifies the entire request generation; late answers cannot paint another card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);
  async function act(action: 'restore' | 'discard' | 'reconcile', item: RecoveryItem) {
    const current=list?.items.find(row=>row.id===item.id);
    const pending=list?.pending_attempts?.find(row=>row.artifact_id===item.id);
    if (busy || !current || current.revision!==item.revision) return;
    if(action==='reconcile' ? !pending || !pending.reconcilable || pending.retry_after_ms>0
      : current.state!=='retained' || !!list?.pending_attempts?.length) return;
    if (action === 'discard' && (!consent || confirm?.id !== item.id || confirm.revision !== item.revision)) return;
    const epoch = generation.current, key = `${cardId}:${item.id}:${item.revision}:${action}`;
    let operationId = attempts.current.get(key);
    if (!operationId) { operationId = crypto.randomUUID(); attempts.current.set(key, operationId); }
    setBusy(true); setNotice('');
    try {
      const result = action === 'reconcile' ? await workboardRecoveryApi.reconcile(cardId, item) : await workboardRecoveryApi[action](cardId, item, operationId);
      if (epoch !== generation.current) return;
      setConfirm(null); setConsent(false);
      if(['restored','discarded','retained'].includes(result.state)) {
        for(const id of attempts.current.keys()) if(id.startsWith(`${cardId}:${item.id}:`)) attempts.current.delete(id);
      }
      setNotice(result.state === 'retained' ? 'El intento se ha cerrado sin eliminar el trabajo. El contenido se conserva; puedes iniciar otra acción explícita.' : result.state === 'restored' ? 'Trabajo recuperado. No se ha iniciado ningún agente.' : result.state === 'discarded' ? 'Descarte registrado. El espacio liberado no está demostrado; revisa los residuos observados.' : 'El resultado sigue pendiente. Comprueba el estado y concilia el intento original.');
      onChanged(); await load(epoch);
    } catch {
      if (epoch === generation.current) { setNotice('No se pudo confirmar el resultado. El intento se conserva; actualiza y concílialo antes de repetir la operación.'); setConfirm(null); setConsent(false); await load(epoch); }
    } finally { if (epoch === generation.current) setBusy(false); }
  }
  return <section aria-label="Trabajo recuperable" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
    <h3>Trabajo recuperable</h3>
    <p>Recuperar conserva los archivos y no arranca un agente. No se borra trabajo automáticamente.</p>
    {busy && <p role="status">Comprobando…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <button type="button" disabled={busy} onClick={() => void load()}>Actualizar trabajo recuperable</button>
    {list && <>
      <p>Espacio conservado de esta tarea: {size(list.used_bytes)}. Umbral de admisión global: 2 GiB; no es una cuota física.</p>
      {list.items.length === 0 && <p>Sin trabajo recuperable.</p>}
      {list.pending_attempts?.some(p=>!list.items.some(item=>item.id===p.artifact_id)) && <p role="alert">Core conserva un intento pendiente cuyo trabajo nativo no está en este listado. No inicies otro intento; actualiza el estado.</p>}
      {list.items.map((item, index) => {
        const pending=list.pending_attempts?.find(p=>p.artifact_id===item.id);
        return <article key={item.id} style={{ padding: '8px 0' }}>
        <strong>Trabajo {index + 1} · {labels[item.state]}</strong><p>{size(item.bytes)} · Revisión {item.revision}</p>
        {item.partial_discard && <p role="alert">Descarte parcial: conserva los archivos restantes. Una nueva eliminación exige otra confirmación.</p>}
        {item.root_retained && <p>Queda una raíz técnica conservada. No se afirma que el árbol o el espacio estén completamente retirados.</p>}
        {item.native_retirement?.status === 'pending' && <p>Retirada del registro nativo pendiente.</p>}
        {pending && <>
          <p role="status">Intento original pendiente de confirmar. {!pending.reconcilable ? 'El registro Core se ha retirado; no se puede conciliar desde este panel.' : pending.retry_after_ms>0 ? `Espera ${Math.ceil(pending.retry_after_ms/1000)} s y actualiza el estado.` : 'Puedes conciliar el mismo intento.'}</p>
          <button type="button" disabled={busy || !pending.reconcilable || pending.retry_after_ms>0} onClick={() => void act('reconcile',item)}>Conciliar intento pendiente</button>
        </>}
        {item.state === 'retained' && !pending && !(list.pending_attempts?.length) && <>
          <button type="button" disabled={busy} onClick={() => void act('restore', item)}>Recuperar trabajo {index + 1}</button>
          <button type="button" disabled={busy} onClick={() => { setConfirm(item); setConsent(false); }}>Eliminar trabajo {index + 1}…</button>
        </>}
        {['restoring', 'discarding'].includes(item.state) && !pending && <p role="alert">No se ha encontrado un intento Core conciliable. El trabajo se conserva; actualiza el estado antes de continuar.</p>}
      </article>; })}
    </>}
    {confirm && <div role="group" aria-label="Confirmar eliminación de trabajo">
      <p>Eliminar borra también archivos nuevos e ignorados de este trabajo. No borra datos de otras tareas.</p>
      <label><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /> Confirmo eliminar el trabajo seleccionado, incluidos los archivos nuevos e ignorados.</label>
      <button type="button" disabled={busy} onClick={() => { setConfirm(null); setConsent(false); }}>Cancelar eliminación</button>
      <button type="button" disabled={busy || !consent} onClick={() => void act('discard', confirm)}>Eliminar definitivamente</button>
    </div>}
  </section>;
}
